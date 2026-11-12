-- Solicitacao de fichas pelo parceiro (12/11/2026)
--
-- Pedido da outra dev, decidido com o Patrick: acabar com o Google Forms +
-- planilha de pedido de fichas de acampante.
--   * Area do Parceiro: botao "Solicitar fichas" (igreja da conta, quantidade,
--     nome e WhatsApp de contato -- pode ser o do pastor, nao o da conta).
--   * Tela nova do organizador "Solicitacoes de fichas" (caixa de permissao
--     nova 'solicitacoes_fichas'): aprovar ou recusar.
--   * Aprovar SOMA a quantidade aprovada ao limite da igreja (limites_igrejas,
--     mesma trava do cadastro de acampante). A quantidade aprovada pode ser
--     diferente da pedida. Igreja sem limite nenhum: a base e o que ela ja
--     inscreveu (ocupadas + aprovadas).
--   * Depois de aprovar, o site monta a mensagem de WhatsApp (envio manual)
--     com codigo da igreja, lote vigente (valor) e data limite.
-- Um pedido pendente por igreja por edicao (a planilha vivia de duplicados).
-- A tabela e por edicao (numero_edicao); a virada nao precisa apagar nada.

create table if not exists public.solicitacoes_fichas (
  id                   uuid primary key default gen_random_uuid(),
  numero_edicao        integer,
  igreja_codigo        text not null,
  igreja               text not null,            -- "NN - NOME" (chave de limites_igrejas)
  conta_codigo         text,                     -- conta de parceiro que pediu
  contato_nome         text not null,
  contato_whatsapp     text not null,            -- so digitos, com DDD
  quantidade           integer not null check (quantidade between 1 and 200),
  observacao           text,
  status               text not null default 'pendente'
                       check (status in ('pendente', 'aprovada', 'recusada', 'cancelada')),
  quantidade_aprovada  integer,
  limite_antes         integer,
  limite_depois        integer,
  motivo_recusa        text,
  decidido_por         text,
  decidido_em          timestamptz,
  mensagem_enviada_em  timestamptz,
  mensagem_enviada_por text,
  criado_em            timestamptz not null default now()
);

create unique index if not exists solicitacoes_fichas_uma_pendente
  on public.solicitacoes_fichas (igreja_codigo, numero_edicao) where status = 'pendente';
create index if not exists solicitacoes_fichas_edicao on public.solicitacoes_fichas (numero_edicao, criado_em);

alter table public.solicitacoes_fichas enable row level security;
revoke all on public.solicitacoes_fichas from public, anon, authenticated;

-- Caixa de permissao nova ------------------------------------------------
create or replace function public._permissoes_organizador_validas()
returns text[]
language sql
immutable
as $$
  select array['gerenciar_inscricoes', 'inscricao_manual', 'aprovacao_equipe',
               'geracao_escala', 'responsavel_reuniao', 'troca_diaria',
               'lancamento_escala', 'pagamentos', 'ocorrencias', 'solicitacoes_fichas'];
$$;

-- Auxiliares ---------------------------------------------------------------
create or replace function public._fichas_edicao()
returns integer
language sql stable security definer set search_path to 'public'
as $$ select edicao_numero from public.configuracoes limit 1; $$;

-- Limite que vale hoje para a igreja (excecao ou padrao; null = sem limite)
-- e quantas fichas ela ja ocupou.
create or replace function public._fichas_situacao(p_igreja text)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object(
    'limite', coalesce((select l.limite_maximo from public.limites_igrejas l where l.igreja = p_igreja),
                       (select c.limite_acampantes_por_igreja from public.configuracoes c limit 1)),
    'excecao', exists (select 1 from public.limites_igrejas l where l.igreja = p_igreja),
    'ocupadas', (select count(*) from public.acampantes a where a.admin_responsavel = p_igreja));
$$;

revoke all on function public._fichas_edicao() from public, anon, authenticated;
revoke all on function public._fichas_situacao(text) from public, anon, authenticated;

-- Parceiro: pedir ------------------------------------------------------------
create or replace function public.solicitar_fichas(
  p_igreja_codigo text, p_quantidade integer, p_contato_nome text,
  p_contato_whatsapp text, p_observacao text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_ig   public.igrejas_parceiras%rowtype;
  v_nome text := btrim(coalesce(p_contato_nome, ''));
  v_zap  text := regexp_replace(coalesce(p_contato_whatsapp, ''), '\D', '', 'g');
  v_obs  text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_id   uuid;
begin
  if not public.eh_parceiro() then
    return jsonb_build_object('ok', false, 'erro', 'Só a conta da igreja parceira pode pedir fichas.');
  end if;
  if p_igreja_codigo is null or not (p_igreja_codigo = any (public.igrejas_do_parceiro())) then
    return jsonb_build_object('ok', false, 'erro', 'Esta igreja não é da sua conta.');
  end if;
  select * into v_ig from public.igrejas_parceiras where codigo = p_igreja_codigo limit 1;
  if v_ig.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 200 then
    return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade de 1 a 200 fichas.');
  end if;
  if length(v_nome) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o nome de quem vai receber o retorno.');
  end if;
  if length(v_zap) >= 12 and v_zap like '55%' then v_zap := substr(v_zap, 3); end if;
  if length(v_zap) not in (10, 11) then
    return jsonb_build_object('ok', false, 'erro', 'WhatsApp inválido: informe DDD + número.');
  end if;
  if v_obs is not null and length(v_obs) > 500 then
    return jsonb_build_object('ok', false, 'erro', 'Observação muito longa (até 500 caracteres).');
  end if;

  begin
    insert into public.solicitacoes_fichas
      (numero_edicao, igreja_codigo, igreja, conta_codigo, contato_nome, contato_whatsapp, quantidade, observacao)
    values (public._fichas_edicao(), v_ig.codigo, v_ig.codigo || ' - ' || v_ig.nome, public.jwt_igreja(),
            v_nome, v_zap, p_quantidade, v_obs)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'erro',
      'Já existe um pedido desta igreja aguardando resposta. Aguarde ou cancele o pedido anterior.');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Parceiro: ver os seus (e as igrejas da conta para o seletor) --------------
create or replace function public.minhas_solicitacoes_fichas()
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  select case when not public.eh_parceiro() then null else jsonb_build_object(
    'igrejas', coalesce((select jsonb_agg(jsonb_build_object('codigo', i.codigo, 'nome', i.nome) order by i.codigo)
                           from public.igrejas_parceiras i
                          where i.codigo = any (public.igrejas_do_parceiro())), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', s.id, 'igreja', s.igreja, 'quantidade', s.quantidade,
                           'quantidade_aprovada', s.quantidade_aprovada, 'status', s.status,
                           'motivo_recusa', s.motivo_recusa, 'contato_nome', s.contato_nome,
                           'contato_whatsapp', s.contato_whatsapp, 'criado_em', s.criado_em,
                           'decidido_em', s.decidido_em) order by s.criado_em desc)
                           from public.solicitacoes_fichas s
                          where s.igreja_codigo = any (public.igrejas_do_parceiro())
                            and s.numero_edicao is not distinct from public._fichas_edicao()), '[]'::jsonb))
  end;
$$;

-- Parceiro: cancelar pedido ainda pendente ------------------------------------
create or replace function public.cancelar_solicitacao_fichas(p_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_s public.solicitacoes_fichas%rowtype;
begin
  if not public.eh_parceiro() then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão.');
  end if;
  select * into v_s from public.solicitacoes_fichas where id = p_id for update;
  if v_s.id is null or not (v_s.igreja_codigo = any (public.igrejas_do_parceiro())) then
    return jsonb_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  end if;
  if v_s.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'Este pedido já foi respondido.');
  end if;
  update public.solicitacoes_fichas
     set status = 'cancelada', decidido_em = now(), decidido_por = 'parceiro'
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Organizador: listar --------------------------------------------------------
create or replace function public.listar_solicitacoes_fichas()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare v_c public.configuracoes%rowtype;
begin
  if not public.org_pode('solicitacoes_fichas') then
    raise exception 'SEM_PERMISSAO';
  end if;
  select * into v_c from public.configuracoes limit 1;
  return jsonb_build_object(
    'config', jsonb_build_object(
      'edicao', v_c.edicao_numero,
      'valor_hoje', public._valor_hoje_em(v_c.acampante_pricing_periods),
      'data_limite', v_c.data_limite_inscricao_pagamento),
    'itens', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object('situacao', public._fichas_situacao(s.igreja))
                                        order by s.criado_em desc)
                         from public.solicitacoes_fichas s
                        where s.numero_edicao is not distinct from v_c.edicao_numero), '[]'::jsonb));
end;
$$;

-- Organizador: aprovar (soma ao limite da igreja) ---------------------------
create or replace function public.aprovar_solicitacao_fichas(p_id uuid, p_quantidade integer)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_s     public.solicitacoes_fichas%rowtype;
  v_sit   jsonb;
  v_antes integer;
  v_ocup  integer;
  v_dep   integer;
  v_quem  text;
begin
  if not public.org_pode('solicitacoes_fichas') then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão para aprovar fichas.');
  end if;
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 200 then
    return jsonb_build_object('ok', false, 'erro', 'Quantidade aprovada deve ser de 1 a 200.');
  end if;
  select * into v_s from public.solicitacoes_fichas where id = p_id for update;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  end if;
  if v_s.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'Este pedido já foi respondido (' || v_s.status || ').');
  end if;

  -- Mesma trava por igreja do cadastro de acampante: ninguem inscreve no meio.
  perform pg_advisory_xact_lock(hashtext(v_s.igreja));
  v_sit   := public._fichas_situacao(v_s.igreja);
  v_antes := (v_sit ->> 'limite')::integer;
  v_ocup  := (v_sit ->> 'ocupadas')::integer;
  v_dep   := greatest(coalesce(v_antes, v_ocup), v_ocup) + p_quantidade;

  insert into public.limites_igrejas (igreja, limite_maximo)
  values (v_s.igreja, v_dep)
  on conflict (igreja) do update set limite_maximo = excluded.limite_maximo,
                                     updated_at = timezone('utc'::text, now());

  v_quem := coalesce((select o.nome from public._organizador_do_cracha() o), 'organizador');
  update public.solicitacoes_fichas
     set status = 'aprovada', quantidade_aprovada = p_quantidade,
         limite_antes = v_antes, limite_depois = v_dep,
         decidido_por = v_quem, decidido_em = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'limite_antes', v_antes, 'limite_depois', v_dep, 'ocupadas', v_ocup);
end;
$$;

-- Organizador: recusar -------------------------------------------------------
create or replace function public.recusar_solicitacao_fichas(p_id uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_s public.solicitacoes_fichas%rowtype;
begin
  if not public.org_pode('solicitacoes_fichas') then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão para recusar fichas.');
  end if;
  select * into v_s from public.solicitacoes_fichas where id = p_id for update;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Pedido não encontrado.');
  end if;
  if v_s.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'erro', 'Este pedido já foi respondido (' || v_s.status || ').');
  end if;
  update public.solicitacoes_fichas
     set status = 'recusada', motivo_recusa = nullif(btrim(coalesce(p_motivo, '')), ''),
         decidido_por = coalesce((select o.nome from public._organizador_do_cracha() o), 'organizador'),
         decidido_em = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Organizador: marcar que a mensagem foi enviada (o envio e manual) ---------
create or replace function public.marcar_mensagem_fichas(p_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.org_pode('solicitacoes_fichas') then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão.');
  end if;
  update public.solicitacoes_fichas
     set mensagem_enviada_em = now(),
         mensagem_enviada_por = coalesce((select o.nome from public._organizador_do_cracha() o), 'organizador')
   where id = p_id and status = 'aprovada';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Pedido aprovado não encontrado.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.solicitar_fichas(text, integer, text, text, text) from public, anon;
revoke all on function public.minhas_solicitacoes_fichas() from public, anon;
revoke all on function public.cancelar_solicitacao_fichas(uuid) from public, anon;
revoke all on function public.listar_solicitacoes_fichas() from public, anon;
revoke all on function public.aprovar_solicitacao_fichas(uuid, integer) from public, anon;
revoke all on function public.recusar_solicitacao_fichas(uuid, text) from public, anon;
revoke all on function public.marcar_mensagem_fichas(uuid) from public, anon;
grant execute on function public.solicitar_fichas(text, integer, text, text, text) to authenticated;
grant execute on function public.minhas_solicitacoes_fichas() to authenticated;
grant execute on function public.cancelar_solicitacao_fichas(uuid) to authenticated;
grant execute on function public.listar_solicitacoes_fichas() to authenticated;
grant execute on function public.aprovar_solicitacao_fichas(uuid, integer) to authenticated;
grant execute on function public.recusar_solicitacao_fichas(uuid, text) to authenticated;
grant execute on function public.marcar_mensagem_fichas(uuid) to authenticated;

-- Selo do menu: pedidos pendentes da edicao ----------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.contadores_do_menu'::regproc);
  v_t1  text := E'jsonb_build_object(''aprovacoes'', 0, ''pagamentos'', 0, ''senhas'', 0)';
  v_t2  text := E'select count(*) from public.solicitacoes_senha where atendida_em is null\n      )';
begin
  if position(v_t1 in v_def) = 0 or position(v_t2 in v_def) = 0 then
    raise exception 'contadores_do_menu: trecho nao encontrado';
  end if;
  v_def := replace(v_def, v_t1,
    E'jsonb_build_object(''aprovacoes'', 0, ''pagamentos'', 0, ''senhas'', 0, ''fichas'', 0)');
  v_def := replace(v_def, v_t2, v_t2 || E',\n      ''fichas'', (\n        select count(*) from public.solicitacoes_fichas\n         where status = ''pendente'' and numero_edicao is not distinct from public._fichas_edicao()\n      )');
  execute v_def;
end $$;
