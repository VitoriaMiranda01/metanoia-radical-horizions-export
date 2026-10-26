-- PAGAMENTO AGENDADO do equipante: portaria + debito que atravessa a edicao
-- (25/10/2026, Patrick).
--
-- O agendamento ja existia (20261019l: cobrancas_equipantes, so organizador,
-- data livre, acompanhamento mostra "agendado para dd/mm", pagou = sai sozinho).
-- Esta migration acrescenta:
--  * Portaria: quem tem pagamento agendado aparece com a data e pode ter a
--    ENTRADA liberada sem pagar (portaria_lista / portaria_liberar_entrada /
--    portaria_versao). Continua "em aberto"; "Pagar agora" segue disponivel.
--  * Debito: na virada (resetar_para_nova_edicao), quem estava AGENDADO e nao
--    pagou vira uma linha em debitos_equipantes (edicao, data combinada, valor
--    previsto, se entrou pela portaria). Toda cobranca da edicao velha e
--    apagada (antes ela sobrevivia a virada e reaparecia na edicao nova).
--  * Trava: com debito em aberto o equipante nao se inscreve (criar_inscricao
--    -> DEBITO_PENDENTE; verificar_inscricao avisa ja no CPF com 'debito').
--    So o organizador libera: "autorizar inscricao" vale para a edicao atual e
--    o debito continua em aberto ate quitar.
--  * Organizador: debitos_listar, debito_quitar, debito_autorizar,
--    debito_retirar (lancado por engano, motivo obrigatorio).
-- Inscricao manual pelo organizador NAO trava: o proprio organizador e a
-- autorizacao.

create table if not exists public.debitos_equipantes (
  id                 bigint generated always as identity primary key,
  equipante_id       uuid not null references public.equipantes(id) on delete cascade,
  edicao             int not null,
  agendado_para      date,
  observacao         text,
  agendado_por       text,
  valor_previsto     numeric(10,2),
  entrou_na_portaria boolean not null default false,
  criado_em          timestamptz not null default now(),
  quitado_em         timestamptz,
  quitado_por        text,
  quitado_meio       text check (quitado_meio is null or quitado_meio in ('pix', 'dinheiro', 'cartao')),
  quitado_valor      numeric(10,2),
  quitado_obs        text,
  retirado_em        timestamptz,
  retirado_por       text,
  retirado_motivo    text,
  liberado_edicao    int,
  liberado_por       text,
  liberado_em        timestamptz,
  unique (equipante_id, edicao)
);
alter table public.debitos_equipantes enable row level security;
revoke all on table public.debitos_equipantes from anon, authenticated;

-- Debitos que ainda impedem a inscricao nesta edicao (null = nenhum).
create or replace function public._debito_bloqueia(p_equipante_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_agg(jsonb_build_object('edicao', d.edicao, 'agendado_para', d.agendado_para) order by d.edicao)
    from public.debitos_equipantes d
   where d.equipante_id = p_equipante_id
     and d.quitado_em is null and d.retirado_em is null
     and d.liberado_edicao is distinct from (select c.edicao_numero from public.configuracoes c limit 1);
$$;
revoke all on function public._debito_bloqueia(uuid) from public, anon, authenticated;

create or replace function public.debitos_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_atual int := (select c.edicao_numero from public.configuracoes c limit 1);
begin
  if public._nome_organizador_logado() is null then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  return jsonb_build_object('ok', true, 'edicao_atual', v_atual, 'debitos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'equipante_id', d.equipante_id, 'nome', e.nome, 'whatsapp', e.whatsapp,
             'igreja', case when e.igreja = 'OUTRA' then coalesce(nullif(btrim(e.igreja_outra), ''), 'OUTRA')
                            else nullif(btrim(e.igreja), '') end,
             'edicao', d.edicao, 'agendado_para', d.agendado_para, 'observacao', d.observacao,
             'agendado_por', d.agendado_por, 'valor_previsto', d.valor_previsto,
             'entrou_na_portaria', d.entrou_na_portaria, 'criado_em', d.criado_em,
             'situacao', case when d.quitado_em is not null then 'quitado'
                              when d.retirado_em is not null then 'retirado' else 'aberto' end,
             'quitado_em', d.quitado_em, 'quitado_por', d.quitado_por, 'quitado_meio', d.quitado_meio,
             'quitado_valor', d.quitado_valor, 'quitado_obs', d.quitado_obs,
             'retirado_em', d.retirado_em, 'retirado_por', d.retirado_por, 'retirado_motivo', d.retirado_motivo,
             'autorizado', d.liberado_edicao = v_atual, 'liberado_por', d.liberado_por, 'liberado_em', d.liberado_em,
             'inscrito', coalesce(e.inscrito, false))
           order by (d.quitado_em is null and d.retirado_em is null) desc, d.agendado_para nulls last, e.nome)
      from public.debitos_equipantes d
      join public.equipantes e on e.id = d.equipante_id), '[]'::jsonb));
end;
$$;
revoke all on function public.debitos_listar() from public, anon;
grant execute on function public.debitos_listar() to authenticated;

create or replace function public.debito_quitar(p_id bigint, p_meio text, p_valor numeric, p_obs text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org  text := public._nome_organizador_logado();
  v_meio text := nullif(lower(btrim(coalesce(p_meio, ''))), '');
  v_obs  text := nullif(btrim(coalesce(p_obs, '')), '');
  v_n    int;
begin
  if v_org is null then return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.'); end if;
  if v_meio is null or v_meio not in ('pix', 'dinheiro', 'cartao') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha como foi pago: PIX, dinheiro ou cartão.');
  end if;
  if p_valor is null or p_valor <= 0 or p_valor > 5000 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o valor recebido (maior que zero).');
  end if;
  if length(coalesce(v_obs, '')) > 200 then
    return jsonb_build_object('ok', false, 'erro', 'Observação com mais de 200 caracteres.');
  end if;
  update public.debitos_equipantes
     set quitado_em = now(), quitado_por = v_org, quitado_meio = v_meio,
         quitado_valor = round(p_valor, 2), quitado_obs = v_obs
   where id = p_id and quitado_em is null and retirado_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'erro', 'Este débito não está mais em aberto.'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.debito_quitar(bigint, text, numeric, text) from public, anon;
grant execute on function public.debito_quitar(bigint, text, numeric, text) to authenticated;

create or replace function public.debito_autorizar(p_id bigint, p_autorizar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org   text := public._nome_organizador_logado();
  v_atual int := (select c.edicao_numero from public.configuracoes c limit 1);
  v_n     int;
begin
  if v_org is null then return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.'); end if;
  update public.debitos_equipantes
     set liberado_edicao = case when p_autorizar then v_atual end,
         liberado_por    = case when p_autorizar then v_org end,
         liberado_em     = case when p_autorizar then now() end
   where id = p_id and quitado_em is null and retirado_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'erro', 'Este débito não está mais em aberto.'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.debito_autorizar(bigint, boolean) from public, anon;
grant execute on function public.debito_autorizar(bigint, boolean) to authenticated;

create or replace function public.debito_retirar(p_id bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org    text := public._nome_organizador_logado();
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_n      int;
begin
  if v_org is null then return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.'); end if;
  if v_motivo is null or length(v_motivo) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o motivo.');
  end if;
  if length(v_motivo) > 200 then
    return jsonb_build_object('ok', false, 'erro', 'Motivo com mais de 200 caracteres.');
  end if;
  update public.debitos_equipantes
     set retirado_em = now(), retirado_por = v_org, retirado_motivo = v_motivo
   where id = p_id and quitado_em is null and retirado_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'erro', 'Este débito não está mais em aberto.'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.debito_retirar(bigint, text) from public, anon;
grant execute on function public.debito_retirar(bigint, text) to authenticated;

-- ---- Patches nas funcoes existentes -------------------------------------------
do $$
declare
  v_def  text;
  v_novo text;
begin
  -- 1. Virada: agendado sem pagar vira debito; cobrancas da edicao velha saem.
  v_def := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);
  if v_def not like '%debitos_equipantes%' then
    v_novo := replace(v_def,
      $a$  update public.equipantes q
     set ja_trabalhou_equipe = true,$a$,
      $a$  -- Pagamento agendado e nao pago: vira debito (20261025e). Antes de apagar
  -- as escalas, porque o desconto automatico (infiltrado) depende delas.
  insert into public.debitos_equipantes (equipante_id, edicao, agendado_para, observacao,
                                         agendado_por, valor_previsto, entrou_na_portaria)
  select c.equipante_id, coalesce(v_edicao_ant, 0), c.agendado_para, c.observacao, c.marcado_por,
         (select case when v.p is null then null else greatest(v.p - coalesce(
                   (public._desconto_automatico('equipante', c.equipante_id, v.p) ->> 'desconto')::numeric, 0), 0) end
            from (select public._valor_ultimo_lote('equipante') as p) v),
         exists (select 1 from public.portaria_entradas en where en.equipante_id = c.equipante_id)
    from public.cobrancas_equipantes c
    join public.equipantes e on e.id = c.equipante_id
   where c.status = 'agendado'
     and lower(coalesce(e.status_pagamento, '')) not in ('confirmado', 'pago', 'completed')
  on conflict (equipante_id, edicao) do nothing;
  delete from public.cobrancas_equipantes where equipante_id is not null;

  update public.equipantes q
     set ja_trabalhou_equipe = true,$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em resetar_para_nova_edicao'; end if;
    execute v_novo;
  end if;

  -- 2. Inscricao: debito em aberto e sem autorizacao trava.
  v_def := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  if v_def not like '%DEBITO_PENDENTE%' then
    v_novo := replace(v_def,
      $a$      if coalesce(v_atual.inscrito, false) then
        raise exception 'JA_INSCRITO';
      end if;
$a$,
      $a$      if coalesce(v_atual.inscrito, false) then
        raise exception 'JA_INSCRITO';
      end if;
      if public._debito_bloqueia(v_atual.id) is not null then
        raise exception 'DEBITO_PENDENTE';
      end if;
$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em criar_inscricao'; end if;
    execute v_novo;
  end if;

  -- 3. Verificacao do CPF: avisa antes do formulario (so a edicao, sem valor).
  v_def := pg_get_functiondef('public.verificar_inscricao(text,text,text)'::regprocedure);
  if v_def not like '%_debito_bloqueia%' then
    v_novo := replace(v_def,
      $a$    'id', v_id, 'nome', v_nome, 'inscrito', v_inscrito,$a$,
      $a$    'id', v_id, 'nome', v_nome, 'inscrito', v_inscrito,
    'debito', case when p_tipo = 'equipante' and not coalesce(v_inscrito, false)
                   then (select jsonb_agg(x -> 'edicao') from jsonb_array_elements(public._debito_bloqueia(v_id)) x) end,$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em verificar_inscricao'; end if;
    execute v_novo;
  end if;

  -- 4. Portaria: lista com a data combinada.
  v_def := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  if v_def not like '%agendado_para%' then
    v_novo := replace(v_def,
      $a$             'metodo', lower(coalesce(e.metodo_pagamento, '')),$a$,
      $a$             'agendado_para', (select c.agendado_para from public.cobrancas_equipantes c
                                where c.equipante_id = e.id and c.status = 'agendado'),
             'metodo', lower(coalesce(e.metodo_pagamento, '')),$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_lista'; end if;
    execute v_novo;
  end if;

  -- 5. Portaria: agendado (e na escala) entra sem pagar.
  v_def := pg_get_functiondef('public.portaria_liberar_entrada(uuid)'::regprocedure);
  if v_def not like '%cobrancas_equipantes%' then
    v_novo := replace(v_def,
      $a$  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then$a$,
      $a$  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed')
     and not (exists (select 1 from public.cobrancas_equipantes c
                       where c.equipante_id = p_id and c.status = 'agendado')
              and public._equipante_na_escala(p_id)) then$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_liberar_entrada'; end if;
    execute v_novo;
  end if;

  -- 6. Portaria: agendar/remarcar/tirar muda a versao (a tela recarrega).
  v_def := pg_get_functiondef('public.portaria_versao()'::regprocedure);
  if v_def not like '%cobrancas_equipantes%' then
    v_novo := replace(v_def,
      $a$    (select count(*)::text from public.equipantes e where e.tipo = 'equipante'),$a$,
      $a$    (select coalesce(string_agg(c.equipante_id::text || c.agendado_para::text, ',' order by c.equipante_id), '')
       from public.cobrancas_equipantes c where c.status = 'agendado'),
    (select count(*)::text from public.equipantes e where e.tipo = 'equipante'),$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_versao'; end if;
    execute v_novo;
  end if;
end $$;
