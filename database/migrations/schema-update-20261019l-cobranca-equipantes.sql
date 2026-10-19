-- Cobranca e PAGAMENTO AGENDADO tambem para EQUIPANTES (19/10/2026, Patrick).
-- Igual a dos acampantes (cobrancas_acampantes): "Em cobranca" e "Pagamento
-- agendado" na tela de Pagamentos. A Raquel combina a data com a pessoa; no
-- acompanhamento o equipante ve "pagamento agendado para dd/mm" e a etapa de
-- pagamento continua PENDENTE ate pagar. Pagou: sai da cobranca sozinho.
--  * cobrancas_equipantes (mesmas colunas da dos acampantes).
--  * cobranca_definir_inscricao / cobranca_remover_inscricao (p_tipo, p_id):
--    acampante continua na tabela antiga.
--  * cobrancas_listar: devolve as duas (a chave e o id da ficha).
--  * situacao_inscricao: 'pagamento_agendado' { agendado_para, observacao }.

create table if not exists public.cobrancas_equipantes (
  equipante_id  uuid primary key references public.equipantes(id) on delete cascade,
  status        text not null check (status in ('em_cobranca', 'agendado')),
  agendado_para date,
  observacao    text,
  marcado_por   text not null,
  marcado_em    timestamptz not null default now()
);
alter table public.cobrancas_equipantes enable row level security;
revoke all on table public.cobrancas_equipantes from anon, authenticated;

create or replace function public.cobranca_definir_inscricao(p_tipo text, p_id uuid, p_status text,
  p_agendado_para date default null, p_observacao text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org text := public._nome_organizador_logado();
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_pago text;
begin
  if p_tipo = 'acampante' then
    perform public.cobranca_definir(p_id, p_status, p_agendado_para, p_observacao);
    return;
  end if;
  if p_tipo <> 'equipante' then raise exception 'TIPO_INVALIDO'; end if;
  if v_org is null then raise exception 'SEM_PERMISSAO'; end if;
  if p_status not in ('em_cobranca', 'agendado') then raise exception 'STATUS_INVALIDO'; end if;
  if p_status = 'agendado' and p_agendado_para is null then raise exception 'DATA_OBRIGATORIA'; end if;
  if length(coalesce(v_obs, '')) > 200 then raise exception 'OBSERVACAO_LONGA'; end if;

  select status_pagamento into v_pago from public.equipantes where id = p_id;
  if not found then raise exception 'ACAMPANTE_NAO_ENCONTRADO'; end if;
  if v_pago in ('confirmado', 'pago', 'completed') then raise exception 'JA_PAGO'; end if;

  insert into public.cobrancas_equipantes (equipante_id, status, agendado_para, observacao, marcado_por)
  values (p_id, p_status, case when p_status = 'agendado' then p_agendado_para end, v_obs, v_org)
  on conflict (equipante_id) do update
     set status        = excluded.status,
         agendado_para = excluded.agendado_para,
         observacao    = excluded.observacao,
         marcado_por   = case when cobrancas_equipantes.status = excluded.status
                              then cobrancas_equipantes.marcado_por else excluded.marcado_por end,
         marcado_em    = case when cobrancas_equipantes.status = excluded.status
                              then cobrancas_equipantes.marcado_em else now() end;
end;
$$;
revoke all on function public.cobranca_definir_inscricao(text, uuid, text, date, text) from public, anon;
grant execute on function public.cobranca_definir_inscricao(text, uuid, text, date, text) to authenticated;

create or replace function public.cobranca_remover_inscricao(p_tipo text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_tipo = 'acampante' then
    perform public.cobranca_remover(p_id);
    return;
  end if;
  if public._nome_organizador_logado() is null then raise exception 'SEM_PERMISSAO'; end if;
  delete from public.cobrancas_equipantes where equipante_id = p_id;
end;
$$;
revoke all on function public.cobranca_remover_inscricao(text, uuid) from public, anon;
grant execute on function public.cobranca_remover_inscricao(text, uuid) to authenticated;

create or replace function public.cobrancas_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public._nome_organizador_logado() is null then
    raise exception 'SEM_PERMISSAO';
  end if;
  return coalesce((
    select jsonb_object_agg(x.id, jsonb_build_object(
             'status', x.status, 'agendado_para', x.agendado_para,
             'observacao', x.observacao, 'marcado_por', x.marcado_por,
             'marcado_em', x.marcado_em))
      from (select acampante_id as id, status, agendado_para, observacao, marcado_por, marcado_em
              from public.cobrancas_acampantes
            union all
            select equipante_id, status, agendado_para, observacao, marcado_por, marcado_em
              from public.cobrancas_equipantes) x), '{}'::jsonb);
end;
$$;

-- Pagou: sai da cobranca (mesmo gatilho dos acampantes).
create or replace function public._cobranca_equipante_sai_quando_paga()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status_pagamento in ('confirmado', 'pago', 'completed') then
    delete from public.cobrancas_equipantes where equipante_id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_cobranca_equipante_sai_quando_paga on public.equipantes;
create trigger trg_cobranca_equipante_sai_quando_paga
  after update of status_pagamento on public.equipantes
  for each row when (new.status_pagamento is distinct from old.status_pagamento) execute function public._cobranca_equipante_sai_quando_paga();

-- Acompanhamento do equipante: a data combinada aparece para ele.
do $$
declare
  v_def text := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  v_novo text;
begin
  if v_def like '%pagamento_agendado%' then return; end if;
  v_novo := replace(v_def,
    $a$    'presenca', v_presenca,
    'pendencias', public._pendencias_equipante(p_id),$a$,
    $a$    'presenca', v_presenca,
    'pagamento_agendado', (select jsonb_build_object('agendado_para', c.agendado_para, 'observacao', c.observacao)
                             from public.cobrancas_equipantes c
                            where c.equipante_id = p_id and c.status = 'agendado'),
    'pendencias', public._pendencias_equipante(p_id),$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em situacao_inscricao'; end if;
  execute v_novo;
end $$;
