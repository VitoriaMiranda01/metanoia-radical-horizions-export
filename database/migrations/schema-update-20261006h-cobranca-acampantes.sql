-- ---------------------------------------------------------------------------
-- Cobranca dos acampantes que nao pagaram (pedido da Raquel, 06/10/2026).
--
-- Passou a data de pagamento e a Raquel vai cobrar. Em Pagamentos, cada
-- acampante que nao pagou pode ficar:
--   * em_cobranca -- "ja falei com a pessoa e estou cobrando";
--   * agendado    -- "prometeu pagar no dia X" (agendado_para obrigatorio).
-- Os dois aceitam uma observacao curta (ate 200 caracteres).
--
-- Sem linha aqui = "Nao pagaram". Quando a pessoa paga, a linha some sozinha
-- (gatilho em acampantes) e ela vai para "Pagos". Equipantes ainda nao
-- entram, por decisao do Patrick.
--
-- So organizador mexe (RPCs abaixo). A auditoria (20261006g) registra.
-- ---------------------------------------------------------------------------

create table if not exists public.cobrancas_acampantes (
  acampante_id  uuid primary key references public.acampantes(id) on delete cascade,
  status        text not null check (status in ('em_cobranca', 'agendado')),
  agendado_para date,
  observacao    text check (observacao is null or length(observacao) <= 200),
  marcado_por   text not null,
  marcado_em    timestamptz not null default now(),
  check (status <> 'agendado' or agendado_para is not null)
);
alter table public.cobrancas_acampantes enable row level security;
revoke all on public.cobrancas_acampantes from anon, authenticated;

-- Lista para a tela: { acampante_id: {status, agendado_para, observacao, marcado_por, marcado_em} }
create or replace function public.cobrancas_listar()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $fn$
begin
  if public._nome_organizador_logado() is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  return coalesce((
    select jsonb_object_agg(c.acampante_id, jsonb_build_object(
             'status', c.status, 'agendado_para', c.agendado_para,
             'observacao', c.observacao, 'marcado_por', c.marcado_por,
             'marcado_em', c.marcado_em))
      from public.cobrancas_acampantes c), '{}'::jsonb);
end;
$fn$;

-- Marca, remarca ou edita a observacao. "Desde" (marcado_em) so muda quando
-- o status muda.
create or replace function public.cobranca_definir(
  p_acampante_id uuid, p_status text, p_agendado_para date default null, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_org text := public._nome_organizador_logado();
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_pago text;
begin
  if v_org is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  if p_status not in ('em_cobranca', 'agendado') then
    raise exception 'STATUS_INVALIDO';
  end if;
  if p_status = 'agendado' and p_agendado_para is null then
    raise exception 'DATA_OBRIGATORIA';
  end if;
  if length(coalesce(v_obs, '')) > 200 then
    raise exception 'OBSERVACAO_LONGA';
  end if;

  select status_pagamento into v_pago from public.acampantes where id = p_acampante_id;
  if not found then
    raise exception 'ACAMPANTE_NAO_ENCONTRADO';
  end if;
  if v_pago in ('confirmado', 'pago', 'completed') then
    raise exception 'JA_PAGO';
  end if;

  insert into public.cobrancas_acampantes (acampante_id, status, agendado_para, observacao, marcado_por)
  values (p_acampante_id, p_status,
          case when p_status = 'agendado' then p_agendado_para end, v_obs, v_org)
  on conflict (acampante_id) do update
     set status        = excluded.status,
         agendado_para = excluded.agendado_para,
         observacao    = excluded.observacao,
         marcado_por   = case when cobrancas_acampantes.status = excluded.status
                              then cobrancas_acampantes.marcado_por else excluded.marcado_por end,
         marcado_em    = case when cobrancas_acampantes.status = excluded.status
                              then cobrancas_acampantes.marcado_em else now() end;
end;
$fn$;

-- Volta a pessoa para "Nao pagaram" (marcou errado).
create or replace function public.cobranca_remover(p_acampante_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if public._nome_organizador_logado() is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  delete from public.cobrancas_acampantes where acampante_id = p_acampante_id;
end;
$fn$;

-- Pagou: sai da cobranca sozinho.
create or replace function public._cobranca_sai_quando_paga()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.status_pagamento in ('confirmado', 'pago', 'completed') then
    delete from public.cobrancas_acampantes where acampante_id = new.id;
  end if;
  return null;
end;
$fn$;

drop trigger if exists cobranca_sai_quando_paga on public.acampantes;
create trigger cobranca_sai_quando_paga
  after update of status_pagamento on public.acampantes
  for each row
  when (new.status_pagamento is distinct from old.status_pagamento)
  execute function public._cobranca_sai_quando_paga();

-- Auditoria: mesma forma das outras tabelas, com o nome do acampante.
create or replace function public._aud_rotulo(p_tabela text, j jsonb)
returns text
language sql stable security definer
set search_path to 'public'
as $fn$
  select case p_tabela
    when 'escalas' then
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id')
    when 'disponibilidade_extra' then
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id')
    when 'chamada_escala' then
      (select e.nome from public.escalas s join public.equipantes e on e.id = s.equipante_id
        where s.id::text = j ->> 'escala_id')
    when 'pagamentos' then coalesce(
      (select e.nome from public.equipantes e where e.id::text = j ->> 'equipante_id'),
      (select a.nome from public.acampantes a where a.id::text = j ->> 'acampante_id'))
    when 'cobrancas_acampantes' then
      (select a.nome from public.acampantes a where a.id::text = j ->> 'acampante_id')
    when 'configuracoes' then 'Configurações'
    when 'atuacoes_areas' then concat_ws(' · ', j ->> 'area_nome', j ->> 'atuacao')
    else coalesce(j ->> 'nome', j ->> 'area_nome', j ->> 'igreja', j ->> 'codigo')
  end;
$fn$;

drop trigger if exists auditoria_i on public.cobrancas_acampantes;
drop trigger if exists auditoria_u on public.cobrancas_acampantes;
drop trigger if exists auditoria_d on public.cobrancas_acampantes;
create trigger auditoria_i after insert on public.cobrancas_acampantes referencing new table as novos
  for each statement execute function public._auditar('acampante_id');
create trigger auditoria_u after update on public.cobrancas_acampantes referencing old table as velhos new table as novos
  for each statement execute function public._auditar('acampante_id');
create trigger auditoria_d after delete on public.cobrancas_acampantes referencing old table as velhos
  for each statement execute function public._auditar('acampante_id');

revoke all on function public._aud_rotulo(text, jsonb) from public, anon, authenticated;
revoke all on function public._cobranca_sai_quando_paga() from public, anon, authenticated;
revoke all on function public.cobrancas_listar() from public, anon;
revoke all on function public.cobranca_definir(uuid, text, date, text) from public, anon;
revoke all on function public.cobranca_remover(uuid) from public, anon;
grant execute on function public.cobrancas_listar() to authenticated;
grant execute on function public.cobranca_definir(uuid, text, date, text) to authenticated;
grant execute on function public.cobranca_remover(uuid) to authenticated;
