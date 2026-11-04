-- A virada leva TODOS os debitos (04/11/2026, Patrick)
--
-- Antes (20261025e) a virada so transformava em debito o EQUIPANTE com
-- pagamento AGENDADO. Ficavam de fora, e sumiam sem registro:
--  * quem estava em "Cobranca em andamento" (cobrancas_*.status = 'em_cobranca');
--  * os ACAMPANTES (agendados ou em cobranca): a virada apaga a tabela
--    acampantes e as cobrancas caem junto em cascata.
-- Regra do Patrick: vira debito quem esta com pagamento agendado OU cobranca
-- em andamento e nao pagou, equipante ou acampante. Quem esta so em "Nao
-- pagaram" (sem cobranca) continua NAO virando debito.
--
--  * debitos_equipantes ganha: tipo (equipante/acampante), cobranca_status
--    (agendado/em_cobranca) e, para o acampante (que e apagado na virada),
--    uma copia minima para cobrar: nome, whatsapp, igreja, responsavel (menor)
--    e a impressao digital do CPF (HMAC, a mesma do "acampante uma vez so").
--    Colunas novas sem NOT NULL: a copia do "desfazer a virada" tirada antes
--    desta migration continua restauravel (nulo = equipante / agendado).
--  * Trava: o debito do acampante segue a pessoa pelo CPF. Se ela tentar se
--    inscrever (como equipante ou acampante de novo), criar_inscricao recusa
--    com DEBITO_PENDENTE, como ja acontecia com o equipante. "Autorizar
--    inscricao" vale igual.
--  * debitos_listar mostra os dois tipos.

alter table public.debitos_equipantes alter column equipante_id drop not null;
alter table public.debitos_equipantes
  add column if not exists tipo                 text,
  add column if not exists cobranca_status      text,
  add column if not exists acampante_id         uuid,   -- id antigo; o acampante e apagado na virada (sem FK)
  add column if not exists nome                 text,
  add column if not exists whatsapp             text,
  add column if not exists igreja               text,
  add column if not exists responsavel_nome     text,
  add column if not exists responsavel_whatsapp text,
  add column if not exists cpf_impressao        text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'debitos_equipantes_tipo_check') then
    alter table public.debitos_equipantes add constraint debitos_equipantes_tipo_check
      check (tipo is null or tipo in ('equipante', 'acampante'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'debitos_equipantes_cobranca_status_check') then
    alter table public.debitos_equipantes add constraint debitos_equipantes_cobranca_status_check
      check (cobranca_status is null or cobranca_status in ('agendado', 'em_cobranca'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'debitos_equipantes_dono_check') then
    alter table public.debitos_equipantes add constraint debitos_equipantes_dono_check
      check (equipante_id is not null or acampante_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'debitos_equipantes_acampante_edicao_key') then
    alter table public.debitos_equipantes add constraint debitos_equipantes_acampante_edicao_key
      unique (acampante_id, edicao);
  end if;
end;
$$;

update public.debitos_equipantes set tipo = 'equipante' where tipo is null and equipante_id is not null;
update public.debitos_equipantes set cobranca_status = 'agendado' where cobranca_status is null and id is not null;

-- Debitos em aberto (e nao autorizados nesta edicao) de um CPF: os do
-- equipante com esse CPF e os de acampante com a mesma impressao digital.
create or replace function public._debito_bloqueia_cpf(p_cpf text)
returns jsonb language sql stable security definer set search_path = public as $$
  with alvo as (
    select nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '') as cpf
  )
  select jsonb_agg(jsonb_build_object('edicao', d.edicao, 'agendado_para', d.agendado_para) order by d.edicao)
    from public.debitos_equipantes d, alvo
   where alvo.cpf is not null
     and d.quitado_em is null and d.retirado_em is null
     and d.liberado_edicao is distinct from (select c.edicao_numero from public.configuracoes c limit 1)
     and (d.equipante_id in (select q.id from public.equipantes q
                              where regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') = alvo.cpf)
          or (d.cpf_impressao is not null
              and d.cpf_impressao = public._impressao_cpf_acampante(alvo.cpf)));
$$;
revoke all on function public._debito_bloqueia_cpf(text) from public, anon, authenticated;

-- Mesma assinatura de antes (verificar_inscricao e criar_inscricao a usam):
-- agora tambem acha o debito de acampante pelo CPF do equipante.
create or replace function public._debito_bloqueia(p_equipante_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_agg(jsonb_build_object('edicao', d.edicao, 'agendado_para', d.agendado_para) order by d.edicao)
    from public.debitos_equipantes d
   where d.quitado_em is null and d.retirado_em is null
     and d.liberado_edicao is distinct from (select c.edicao_numero from public.configuracoes c limit 1)
     and (d.equipante_id = p_equipante_id
          or (d.equipante_id is null and d.cpf_impressao is not null
              and d.cpf_impressao = (select public._impressao_cpf_acampante(q.cpf)
                                       from public.equipantes q where q.id = p_equipante_id)));
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
             'id', d.id, 'equipante_id', d.equipante_id,
             'tipo', coalesce(d.tipo, 'equipante'),
             'cobranca_status', coalesce(d.cobranca_status, 'agendado'),
             'nome', coalesce(e.nome, d.nome), 'whatsapp', coalesce(e.whatsapp, d.whatsapp),
             'igreja', case when e.id is null then nullif(btrim(d.igreja), '')
                            when e.igreja = 'OUTRA' then coalesce(nullif(btrim(e.igreja_outra), ''), 'OUTRA')
                            else nullif(btrim(e.igreja), '') end,
             'responsavel_nome', d.responsavel_nome, 'responsavel_whatsapp', d.responsavel_whatsapp,
             'edicao', d.edicao, 'agendado_para', d.agendado_para, 'observacao', d.observacao,
             'agendado_por', d.agendado_por, 'valor_previsto', d.valor_previsto,
             'entrou_na_portaria', d.entrou_na_portaria, 'criado_em', d.criado_em,
             'situacao', case when d.quitado_em is not null then 'quitado'
                              when d.retirado_em is not null then 'retirado' else 'aberto' end,
             'quitado_em', d.quitado_em, 'quitado_por', d.quitado_por, 'quitado_meio', d.quitado_meio,
             'quitado_valor', d.quitado_valor, 'quitado_obs', d.quitado_obs,
             'retirado_em', d.retirado_em, 'retirado_por', d.retirado_por, 'retirado_motivo', d.retirado_motivo,
             'autorizado', d.liberado_edicao = v_atual, 'liberado_por', d.liberado_por, 'liberado_em', d.liberado_em,
             'inscrito', case when e.id is not null then coalesce(e.inscrito, false)
                              when d.cpf_impressao is null then false
                              else exists (select 1 from public.equipantes q
                                            where q.inscrito is true
                                              and public._impressao_cpf_acampante(q.cpf) = d.cpf_impressao)
                                   or exists (select 1 from public.acampantes a
                                               where public._impressao_cpf_acampante(a.cpf) = d.cpf_impressao) end)
           order by (d.quitado_em is null and d.retirado_em is null) desc, d.agendado_para nulls last,
                    coalesce(e.nome, d.nome))
      from public.debitos_equipantes d
      left join public.equipantes e on e.id = d.equipante_id), '[]'::jsonb));
end;
$$;
revoke all on function public.debitos_listar() from public, anon;
grant execute on function public.debitos_listar() to authenticated;

-- ---- Patches nas funcoes existentes -------------------------------------------
do $$
declare
  v_def   text;
  v_ini   text := '  -- Pagamento agendado e nao pago: vira debito (20261025e).';
  v_fim   text := '  on conflict (equipante_id, edicao) do nothing;';
  v_de    text;
  v_para  text;
  p_ini   int;
  p_fim   int;
begin
  -- 1. Virada: agendado OU em cobranca, equipante OU acampante.
  v_def := pg_get_functiondef(
    'public.resetar_para_nova_edicao(integer,date,date,date,date,date)'::regprocedure);
  if v_def not like '%cobrancas_acampantes%' then
    p_ini := position(v_ini in v_def);
    p_fim := position(v_fim in v_def);
    if p_ini = 0 or p_fim = 0 or p_fim < p_ini
       or (length(v_def) - length(replace(v_def, v_fim, ''))) / length(v_fim) <> 1 then
      raise exception 'trecho não encontrado (ou repetido) em resetar_para_nova_edicao';
    end if;
    v_para :=
$a$  -- Agendado OU cobranca em andamento, sem pagar: vira debito (20261025e,
  -- 20261104g: tambem em cobranca e tambem acampante). Antes de apagar as
  -- escalas (desconto do infiltrado) e os acampantes (as cobrancas caem junto).
  insert into public.debitos_equipantes (equipante_id, tipo, cobranca_status, edicao, agendado_para,
                                         observacao, agendado_por, valor_previsto, entrou_na_portaria,
                                         nome, whatsapp)
  select c.equipante_id, 'equipante', c.status, coalesce(v_edicao_ant, 0), c.agendado_para,
         c.observacao, c.marcado_por,
         (select case when v.p is null then null else greatest(v.p - coalesce(
                   (public._desconto_automatico('equipante', c.equipante_id, v.p) ->> 'desconto')::numeric, 0), 0) end
            from (select public._valor_ultimo_lote('equipante') as p) v),
         exists (select 1 from public.portaria_entradas en where en.equipante_id = c.equipante_id),
         e.nome, e.whatsapp
    from public.cobrancas_equipantes c
    join public.equipantes e on e.id = c.equipante_id
   where c.status in ('agendado', 'em_cobranca')
     and lower(coalesce(e.status_pagamento, '')) not in ('confirmado', 'pago', 'completed')
  on conflict (equipante_id, edicao) do nothing;

  insert into public.debitos_equipantes (acampante_id, tipo, cobranca_status, edicao, agendado_para,
                                         observacao, agendado_por, valor_previsto, entrou_na_portaria,
                                         nome, whatsapp, igreja, responsavel_nome, responsavel_whatsapp,
                                         cpf_impressao)
  select c.acampante_id, 'acampante', c.status, coalesce(v_edicao_ant, 0), c.agendado_para,
         c.observacao, c.marcado_por,
         public._valor_ultimo_lote('acampante'),
         exists (select 1 from public.recepcao_presencas rp where rp.acampante_id = c.acampante_id),
         a.nome, a.whatsapp, a.igreja, a.responsavel_nome, a.responsavel_whatsapp,
         public._impressao_cpf_acampante(a.cpf)
    from public.cobrancas_acampantes c
    join public.acampantes a on a.id = c.acampante_id
   where c.status in ('agendado', 'em_cobranca')
     and lower(coalesce(a.status_pagamento, '')) not in ('confirmado', 'pago', 'completed')
  on conflict (acampante_id, edicao) do nothing;$a$;
    v_de := substr(v_def, p_ini, p_fim + length(v_fim) - p_ini);
    execute replace(v_def, v_de, v_para);
  end if;

  -- 2. Inscricao: o debito segue o CPF (equipante novo ou acampante).
  v_def := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  if v_def not like '%_debito_bloqueia_cpf%' then
    v_de := $a$       limit 1;
    end if;

    if v_atual.id is not null then$a$;
    v_para := $a$       limit 1;
    end if;

    -- Debito pelo CPF (20261104g): pega tambem quem deve como acampante.
    if v_cpf is not null and public._debito_bloqueia_cpf(v_cpf) is not null then
      raise exception 'DEBITO_PENDENTE';
    end if;

    if v_atual.id is not null then$a$;
    if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
      raise exception 'trecho do equipante não encontrado em criar_inscricao';
    end if;
    v_def := replace(v_def, v_de, v_para);

    v_de := $a$    raise exception 'JA_FOI_ACAMPANTE';
  end if;
$a$;
    v_para := $a$    raise exception 'JA_FOI_ACAMPANTE';
  end if;
  if public._debito_bloqueia_cpf(p_dados ->> 'cpf') is not null then
    raise exception 'DEBITO_PENDENTE';
  end if;
$a$;
    if (length(v_def) - length(replace(v_def, v_de, ''))) / length(v_de) <> 1 then
      raise exception 'trecho do acampante não encontrado em criar_inscricao';
    end if;
    execute replace(v_def, v_de, v_para);
  end if;
end;
$$;
