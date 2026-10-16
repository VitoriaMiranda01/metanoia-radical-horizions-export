-- Acesso ao cadastro (16/10/2026, Patrick) -- substitui "Você foi inscrito
-- pela organização?".
--
-- Com as inscricoes de equipante FECHADAS, quem digita um CPF que nao esta na
-- base ve "Você já tem cadastro no sistema?". Sim -> informa o CPF correto ou
-- o nome completo:
--   * CPF que existe -> entra normalmente;
--   * nome igual (sem acento/maiusculas/espacos) com CPF -> "achamos, informe
--     o CPF correto"; errou de novo -> "Não consigo acessar meu cadastro";
--   * nome igual sem CPF (inscricao manual) -> "procure a organização" (e o
--     aviso chega a ela);
--   * nada -> "nome e CPF não encontrados".
-- Busca por NOME e pedido de ajuda so no dia da Reuniao de Leitura de Escala,
-- das 15h as 19h (Brasilia); fora disso so o CPF correto funciona.
-- 5 tentativas por aparelho por dia, contadas no servidor (e um teto por
-- IP, alto, porque na reuniao todo mundo usa o mesmo wifi).
--
-- Organizacao: pedidos em Gerenciar Inscricoes, para confirmar a identidade e
-- salvar o CPF na ficha (CPF de outro cadastro -> mostra os dois e escolhe qual
-- fica). E um painel de possiveis cadastros duplicados.
--
-- Configuracoes: datas da Reuniao de Inscricao e da Reuniao de Leitura de
-- Escala; a virada de edicao passa a exigir as duas.

alter table public.configuracoes
  add column if not exists reuniao_inscricao_em date,
  add column if not exists reuniao_leitura_escala_em date;

-- Edicao 37: a Reuniao de Inscricao ja aconteceu; Leitura de Escala em 18/10.
update public.configuracoes set reuniao_leitura_escala_em = date '2026-10-18'
 where edicao_numero = 37 and reuniao_leitura_escala_em is null;

create table if not exists public.tentativas_acesso_cadastro (
  id bigint generated always as identity primary key,
  dispositivo text not null,
  ip text,
  em timestamptz not null default now()
);
create index if not exists tentativas_acesso_cadastro_disp on public.tentativas_acesso_cadastro (dispositivo, em);
create index if not exists tentativas_acesso_cadastro_ip on public.tentativas_acesso_cadastro (ip, em);
alter table public.tentativas_acesso_cadastro enable row level security;

create table if not exists public.pedidos_acesso_cadastro (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_informado text,
  whatsapp text,
  motivo text not null default 'nao_consigo',      -- 'nao_consigo' | 'sem_cpf'
  dispositivo text,
  ip text,
  criado_em timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'resolvido', 'recusado')),
  equipante_id uuid references public.equipantes(id) on delete set null,
  resolvido_por text,
  resolvido_em timestamptz,
  observacao text
);
alter table public.pedidos_acesso_cadastro enable row level security;

create table if not exists public.duplicados_ignorados (
  a uuid not null,
  b uuid not null,
  por text,
  em timestamptz not null default now(),
  primary key (a, b)
);
alter table public.duplicados_ignorados enable row level security;

-- ------------------------------------------------------------------ apoio
create or replace function public._nome_normalizado(p text)
returns text language sql immutable set search_path = public as $$
  select public.unaccent_simples(lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))));
$$;

create or replace function public._janela_acesso_cadastro()
returns boolean language sql stable set search_path = public as $$
  select coalesce((
    select (now() at time zone 'America/Sao_Paulo')::date = c.reuniao_leitura_escala_em
       and (now() at time zone 'America/Sao_Paulo')::time >= time '15:00'
       and (now() at time zone 'America/Sao_Paulo')::time <  time '19:00'
      from public.configuracoes c limit 1), false);
$$;

create or replace function public._ip_da_requisicao()
returns text language sql stable as $$
  select nullif(btrim(split_part(coalesce(
           nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '');
$$;

-- Conta UMA tentativa e diz se ainda pode (5 por aparelho/dia, 60 por IP/dia).
create or replace function public._tentativa_acesso(p_dispositivo text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_disp text := left(coalesce(nullif(btrim(p_dispositivo), ''), 'sem-dispositivo'), 80);
  v_ip   text := public._ip_da_requisicao();
  v_n    int;
  v_nip  int;
begin
  select count(*) into v_n from public.tentativas_acesso_cadastro
   where dispositivo = v_disp and em > now() - interval '1 day';
  select count(*) into v_nip from public.tentativas_acesso_cadastro
   where v_ip is not null and ip = v_ip and em > now() - interval '1 day';
  if v_n >= 5 or v_nip >= 60 then
    return -1;
  end if;
  insert into public.tentativas_acesso_cadastro (dispositivo, ip) values (v_disp, v_ip);
  return 5 - (v_n + 1);   -- quantas ainda restam
end;
$$;

-- ------------------------------------------------------------------ publico
create or replace function public.acesso_cadastro_situacao()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('janela', public._janela_acesso_cadastro(),
                            'leitura_escala', (select reuniao_leitura_escala_em from public.configuracoes limit 1));
$$;

create or replace function public.acesso_cadastro_buscar(p_dispositivo text, p_cpf text default null, p_nome text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_nome text := public._nome_normalizado(p_nome);
  v_janela boolean := public._janela_acesso_cadastro();
  v_resta int;
  v_com_cpf boolean;
  v_sem_cpf boolean;
begin
  if v_cpf = '' and v_nome = '' then
    return jsonb_build_object('ok', false, 'erro', 'Informe o CPF ou o nome completo.');
  end if;
  if v_cpf = '' and not v_janela then
    return jsonb_build_object('ok', true, 'situacao', 'fora_do_horario');
  end if;
  if v_cpf = '' and (length(v_nome) < 5 or position(' ' in v_nome) = 0) then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o seu nome completo (nome e sobrenome).');
  end if;
  if v_cpf <> '' and not public._cpf_valido(v_cpf) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido. Confira os números.');
  end if;

  v_resta := public._tentativa_acesso(p_dispositivo);
  if v_resta < 0 then
    return jsonb_build_object('ok', true, 'situacao', 'limite', 'janela', v_janela);
  end if;

  if v_cpf <> '' then
    if exists (select 1 from public.equipantes e
                where e.tipo = 'equipante'
                  and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_cpf) then
      return jsonb_build_object('ok', true, 'situacao', 'cpf_ok');
    end if;
    return jsonb_build_object('ok', true, 'situacao', 'cpf_nao_encontrado', 'restam', v_resta, 'janela', v_janela);
  end if;

  -- So "achamos" / "nao achamos" -- nenhum dado da ficha sai daqui.
  select bool_or(nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '') is not null),
         bool_or(nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '') is null)
    into v_com_cpf, v_sem_cpf
    from public.equipantes e
   where e.tipo = 'equipante' and public._nome_normalizado(e.nome) = v_nome;

  return jsonb_build_object('ok', true, 'restam', v_resta, 'janela', true,
    'situacao', case when coalesce(v_com_cpf, false) then 'achou_com_cpf'
                     when coalesce(v_sem_cpf, false) then 'achou_sem_cpf'
                     else 'nao_encontrado' end);
end;
$$;

create or replace function public.acesso_cadastro_pedir(p_dispositivo text, p_nome text, p_cpf text, p_whatsapp text, p_motivo text default 'nao_consigo')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_disp text := left(coalesce(nullif(btrim(p_dispositivo), ''), 'sem-dispositivo'), 80);
  v_nome text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_cpf  text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_zap  text := public._telefone_normalizado(p_whatsapp, false, false);
begin
  if not public._janela_acesso_cadastro() then
    return jsonb_build_object('ok', false, 'erro',
      'Este pedido só pode ser feito no dia da Reunião de Leitura de Escala, das 15h às 19h. Procure a organização.');
  end if;
  if length(v_nome) < 5 or position(' ' in v_nome) = 0 or not public._nome_pessoa_valido(v_nome) then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o seu nome completo (nome e sobrenome).');
  end if;
  if v_cpf is not null and not public._cpf_valido(v_cpf) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido. Confira os números (ou deixe em branco).');
  end if;
  if v_zap is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe um WhatsApp válido, com DDD.');
  end if;
  if (select count(*) from public.pedidos_acesso_cadastro
       where dispositivo = v_disp and criado_em > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'erro', 'Você já enviou pedidos hoje. Procure a organização na reunião.');
  end if;

  insert into public.pedidos_acesso_cadastro (nome, cpf_informado, whatsapp, motivo, dispositivo, ip)
  values (v_nome, v_cpf, v_zap,
          case when p_motivo = 'sem_cpf' then 'sem_cpf' else 'nao_consigo' end,
          v_disp, public._ip_da_requisicao());
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------------ organizacao
create or replace function public._ficha_resumo(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'equipante_id', e.id, 'nome', e.nome, 'cpf', e.cpf, 'data_nascimento', e.data_nascimento,
    'whatsapp', e.whatsapp, 'igreja', e.igreja, 'igreja_outra', e.igreja_outra,
    'manual', e.inscricao_manual_em is not null, 'inscrito', coalesce(e.inscrito, false),
    'status', e.status, 'status_pagamento', e.status_pagamento,
    'pagamentos', (select count(*) from public.pagamentos p where p.equipante_id = e.id),
    'areas', (select coalesce(jsonb_agg(s.area_alocada order by s.area_alocada), '[]'::jsonb)
                from public.escalas s where s.equipante_id = e.id),
    'criado_em', e.created_at)
  from public.equipantes e where e.id = p_id;
$$;

create or replace function public.pedidos_acesso_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  return jsonb_build_object('ok', true, 'pedidos', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'cpf_informado', p.cpf_informado, 'whatsapp', p.whatsapp,
             'motivo', p.motivo, 'criado_em', p.criado_em, 'status', p.status,
             'resolvido_por', p.resolvido_por, 'resolvido_em', p.resolvido_em, 'observacao', p.observacao,
             'equipante', case when p.equipante_id is not null then public._ficha_resumo(p.equipante_id) end,
             -- Fichas candidatas: nome igual, ou mesmo primeiro e ultimo nome,
             -- ou o CPF que a pessoa digitou.
             'candidatos', (
               select coalesce(jsonb_agg(public._ficha_resumo(e.id) order by e.inscrito desc nulls last, e.nome), '[]'::jsonb)
                 from public.equipantes e
                where e.tipo = 'equipante'
                  and (public._nome_normalizado(e.nome) = public._nome_normalizado(p.nome)
                       or (split_part(public._nome_normalizado(e.nome), ' ', 1) = split_part(public._nome_normalizado(p.nome), ' ', 1)
                           and regexp_replace(public._nome_normalizado(e.nome), '^.* ', '')
                               = regexp_replace(public._nome_normalizado(p.nome), '^.* ', ''))
                       or (p.cpf_informado is not null
                           and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = p.cpf_informado)))
           ) order by (p.status = 'pendente') desc, p.criado_em desc), '[]'::jsonb)
      from public.pedidos_acesso_cadastro p
     where p.status = 'pendente' or p.criado_em > now() - interval '7 days'));
end;
$$;

-- Junta duas fichas da mesma pessoa: fica p_manter, some p_apagar. A escala
-- de quem some passa para quem fica (sem repetir area), e o que faltar na
-- ficha que fica (CPF, nascimento, WhatsApp, sexo) vem da outra.
create or replace function public._juntar_fichas(p_manter uuid, p_apagar uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.equipantes;
  a public.equipantes;
begin
  if p_manter is null or p_apagar is null or p_manter = p_apagar then
    return jsonb_build_object('ok', false, 'erro', 'Escolha duas fichas diferentes.');
  end if;
  select * into m from public.equipantes where id = p_manter;
  select * into a from public.equipantes where id = p_apagar;
  if m.id is null or a.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Ficha não encontrada.');
  end if;
  if exists (select 1 from public.pagamentos where equipante_id = a.id)
     or lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed') then
    return jsonb_build_object('ok', false, 'erro',
      format('%s tem pagamento registrado. Fique com essa ficha (ou resolva o pagamento antes).', a.nome));
  end if;
  if coalesce(a.inscrito, false) and not coalesce(m.inscrito, false) then
    return jsonb_build_object('ok', false, 'erro',
      'A ficha que sumiria está inscrita nesta edição e a outra não. Fique com a inscrita: os dados que faltarem nela vêm da outra.');
  end if;

  update public.escalas s set equipante_id = m.id
   where s.equipante_id = a.id
     and not exists (select 1 from public.escalas x where x.equipante_id = m.id and x.area_alocada = s.area_alocada);
  update public.disponibilidade_extra d set equipante_id = m.id
   where d.equipante_id = a.id
     and not exists (select 1 from public.disponibilidade_extra x where x.equipante_id = m.id and x.area = d.area);
  update public.pedidos_acesso_cadastro set equipante_id = m.id where equipante_id = a.id;

  delete from public.equipantes where id = a.id;

  update public.equipantes set
    cpf             = coalesce(nullif(btrim(coalesce(cpf, '')), ''), a.cpf),
    data_nascimento = coalesce(data_nascimento, a.data_nascimento),
    whatsapp        = coalesce(nullif(btrim(coalesce(whatsapp, '')), ''), a.whatsapp),
    sexo            = coalesce(nullif(btrim(coalesce(sexo, '')), ''), a.sexo)
   where id = m.id;

  return jsonb_build_object('ok', true, 'mantida', m.id, 'apagada', a.id, 'nome_apagado', a.nome);
end;
$$;

-- Acoes no pedido:
--   'vincular'  -> confirma a identidade e salva p_cpf na ficha p_equipante_id
--                  (p_trocar = true troca um CPF que ja estava la);
--   'juntar'    -> o CPF e de outra ficha: fica p_equipante_id, some p_apagar;
--   'recusar'   -> nao era a pessoa / nao vai ser feito.
create or replace function public.pedido_acesso_resolver(p_pedido uuid, p_acao text, p_equipante_id uuid default null,
                                                         p_cpf text default null, p_trocar boolean default false,
                                                         p_apagar uuid default null, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_org text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  e public.equipantes;
  v_outro uuid;
  r jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if not exists (select 1 from public.pedidos_acesso_cadastro where id = p_pedido) then
    return jsonb_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  end if;

  if p_acao = 'recusar' then
    update public.pedidos_acesso_cadastro
       set status = 'recusado', resolvido_por = v_org, resolvido_em = now(), observacao = nullif(btrim(coalesce(p_observacao, '')), '')
     where id = p_pedido;
    return jsonb_build_object('ok', true);
  end if;

  if p_acao = 'juntar' then
    r := public._juntar_fichas(p_equipante_id, p_apagar);
    if not (r->>'ok')::boolean then return r; end if;
    -- segue para vincular o CPF na ficha que ficou (se ainda faltar)
  elsif p_acao <> 'vincular' then
    return jsonb_build_object('ok', false, 'erro', 'Ação inválida.');
  end if;

  select * into e from public.equipantes where id = p_equipante_id;
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Escolha a ficha da pessoa.');
  end if;
  if not public._cpf_valido(v_cpf) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido. Confira com a pessoa.');
  end if;

  select x.id into v_outro from public.equipantes x
   where x.id <> e.id and regexp_replace(coalesce(x.cpf, ''), '\D', '', 'g') = v_cpf limit 1;
  if v_outro is not null then
    return jsonb_build_object('ok', false, 'conflito', true,
      'erro', 'Esse CPF já é de outro cadastro. Escolha qual ficha fica.',
      'esta', public._ficha_resumo(e.id), 'outra', public._ficha_resumo(v_outro));
  end if;

  if nullif(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g'), '') is not null
     and regexp_replace(e.cpf, '\D', '', 'g') <> v_cpf and not p_trocar then
    return jsonb_build_object('ok', false, 'trocar', true,
      'erro', format('Esta ficha já tem outro CPF (%s). Confirme para trocar.', e.cpf));
  end if;

  update public.equipantes set cpf = v_cpf where id = e.id
     and regexp_replace(coalesce(cpf, ''), '\D', '', 'g') is distinct from v_cpf;

  update public.pedidos_acesso_cadastro
     set status = 'resolvido', equipante_id = e.id, resolvido_por = v_org, resolvido_em = now(),
         observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   where id = p_pedido;

  return jsonb_build_object('ok', true, 'equipante', public._ficha_resumo(e.id));
end;
$$;

-- ------------------------------------------------------------------ duplicados
create or replace function public.possiveis_duplicados()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  return jsonb_build_object('ok', true, 'pares', (
    with base as (
      select e.id, e.inscrito, public._nome_normalizado(e.nome) as n,
             e.data_nascimento as nasc,
             nullif(right(regexp_replace(coalesce(e.whatsapp, ''), '\D', '', 'g'), 9), '') as zap
        from public.equipantes e where e.tipo = 'equipante'
    ), pares as (
      select distinct least(x.id, y.id) as a, greatest(x.id, y.id) as b,
             case when x.n = y.n then 'mesmo nome'
                  when x.nasc = y.nasc then 'mesmo primeiro e último nome e mesma data de nascimento'
                  else 'mesmo WhatsApp e mesmo primeiro nome' end as motivo
        from base x join base y on x.id < y.id
       where (coalesce(x.inscrito, false) or coalesce(y.inscrito, false))
         and (x.n = y.n
              or (x.nasc is not null and x.nasc = y.nasc
                  and split_part(x.n, ' ', 1) = split_part(y.n, ' ', 1)
                  and regexp_replace(x.n, '^.* ', '') = regexp_replace(y.n, '^.* ', ''))
              or (x.zap is not null and x.zap = y.zap and length(x.zap) = 9
                  and split_part(x.n, ' ', 1) = split_part(y.n, ' ', 1)))
    )
    select coalesce(jsonb_agg(jsonb_build_object('motivo', p.motivo,
             'a', public._ficha_resumo(p.a), 'b', public._ficha_resumo(p.b)) order by p.motivo, p.a), '[]'::jsonb)
      from pares p
     where not exists (select 1 from public.duplicados_ignorados i where i.a = p.a and i.b = p.b)));
end;
$$;

create or replace function public.duplicado_resolver(p_a uuid, p_b uuid, p_acao text, p_manter uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_acao = 'nao_e' then
    insert into public.duplicados_ignorados (a, b, por)
    values (least(p_a, p_b), greatest(p_a, p_b), public._nome_organizador_logado())
    on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;
  if p_acao = 'juntar' and p_manter in (p_a, p_b) then
    return public._juntar_fichas(p_manter, case when p_manter = p_a then p_b else p_a end);
  end if;
  return jsonb_build_object('ok', false, 'erro', 'Ação inválida.');
end;
$$;

-- ------------------------------------------------------------------ datas
create or replace function public.definir_datas_reunioes(p_inscricao date, p_leitura date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  update public.configuracoes set reuniao_inscricao_em = p_inscricao, reuniao_leitura_escala_em = p_leitura
   where id is not null;
  return jsonb_build_object('ok', true);
end;
$$;

-- A virada de edicao passa a exigir as duas datas da nova edicao.
drop function if exists public.resetar_para_nova_edicao(integer);
create or replace function public.resetar_para_nova_edicao(p_nova_edicao integer, p_reuniao_inscricao date, p_reuniao_leitura date)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_equipantes int;
  v_acampantes int;
  v_escalas    int;
  v_edicao_ant int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas organizadores podem resetar a edição.');
  end if;

  if p_nova_edicao is null or p_nova_edicao < 1 then
    return jsonb_build_object('ok', false, 'erro',
      'Informe o número da nova edição.');
  end if;

  if p_reuniao_inscricao is null or p_reuniao_leitura is null then
    return jsonb_build_object('ok', false, 'erro',
      'Informe as datas da Reunião de Inscrição e da Reunião de Leitura de Escala da nova edição.');
  end if;

  select c.edicao_numero into v_edicao_ant from public.configuracoes c limit 1;

  if p_nova_edicao <= coalesce(v_edicao_ant, 0) then
    return jsonb_build_object('ok', false, 'erro', format(
      'A nova edição precisa ser maior que a atual (%s).', v_edicao_ant));
  end if;

  update public.equipantes q
     set ja_trabalhou_equipe = true,
         edicao_trabalhou    = coalesce(nullif(btrim(coalesce(q.edicao_trabalhou,'')), ''),
                                        v_edicao_ant::text)
   where exists (
     select 1 from public.escalas s
      where s.equipante_id = q.id
        and s.area_alocada <> 'Não será escalado');

  delete from public.lotes_alocacao_automatica where id is not null;
  delete from public.escalas where id is not null;
  get diagnostics v_escalas = row_count;

  delete from public.pix_sicoob where id is not null;
  delete from public.pagamentos where id is not null;

  delete from public.acampantes_vinculos where id is not null;
  delete from public.acampantes where id is not null;
  get diagnostics v_acampantes = row_count;

  update public.equipantes set
    inscrito               = false,
    status                 = 'pendente',
    scale_status           = 'pendente',
    status_pagamento       = 'pendente',
    data_pagamento         = null,
    metodo_pagamento       = null,
    id_transacao_sicoob    = null,
    txid_pix               = null,
    parental_auth_file_url = null,
    area_trabalho_opcao1   = null,
    area_trabalho_opcao2   = null,
    area_trabalho_opcao3   = null,
    area_trabalho_extra    = null,
    autorizacao_entregue_em        = null,
    autorizacao_conferida_em       = null,
    autorizacao_conferida_por      = null,
    autorizacao_conferida_por_tipo = null,
    decidido_por           = null,
    decidido_por_tipo      = null,
    decidido_por_igreja    = null,
    decidido_em            = null,
    inscrito_em            = null,
    pagamento_valor          = null,
    pagamento_cupom          = null,
    pagamento_desconto       = null,
    pagamento_confirmado_por = null
  where tipo = 'equipante';

  update public.cupons set ativo = false where ativo;
  get diagnostics v_equipantes = row_count;

  update public.configuracoes set
    edicao_numero          = p_nova_edicao,
    escala_lancada_em      = null,
    escala_oficial_em      = null,
    inscricoes_equipantes  = false,
    permite_igreja_outra   = false,
    permite_igreja_diversos = false,
    permite_completar_cadastro_manual = true,
    inscricoes_acampantes  = false,
    escala_ordem           = 'cadastro',
    reuniao_inscricao_em   = p_reuniao_inscricao,
    reuniao_leitura_escala_em = p_reuniao_leitura
  where id is not null;

  return jsonb_build_object(
    'ok', true,
    'edicao_anterior', v_edicao_ant,
    'nova_edicao', p_nova_edicao,
    'equipantes_liberados', v_equipantes,
    'acampantes_apagados', v_acampantes,
    'escalas_apagadas', v_escalas);
end;
$$;

-- ------------------------------------------------------------------ permissoes
revoke all on function public._tentativa_acesso(text), public._juntar_fichas(uuid, uuid),
  public._ficha_resumo(uuid) from public, anon, authenticated;
grant execute on function public.acesso_cadastro_situacao(),
  public.acesso_cadastro_buscar(text, text, text),
  public.acesso_cadastro_pedir(text, text, text, text, text) to anon, authenticated;
grant execute on function public.pedidos_acesso_listar(),
  public.pedido_acesso_resolver(uuid, text, uuid, text, boolean, uuid, text),
  public.possiveis_duplicados(), public.duplicado_resolver(uuid, uuid, text, uuid),
  public.definir_datas_reunioes(date, date),
  public.resetar_para_nova_edicao(integer, date, date) to authenticated;
