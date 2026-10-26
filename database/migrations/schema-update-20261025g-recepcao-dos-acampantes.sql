-- Recepcao dos acampantes na igreja (25/10/2026, Patrick).
--
-- Login Apoio ganha a area 'recepcao' (Bruna e Rodolfo). A tela /recepcao faz
-- a chamada dos acampantes da edicao: "Chegou" (com "ciente do termo" e, para
-- menor, "responsavel ciente"), desfazer, observacao, listas dos onibus e
-- "Encerrar chamada" (aviso para os organizadores no painel). Varios aparelhos
-- ao mesmo tempo: a tela confere recepcao_versao() a cada poucos segundos e o
-- banco barra presenca em dobro.
--
-- Quem aparece: TODOS os acampantes da edicao, pagos ou nao (Patrick, por
-- enquanto), e os infiltrados da escala oficial com cor -- como acampantes,
-- sem marca nenhuma para a recepcao (sigilo); so o organizador ve a marca.
--
-- Onibus: antes a divisao era so calculada na tela. Agora o numero de onibus e
-- os lugares ficam salvos (onibus_config); enquanto a divisao nao e fechada a
-- recepcao ve a mesma conta ao vivo. "Fechar a divisao" grava quem vai em qual
-- onibus (onibus_pessoas) e, fechada, o organizador muda cada pessoa a mao.
--
-- A conta de apoio nao le nenhuma tabela: tudo passa pelas funcoes abaixo.
-- A virada de edicao limpa presencas, onibus e a chamada.

-- 1) Area nova no login Apoio ------------------------------------------------
alter table public.apoio_auth drop constraint if exists apoio_auth_area_check;
alter table public.apoio_auth add constraint apoio_auth_area_check
  check (area = any (array['saude'::text, 'portaria'::text, 'recepcao'::text]));

do $$
declare
  v_def  text := pg_get_functiondef('public.criar_conta_apoio(text,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%''recepcao''%' then return; end if;
  v_novo := replace(v_def,
    $a$  if v_area not in ('saude', 'portaria') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha a área: saúde ou portaria.');$a$,
    $a$  if v_area not in ('saude', 'portaria', 'recepcao') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha a área: saúde, portaria ou recepção.');$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em criar_conta_apoio'; end if;
  execute v_novo;
end $$;

create or replace function public._mensagem_acesso_apoio(p_nome text, p_area text, p_senha text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select 'Acesso de apoio (' || case p_area when 'portaria' then 'portaria'
                                            when 'recepcao' then 'recepção dos acampantes'
                                            else 'saúde' end ||
         ') do Metanoia Radical Serra.' || chr(10) || chr(10) ||
         'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
         'Tipo de acesso: Apoio' || chr(10) ||
         'Usuário: ' || p_nome || chr(10) ||
         'Senha: ' || p_senha || chr(10) || chr(10) ||
         'Ao entrar, o sistema vai pedir para você criar a SUA senha ' ||
         '(mínimo 8 caracteres, com letras e números).';
$function$;

-- 2) Tabelas -------------------------------------------------------------------
-- Uma linha por pessoa: presenca e/ou observacao. Acampante ou infiltrado
-- (equipante); a linha sai junto com a ficha.
create table if not exists public.recepcao_presencas (
  id                 bigserial primary key,
  acampante_id       uuid unique references public.acampantes(id) on delete cascade,
  equipante_id       uuid unique references public.equipantes(id) on delete cascade,
  chegou_em          timestamptz,
  chegou_por         text,
  termo_ciente       boolean not null default false,
  responsavel_ciente boolean not null default false,
  observacao         text,
  observacao_em      timestamptz,
  observacao_por     text,
  constraint recepcao_presencas_uma_pessoa check ((acampante_id is null) <> (equipante_id is null))
);

-- Numero de onibus e lugares (uma linha so) + divisao fechada.
create table if not exists public.onibus_config (
  id             int primary key default 1 check (id = 1),
  numero         int not null default 4 check (numero between 1 and 10),
  lugares        int[] not null default '{}',
  fechada_em     timestamptz,
  fechada_por    text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);
insert into public.onibus_config (id) values (1) on conflict (id) do nothing;

-- Quem vai em qual onibus, depois de "Fechar a divisao".
create table if not exists public.onibus_pessoas (
  id           bigserial primary key,
  acampante_id uuid unique references public.acampantes(id) on delete cascade,
  equipante_id uuid unique references public.equipantes(id) on delete cascade,
  onibus       int not null check (onibus between 1 and 10),
  manual       boolean not null default false,
  definido_em  timestamptz not null default now(),
  definido_por text,
  constraint onibus_pessoas_uma_pessoa check ((acampante_id is null) <> (equipante_id is null))
);

-- Chamada encerrada (uma linha so).
create table if not exists public.recepcao_chamada (
  id           int primary key default 1 check (id = 1),
  encerrada_em timestamptz,
  encerrada_por text,
  reaberta_em  timestamptz,
  reaberta_por text
);
insert into public.recepcao_chamada (id) values (1) on conflict (id) do nothing;

alter table public.recepcao_presencas enable row level security;
alter table public.onibus_config      enable row level security;
alter table public.onibus_pessoas     enable row level security;
alter table public.recepcao_chamada   enable row level security;
revoke all on public.recepcao_presencas, public.onibus_config, public.onibus_pessoas, public.recepcao_chamada
  from anon, authenticated;
revoke all on sequence public.recepcao_presencas_id_seq, public.onibus_pessoas_id_seq from anon, authenticated;

-- 3) Quem esta logado ------------------------------------------------------------
create or replace function public._recepcao_logada()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.nome
    from public.apoio_auth c
   where public.eh_apoio('recepcao')
     and c.area = 'recepcao'
     and c.senha is not null
     and c.id::text = coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
   limit 1;
$function$;

create or replace function public._recepcao_quem()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
           when public._recepcao_logada() is not null then 'Recepção: ' || public._recepcao_logada()
           when public.eh_organizador() then coalesce(public._nome_organizador_logado(), 'organizador')
         end;
$function$;

-- Menor de 18 anos no primeiro dia do evento (sem data: hoje).
create or replace function public._recepcao_menor(p_nascimento date)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select p_nascimento is not null
     and p_nascimento > (coalesce((select c.data_evento_inicio from public.configuracoes c limit 1), current_date)
                         - interval '18 years')::date;
$function$;

-- Quem esta na chamada: acampantes da edicao + infiltrados da escala oficial
-- com cor (iguais aos grupos de trilha e aos onibus).
create or replace function public._recepcao_participantes()
 returns table (tipo text, id uuid, nome text, sexo text, nascimento date, igreja text, whatsapp text,
                grupo text, pago boolean, termo_inscricao boolean, emergencia_nome text,
                emergencia_telefone text, infiltrado boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select 'acampante', a.id, a.nome, a.sexo, a.data_nascimento, a.igreja, a.whatsapp,
         a.grupo_trailha,
         lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
         coalesce(a.termo_responsabilidade_aceito, false),
         a.contato_emergencia_nome, a.contato_emergencia_telefone, false
    from public.acampantes a
  union all
  select 'equipante', e.id, e.nome, e.sexo, e.data_nascimento, e.igreja,
         coalesce(nullif(e.whatsapp, ''), e.telefone),
         s.cor, true, true, e.contato_emergencia_nome, e.contato_emergencia_telefone, true
    from public.escalas s
    join public.equipantes e on e.id = s.equipante_id
   where s.area_alocada = 'Infiltrados'
     and s.cor is not null
     and exists (select 1 from public.configuracoes c where c.escala_oficial_em is not null);
$function$;

create or replace function public._recepcao_participa(p_tipo text, p_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public._recepcao_participantes() p where p.tipo = p_tipo and p.id = p_id);
$function$;

-- 4) Lista e assinatura ---------------------------------------------------------
create or replace function public.recepcao_lista()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_quem text := public._recepcao_quem();
  v_org  boolean := public.eh_organizador();
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'organizador', v_org,
    'pessoas', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'tipo', p.tipo, 'id', p.id, 'nome', p.nome, 'sexo', p.sexo,
        'idade', case when p.nascimento is null then null
                      else extract(year from age(coalesce((select c.data_evento_inicio from public.configuracoes c limit 1), current_date), p.nascimento))::int end,
        'menor', public._recepcao_menor(p.nascimento),
        'igreja', p.igreja, 'whatsapp', p.whatsapp, 'grupo', p.grupo,
        'pago', p.pago, 'termo_inscricao', p.termo_inscricao,
        'emergencia_nome', p.emergencia_nome, 'emergencia_telefone', p.emergencia_telefone,
        -- Sigilo: so o organizador sabe quem e infiltrado.
        'infiltrado', case when v_org and p.infiltrado then true end,
        'chegou_em', r.chegou_em, 'chegou_por', r.chegou_por,
        'termo_ciente', case when r.chegou_em is not null then r.termo_ciente end,
        'responsavel_ciente', case when r.chegou_em is not null then r.responsavel_ciente end,
        'observacao', r.observacao, 'observacao_em', r.observacao_em, 'observacao_por', r.observacao_por,
        'onibus', o.onibus, 'onibus_manual', case when o.manual then true end
      )) order by p.nome)
      from public._recepcao_participantes() p
      left join public.recepcao_presencas r
        on (p.tipo = 'acampante' and r.acampante_id = p.id) or (p.tipo = 'equipante' and r.equipante_id = p.id)
      left join public.onibus_pessoas o
        on (p.tipo = 'acampante' and o.acampante_id = p.id) or (p.tipo = 'equipante' and o.equipante_id = p.id)
    ), '[]'::jsonb),
    'onibus', (select jsonb_build_object('numero', c.numero, 'lugares', to_jsonb(c.lugares),
                                         'fechada_em', c.fechada_em, 'fechada_por', c.fechada_por)
                 from public.onibus_config c where c.id = 1),
    'chamada', (select jsonb_build_object('encerrada_em', c.encerrada_em, 'encerrada_por', c.encerrada_por,
                                          'reaberta_em', c.reaberta_em, 'reaberta_por', c.reaberta_por)
                  from public.recepcao_chamada c where c.id = 1)
  );
end;
$function$;

-- "Assinatura" curta: a tela so baixa a lista inteira quando ela muda.
create or replace function public.recepcao_versao()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when public._recepcao_quem() is null then null else md5(concat_ws('|',
    (select string_agg(concat_ws(':', p.tipo, p.id, p.nome, p.grupo, p.pago, p.whatsapp, p.nascimento,
                                 p.emergencia_nome, p.emergencia_telefone, p.igreja), ',' order by p.tipo, p.id)
       from public._recepcao_participantes() p),
    (select string_agg(concat_ws(':', r.id, r.chegou_em, r.observacao_em, r.observacao), ',' order by r.id)
       from public.recepcao_presencas r),
    (select string_agg(concat_ws(':', o.id, o.onibus), ',' order by o.id) from public.onibus_pessoas o),
    (select concat_ws(':', c.numero, c.lugares::text, c.fechada_em) from public.onibus_config c where c.id = 1),
    (select concat_ws(':', c.encerrada_em, c.reaberta_em) from public.recepcao_chamada c where c.id = 1),
    (select data_evento_inicio::text from public.configuracoes limit 1)
  )) end;
$function$;

-- Aviso do painel dos organizadores: chamada encerrada (null = aberta).
create or replace function public.recepcao_chamada_aviso()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when public.eh_organizador() then (
    select case when c.encerrada_em is null then null else jsonb_build_object(
      'encerrada_em', c.encerrada_em, 'encerrada_por', c.encerrada_por,
      'presentes', (select count(*) from public._recepcao_participantes() p
                      join public.recepcao_presencas r
                        on ((p.tipo = 'acampante' and r.acampante_id = p.id) or (p.tipo = 'equipante' and r.equipante_id = p.id))
                     where r.chegou_em is not null),
      'total', (select count(*) from public._recepcao_participantes())) end
      from public.recepcao_chamada c where c.id = 1) end;
$function$;

-- 5) Gravacoes da chamada --------------------------------------------------------
create or replace function public._recepcao_chamada_fechada()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.recepcao_chamada where id = 1 and encerrada_em is not null);
$function$;

create or replace function public.recepcao_marcar_presenca(p_tipo text, p_id uuid, p_termo boolean, p_responsavel boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem  text := public._recepcao_quem();
  v_nasc  date;
  v_linha public.recepcao_presencas%rowtype;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') or not public._recepcao_participa(p_tipo, p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Acampante não encontrado na chamada.');
  end if;
  if public._recepcao_chamada_fechada() and not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'A chamada foi encerrada. Peça a um organizador para reabrir.');
  end if;
  if p_termo is not true then
    return jsonb_build_object('ok', false, 'erro', 'Marque "ciente do termo de responsabilidade".');
  end if;

  select p.nascimento into v_nasc from public._recepcao_participantes() p where p.tipo = p_tipo and p.id = p_id;
  if public._recepcao_menor(v_nasc) and p_responsavel is not true then
    return jsonb_build_object('ok', false, 'erro', 'Menor de idade: marque "responsável ciente".');
  end if;

  select * into v_linha from public.recepcao_presencas
   where (p_tipo = 'acampante' and acampante_id = p_id) or (p_tipo = 'equipante' and equipante_id = p_id)
   for update;

  if found and v_linha.chegou_em is not null then
    return jsonb_build_object('ok', false, 'erro',
      format('Presença já marcada por %s às %s.', regexp_replace(coalesce(v_linha.chegou_por, '—'), '^Recepção: ', ''),
             to_char(v_linha.chegou_em at time zone 'America/Sao_Paulo', 'HH24:MI')));
  end if;

  if found then
    update public.recepcao_presencas
       set chegou_em = now(), chegou_por = v_quem, termo_ciente = true,
           responsavel_ciente = coalesce(p_responsavel, false)
     where id = v_linha.id;
  else
    begin
      insert into public.recepcao_presencas (acampante_id, equipante_id, chegou_em, chegou_por, termo_ciente, responsavel_ciente)
      values (case when p_tipo = 'acampante' then p_id end, case when p_tipo = 'equipante' then p_id end,
              now(), v_quem, true, coalesce(p_responsavel, false));
    exception when unique_violation then
      return jsonb_build_object('ok', false, 'erro', 'Outra pessoa da recepção acabou de marcar esta presença.');
    end;
  end if;

  return jsonb_build_object('ok', true, 'chegou_por', v_quem);
end;
$function$;

create or replace function public.recepcao_desfazer_presenca(p_tipo text, p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem  text := public._recepcao_quem();
  v_linha public.recepcao_presencas%rowtype;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if public._recepcao_chamada_fechada() and not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'A chamada foi encerrada. Peça a um organizador para reabrir.');
  end if;

  select * into v_linha from public.recepcao_presencas
   where (p_tipo = 'acampante' and acampante_id = p_id) or (p_tipo = 'equipante' and equipante_id = p_id)
   for update;
  if not found or v_linha.chegou_em is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta presença já não estava marcada.');
  end if;

  if v_linha.observacao is null then
    delete from public.recepcao_presencas where id = v_linha.id;
  else
    update public.recepcao_presencas
       set chegou_em = null, chegou_por = null, termo_ciente = false, responsavel_ciente = false
     where id = v_linha.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.recepcao_salvar_observacao(p_tipo text, p_id uuid, p_texto text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem  text := public._recepcao_quem();
  v_texto text := left(nullif(btrim(coalesce(p_texto, '')), ''), 500);
  v_linha public.recepcao_presencas%rowtype;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') or not public._recepcao_participa(p_tipo, p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Acampante não encontrado na chamada.');
  end if;

  select * into v_linha from public.recepcao_presencas
   where (p_tipo = 'acampante' and acampante_id = p_id) or (p_tipo = 'equipante' and equipante_id = p_id)
   for update;

  if found then
    if v_texto is null and v_linha.chegou_em is null then
      delete from public.recepcao_presencas where id = v_linha.id;
    else
      update public.recepcao_presencas
         set observacao = v_texto, observacao_em = case when v_texto is null then null else now() end,
             observacao_por = case when v_texto is null then null else v_quem end
       where id = v_linha.id;
    end if;
  elsif v_texto is not null then
    begin
      insert into public.recepcao_presencas (acampante_id, equipante_id, observacao, observacao_em, observacao_por)
      values (case when p_tipo = 'acampante' then p_id end, case when p_tipo = 'equipante' then p_id end,
              v_texto, now(), v_quem);
    exception when unique_violation then
      return jsonb_build_object('ok', false, 'erro', 'Outra pessoa mexeu neste acampante agora. Tente de novo.');
    end;
  end if;

  return jsonb_build_object('ok', true, 'texto', v_texto);
end;
$function$;

create or replace function public.recepcao_encerrar_chamada()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem text := public._recepcao_quem();
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if public._recepcao_chamada_fechada() then
    return jsonb_build_object('ok', false, 'erro', 'A chamada já estava encerrada.');
  end if;
  update public.recepcao_chamada set encerrada_em = now(), encerrada_por = v_quem where id = 1;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.recepcao_reabrir_chamada()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só um organizador reabre a chamada.');
  end if;
  if not public._recepcao_chamada_fechada() then
    return jsonb_build_object('ok', false, 'erro', 'A chamada já estava aberta.');
  end if;
  update public.recepcao_chamada
     set encerrada_em = null, encerrada_por = null, reaberta_em = now(),
         reaberta_por = coalesce(public._nome_organizador_logado(), 'organizador')
   where id = 1;
  return jsonb_build_object('ok', true);
end;
$function$;

-- 6) Onibus (so organizador) -------------------------------------------------------
create or replace function public.onibus_salvar_config(p_numero int, p_lugares int[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores dividem os ônibus.');
  end if;
  if p_numero is null or p_numero not between 1 and 10 then
    return jsonb_build_object('ok', false, 'erro', 'Número de ônibus entre 1 e 10.');
  end if;
  if exists (select 1 from public.onibus_config where id = 1 and fechada_em is not null) then
    return jsonb_build_object('ok', false, 'erro', 'A divisão está fechada. Desfaça a divisão para mudar o número de ônibus.');
  end if;
  update public.onibus_config
     set numero = p_numero,
         lugares = coalesce((select array_agg(case when l > 0 and l <= 999 then l else 0 end order by i)
                               from unnest(p_lugares[1:p_numero]) with ordinality u(l, i)), '{}'),
         atualizado_em = now(), atualizado_por = coalesce(public._nome_organizador_logado(), 'organizador')
   where id = 1;
  return jsonb_build_object('ok', true);
end;
$function$;

-- p_itens: [{tipo, id, onibus}] -- a divisao que a tela calculou.
create or replace function public.onibus_fechar_divisao(p_numero int, p_lugares int[], p_itens jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_qtd  int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores dividem os ônibus.');
  end if;
  if p_numero is null or p_numero not between 1 and 10 then
    return jsonb_build_object('ok', false, 'erro', 'Número de ônibus entre 1 e 10.');
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or exists (
       select 1 from jsonb_array_elements(p_itens) x
        where (x ->> 'onibus') !~ '^\d+$' or (x ->> 'onibus')::int not between 1 and p_numero
           or not public._recepcao_participa(x ->> 'tipo', (x ->> 'id')::uuid)) then
    return jsonb_build_object('ok', false, 'erro', 'A lista mudou enquanto a tela estava aberta. Feche e abra de novo.');
  end if;

  delete from public.onibus_pessoas where id is not null;
  insert into public.onibus_pessoas (acampante_id, equipante_id, onibus, manual, definido_por)
  select case when x ->> 'tipo' = 'acampante' then (x ->> 'id')::uuid end,
         case when x ->> 'tipo' = 'equipante' then (x ->> 'id')::uuid end,
         (x ->> 'onibus')::int, false, v_quem
    from (select distinct on (x ->> 'tipo', x ->> 'id') x from jsonb_array_elements(p_itens) x) d;
  get diagnostics v_qtd = row_count;

  update public.onibus_config
     set numero = p_numero,
         lugares = coalesce((select array_agg(case when l > 0 and l <= 999 then l else 0 end order by i)
                               from unnest(p_lugares[1:p_numero]) with ordinality u(l, i)), '{}'),
         fechada_em = now(), fechada_por = v_quem, atualizado_em = now(), atualizado_por = v_quem
   where id = 1;
  return jsonb_build_object('ok', true, 'pessoas', v_qtd);
end;
$function$;

-- Ajuste a mao depois de fechada. p_onibus null = tirar do onibus.
create or replace function public.onibus_mover(p_tipo text, p_id uuid, p_onibus int)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem   text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_numero int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores dividem os ônibus.');
  end if;
  select numero into v_numero from public.onibus_config where id = 1 and fechada_em is not null;
  if v_numero is null then
    return jsonb_build_object('ok', false, 'erro', 'Feche a divisão antes de mudar alguém de ônibus.');
  end if;
  if p_tipo not in ('acampante', 'equipante') or not public._recepcao_participa(p_tipo, p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Acampante não encontrado.');
  end if;
  if p_onibus is not null and p_onibus not between 1 and v_numero then
    return jsonb_build_object('ok', false, 'erro', format('Escolha um ônibus de 1 a %s.', v_numero));
  end if;

  delete from public.onibus_pessoas
   where (p_tipo = 'acampante' and acampante_id = p_id) or (p_tipo = 'equipante' and equipante_id = p_id);
  if p_onibus is not null then
    insert into public.onibus_pessoas (acampante_id, equipante_id, onibus, manual, definido_por)
    values (case when p_tipo = 'acampante' then p_id end, case when p_tipo = 'equipante' then p_id end,
            p_onibus, true, v_quem);
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.onibus_desfazer_divisao()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores dividem os ônibus.');
  end if;
  delete from public.onibus_pessoas where id is not null;
  update public.onibus_config
     set fechada_em = null, fechada_por = null, atualizado_em = now(),
         atualizado_por = coalesce(public._nome_organizador_logado(), 'organizador')
   where id = 1;
  return jsonb_build_object('ok', true);
end;
$function$;

-- 7) Permissoes -------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public._recepcao_logada()', 'public._recepcao_quem()', 'public._recepcao_menor(date)',
    'public._recepcao_participantes()', 'public._recepcao_participa(text,uuid)', 'public._recepcao_chamada_fechada()',
    'public.recepcao_lista()', 'public.recepcao_versao()', 'public.recepcao_chamada_aviso()',
    'public.recepcao_marcar_presenca(text,uuid,boolean,boolean)', 'public.recepcao_desfazer_presenca(text,uuid)',
    'public.recepcao_salvar_observacao(text,uuid,text)', 'public.recepcao_encerrar_chamada()',
    'public.recepcao_reabrir_chamada()', 'public.onibus_salvar_config(int,int[])',
    'public.onibus_fechar_divisao(int,int[],jsonb)', 'public.onibus_mover(text,uuid,int)',
    'public.onibus_desfazer_divisao()']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- 8) Virada de edicao limpa a recepcao e os onibus ------------------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);
  v_novo text;
begin
  if v_def like '%delete from public.recepcao_presencas%' then return; end if;
  v_novo := replace(v_def,
    $a$  delete from public.portaria_observacoes where inscricao_id is not null;
$a$,
    $a$  delete from public.portaria_observacoes where inscricao_id is not null;

  -- Recepcao dos acampantes e onibus da edicao velha (20261025g).
  delete from public.recepcao_presencas where id is not null;
  delete from public.onibus_pessoas where id is not null;
  update public.onibus_config set fechada_em = null, fechada_por = null where id = 1;
  update public.recepcao_chamada set encerrada_em = null, encerrada_por = null,
         reaberta_em = null, reaberta_por = null where id = 1;
$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em resetar_para_nova_edicao'; end if;
  execute v_novo;
end $$;
