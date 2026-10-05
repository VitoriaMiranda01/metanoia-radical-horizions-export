-- ---------------------------------------------------------------------------
-- Ajustes do Patrick na relacao do lider (05/10/2026, depois da 1a versao)
--
-- 1. PAGAMENTO abre ja na escala PROVISORIA (antes esperava a oficial).
-- 2. A revelacao da area diz se a pessoa e LIDER (eh_lider em cada area).
-- 3. SEM CODIGO de lider: o lider abre a relacao so com a prova de dono do
--    acompanhamento (CPF, ou nome + nascimento). E o lider NAO puxa mais
--    ninguem pelo CPF -- quem manda gente para a area sao os organizadores,
--    pela Geracao de Escalas (alocar da fila / Trocar de area). Saem a
--    tabela codigos_lider e as funcoes de codigo e de busca por CPF.
-- 4. AUSENTES: nao saem da escala sozinhos, mas tambem nao ficam
--    misturados. Cada ausente fica "a definir" num quadro do Dudu, que
--    decide: MANTER na area (algumas vezes a pessoa entra mesmo ausente) ou
--    SEPARAR -- vai para "Não será escalado", guardando de qual area saiu
--    (escalas.separado_de), e pode voltar depois por "Trocar de área".
--    Nada e apagado.
-- ---------------------------------------------------------------------------

-- 4. Colunas da decisao sobre o ausente
alter table public.chamada_escala
  add column if not exists mantido_em  timestamptz,
  add column if not exists mantido_por text;
alter table public.escalas
  add column if not exists separado_de text,
  add column if not exists separado_em timestamptz;

comment on column public.chamada_escala.mantido_em is
  'Ausente que o organizador decidiu MANTER na area mesmo assim. Sai do quadro "a definir".';
comment on column public.escalas.separado_de is
  'Area de onde a pessoa saiu por ter ficado ausente na chamada (agora esta em "Não será escalado").';


-- 1. Pagamento na provisoria
do $do$
declare
  v_def text := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  v_velho text := E'                  and v_oficial is not null\n';
begin
  if (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho) <> 1 then
    raise exception 'ancora de situacao_inscricao nao e unica';
  end if;
  execute replace(v_def, v_velho, '');
end;
$do$;


-- 2. Revelacao: eh_lider em cada area
do $do$
declare
  v_def text := pg_get_functiondef('public.revelar_area(uuid,text,text,date)'::regprocedure);
  v_velho text := $v$'area', s.area_alocada, 'atuacao', s.atuacao, 'cor', s.cor)$v$;
  v_novo  text := $v$'area', s.area_alocada, 'atuacao', s.atuacao, 'cor', s.cor,
             'eh_lider', public._eh_lider(s.area_alocada, s.atuacao))$v$;
begin
  if (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho) <> 1 then
    raise exception 'ancora de revelar_area nao e unica';
  end if;
  execute replace(v_def, v_velho, v_novo);
end;
$do$;


-- 3. Sem codigo: fora o que era do codigo e da busca por CPF
drop function if exists public.relacao_lider(uuid, text, text, date, text);
drop function if exists public.lider_marcar_presenca(uuid, text, text, date, text, uuid, boolean);
drop function if exists public.lider_salvar_grupo(uuid, text, text, date, text, uuid, text);
drop function if exists public.lider_marcar_convite(uuid, text, text, date, text, uuid);
drop function if exists public.lider_buscar_cpf(uuid, text, text, date, text, text);
drop function if exists public.lider_adicionar_por_cpf(uuid, text, text, date, text, uuid, text);
drop function if exists public._busca_para_lider(text);
drop function if exists public.codigos_lideres();
drop function if exists public.gerar_novo_codigo_lider(uuid);
drop function if exists public._codigo_novo();
drop function if exists public._lider_autenticado(uuid, text, text, date, text);

do $do$
declare
  v_def text := pg_get_functiondef('public.resetar_para_nova_edicao(integer)'::regprocedure);
  v_velho text := E'  delete from public.codigos_lider where equipante_id is not null;\n';
begin
  if (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho) <> 1 then
    raise exception 'ancora de resetar_para_nova_edicao nao e unica';
  end if;
  execute replace(v_def, v_velho, '');
end;
$do$;

drop table if exists public.codigos_lider;

-- Confere o lider: escala provisoria lancada, prova de dono e estar como
-- lider em alguma area.
create or replace function public._lider_autenticado(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
begin
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'A escala ainda não foi lançada.');
  end if;
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;
  if not exists (select 1 from public.escalas s
                  where s.equipante_id = p_id and public._eh_lider(s.area_alocada, s.atuacao)) then
    return jsonb_build_object('ok', false, 'erro', 'Você não está como líder na escala.');
  end if;
  return jsonb_build_object('ok', true,
    'nome', (select nome from public.equipantes where id = p_id));
end;
$fn$;
revoke all on function public._lider_autenticado(uuid, text, text, date) from public, anon, authenticated;

create or replace function public.relacao_lider(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_equipes jsonb;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'escala_id', l.id,
           'area', l.area_alocada,
           'cor', case when public._area_com_cor(l.area_alocada) then l.cor end,
           'atuacao', l.atuacao,
           'grupo_link', (select g.link from public.grupos_lider g where g.escala_id = l.id),
           'membros', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'escala_id', s.id,
                      'equipante_id', q.id,
                      'nome', q.nome,
                      'igreja', q.igreja,
                      'igreja_outra', q.igreja_outra,
                      'whatsapp', q.whatsapp,
                      'estrangeiro', nullif(regexp_replace(coalesce(q.cpf,''), '\D', '', 'g'), '') is null,
                      'atuacao', s.atuacao,
                      'cor', s.cor,
                      'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
                      'eu', q.id = p_id,
                      'entrou_em', s.created_at,
                      'pendencias', public._pendencias_relacao(q.id),
                      'presente', c.presente,
                      'marcado_por', c.marcado_por,
                      'marcado_em', c.marcado_em,
                      'convite_enviado_em', c.convite_enviado_em)
                    order by q.nome), '[]'::jsonb)
               from public.escalas s
               join public.equipantes q on q.id = s.equipante_id
               left join public.chamada_escala c
                      on c.escala_id = s.id and c.area = s.area_alocada
              where public._na_equipe(l.id, s.id))
         ) order by l.area_alocada, l.cor), '[]'::jsonb)
    into v_equipes
    from public.escalas l
   where l.equipante_id = p_id
     and public._eh_lider(l.area_alocada, l.atuacao);

  return jsonb_build_object('ok', true,
    'lider', v_auth->>'nome',
    'escala_oficial', (select escala_oficial_em is not null from public.configuracoes limit 1),
    'equipes', v_equipes);
end;
$fn$;
revoke all on function public.relacao_lider(uuid, text, text, date) from public;
grant execute on function public.relacao_lider(uuid, text, text, date) to anon, authenticated;

create or replace function public.lider_marcar_presenca(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date,
  p_escala_id uuid, p_presente boolean)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_area text;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if public._lider_da_participacao(p_id, p_escala_id) is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;

  select area_alocada into v_area from public.escalas where id = p_escala_id;

  if p_presente is null then
    delete from public.chamada_escala where escala_id = p_escala_id;
  else
    insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
    values (p_escala_id, v_area, p_presente, v_auth->>'nome', now())
    on conflict (escala_id) do update
      set area = excluded.area,
          presente = excluded.presente,
          marcado_por = excluded.marcado_por,
          marcado_em = excluded.marcado_em,
          -- mudou a marcacao: a decisao do organizador sobre o ausente
          -- (manter) deixa de valer, e o convite so vale para presente.
          mantido_em  = case when chamada_escala.presente = excluded.presente
                              and chamada_escala.area = excluded.area
                             then chamada_escala.mantido_em end,
          mantido_por = case when chamada_escala.presente = excluded.presente
                              and chamada_escala.area = excluded.area
                             then chamada_escala.mantido_por end,
          convite_enviado_em = case when excluded.presente
                                    and chamada_escala.area = excluded.area
                                    then chamada_escala.convite_enviado_em end;
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.lider_marcar_presenca(uuid, text, text, date, uuid, boolean) from public;
grant execute on function public.lider_marcar_presenca(uuid, text, text, date, uuid, boolean) to anon, authenticated;

create or replace function public.lider_salvar_grupo(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date,
  p_escala_lider uuid, p_link text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_link text := btrim(coalesce(p_link, ''));
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public.escalas
                  where id = p_escala_lider and equipante_id = p_id
                    and public._eh_lider(area_alocada, atuacao)) then
    return jsonb_build_object('ok', false, 'erro', 'Equipe não encontrada.');
  end if;

  if v_link = '' then
    delete from public.grupos_lider where escala_id = p_escala_lider;
    return jsonb_build_object('ok', true, 'link', null);
  end if;

  v_link := regexp_replace(v_link, '\?.*$', '');
  if v_link !~ '^https://chat\.whatsapp\.com/(invite/)?[A-Za-z0-9]{15,30}$' then
    return jsonb_build_object('ok', false, 'erro',
      'Cole o link de convite do grupo (começa com https://chat.whatsapp.com/).');
  end if;

  insert into public.grupos_lider (escala_id, link) values (p_escala_lider, v_link)
  on conflict (escala_id) do update set link = excluded.link, atualizado_em = now();

  return jsonb_build_object('ok', true, 'link', v_link);
end;
$fn$;
revoke all on function public.lider_salvar_grupo(uuid, text, text, date, uuid, text) from public;
grant execute on function public.lider_salvar_grupo(uuid, text, text, date, uuid, text) to anon, authenticated;

create or replace function public.lider_marcar_convite(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_eq uuid;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if public._lider_da_participacao(p_id, p_escala_id) is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;

  select s.equipante_id into v_eq from public.escalas s where s.id = p_escala_id;
  if jsonb_array_length(public._pendencias_relacao(v_eq)) > 0 then
    return jsonb_build_object('ok', false, 'erro', 'A pessoa ainda tem pendência no cadastro.');
  end if;

  update public.chamada_escala c
     set convite_enviado_em = now()
    from public.escalas s
   where c.escala_id = p_escala_id and s.id = c.escala_id
     and c.area = s.area_alocada and c.presente;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Marque a presença antes de enviar o convite.');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.lider_marcar_convite(uuid, text, text, date, uuid) from public;
grant execute on function public.lider_marcar_convite(uuid, text, text, date, uuid) to anon, authenticated;


-- 4. Ausentes: quadro do organizador e a decisao
create or replace function public.chamada_da_escala()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;

  return jsonb_build_object('ok', true,
    -- Ausentes ainda na area, sem decisao.
    'ausentes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'escala_id', s.id, 'equipante_id', q.id, 'nome', q.nome,
               'whatsapp', q.whatsapp, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra,
               'area', s.area_alocada, 'cor', s.cor, 'atuacao', s.atuacao,
               'pago', lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed'),
               'marcado_por', c.marcado_por, 'marcado_em', c.marcado_em)
             order by s.area_alocada, q.nome), '[]'::jsonb)
        from public.chamada_escala c
        join public.escalas s on s.id = c.escala_id and s.area_alocada = c.area
        join public.equipantes q on q.id = s.equipante_id
       where not c.presente and c.mantido_em is null),
    -- Ausentes que o organizador decidiu manter na area.
    'mantidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'escala_id', s.id, 'nome', q.nome, 'area', s.area_alocada,
               'mantido_por', c.mantido_por, 'mantido_em', c.mantido_em)
             order by q.nome), '[]'::jsonb)
        from public.chamada_escala c
        join public.escalas s on s.id = c.escala_id and s.area_alocada = c.area
        join public.equipantes q on q.id = s.equipante_id
       where not c.presente and c.mantido_em is not null),
    -- Separados por ausencia: hoje em "Não será escalado".
    'separados', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'escala_id', s.id, 'equipante_id', q.id, 'nome', q.nome,
               'whatsapp', q.whatsapp, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra,
               'separado_de', s.separado_de, 'separado_em', s.separado_em,
               'pago', lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed'))
             order by q.nome), '[]'::jsonb)
        from public.escalas s
        join public.equipantes q on q.id = s.equipante_id
       where s.area_alocada = 'Não será escalado' and s.separado_de is not null),
    'por_area', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'area', area, 'total', total, 'presentes', presentes, 'ausentes', ausentes)
             order by area), '[]'::jsonb)
        from (
          select s.area_alocada as area, count(*) as total,
                 count(*) filter (where c.presente) as presentes,
                 count(*) filter (where c.presente = false) as ausentes
            from public.escalas s
            left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
           where s.area_alocada <> 'Não será escalado'
           group by s.area_alocada) t));
end;
$fn$;
revoke all on function public.chamada_da_escala() from public, anon;
grant execute on function public.chamada_da_escala() to authenticated;

-- p_acao: 'manter' (fica na area) | 'separar' (vai para "Não será escalado")
create or replace function public._decidir_ausente(p_escala_id uuid, p_acao text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  s public.escalas;
  v_nse uuid;
  r jsonb;
begin
  select * into s from public.escalas where id = p_escala_id;
  if s.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Participação não encontrada.');
  end if;
  if not exists (select 1 from public.chamada_escala c
                  where c.escala_id = s.id and c.area = s.area_alocada and not c.presente) then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está como ausente nesta área.');
  end if;

  if p_acao = 'manter' then
    update public.chamada_escala
       set mantido_em = now(), mantido_por = public._nome_organizador_logado()
     where escala_id = s.id;
    return jsonb_build_object('ok', true);
  end if;

  if p_acao <> 'separar' then
    return jsonb_build_object('ok', false, 'erro', 'Ação desconhecida.');
  end if;

  -- Ja esta em "Não será escalado" por outra area (ausente em duas)? Junta
  -- as duas origens numa linha so.
  select e.id into v_nse from public.escalas e
   where e.equipante_id = s.equipante_id and e.area_alocada = 'Não será escalado';
  if v_nse is not null then
    update public.escalas
       set separado_de = concat_ws(', ', separado_de, s.area_alocada),
           separado_em = coalesce(separado_em, now())
     where id = v_nse;
    delete from public.escalas where id = s.id;
    return jsonb_build_object('ok', true);
  end if;

  r := public.realocar_alocacao(s.id, 'Não será escalado');
  if not (r->>'ok')::boolean then
    return r;
  end if;
  update public.escalas
     set separado_de = s.area_alocada, separado_em = now(),
         incluido_por = 'Separado (ausente): ' || public._nome_organizador_logado()
   where id = s.id;
  -- A marca de ausente ja cumpriu o papel (o registro fica em separado_de).
  -- Sem apagar, quem voltasse para a mesma area reapareceria como ausente
  -- "a definir".
  delete from public.chamada_escala where escala_id = s.id;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public._decidir_ausente(uuid, text) from public, anon, authenticated;

create or replace function public.decidir_ausente(p_escala_id uuid, p_acao text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));
  return public._decidir_ausente(p_escala_id, p_acao);
end;
$fn$;
revoke all on function public.decidir_ausente(uuid, text) from public, anon;
grant execute on function public.decidir_ausente(uuid, text) to authenticated;

-- "Separar todos os ausentes a definir" de uma vez.
create or replace function public.separar_ausentes()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v record; r jsonb; v_ok int := 0; v_erros jsonb := '[]'::jsonb;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));
  for v in
    select s.id, q.nome from public.chamada_escala c
      join public.escalas s on s.id = c.escala_id and s.area_alocada = c.area
      join public.equipantes q on q.id = s.equipante_id
     where not c.presente and c.mantido_em is null
  loop
    r := public._decidir_ausente(v.id, 'separar');
    if (r->>'ok')::boolean then v_ok := v_ok + 1;
    else v_erros := v_erros || jsonb_build_array(v.nome || ': ' || coalesce(r->>'erro', '?'));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'separados', v_ok, 'erros', v_erros);
end;
$fn$;
revoke all on function public.separar_ausentes() from public, anon;
grant execute on function public.separar_ausentes() to authenticated;

-- Trocar de area tira a marca de "separado" (a pessoa voltou para a escala).
create or replace function public.trocar_area_escala(p_escala_id uuid, p_nova_area text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare r jsonb;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro',
      'A troca de área abre depois que a escala provisória for lançada.');
  end if;

  r := public.realocar_alocacao(p_escala_id, p_nova_area);
  if (r->>'ok')::boolean then
    update public.escalas
       set incluido_por = 'Troca: ' || public._nome_organizador_logado(),
           separado_de = case when area_alocada = 'Não será escalado' then separado_de end,
           separado_em = case when area_alocada = 'Não será escalado' then separado_em end
     where id = p_escala_id;
  end if;
  return r;
end;
$fn$;
