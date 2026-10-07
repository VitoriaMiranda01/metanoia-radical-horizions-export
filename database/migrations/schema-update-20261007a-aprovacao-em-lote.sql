-- ---------------------------------------------------------------------------
-- Aprovacao de equipantes EM LOTE, so para organizadores (Patrick, 07/10/2026).
--
-- O organizador escolhe igrejas (ou todas), ve a tela de confirmacao e digita a
-- PROPRIA senha. O servidor confere a senha, aprova tudo numa transacao so e
-- guarda o lote -- quem entrou e quando -- para dar para DESFAZER se foi sem
-- querer.
--
-- Regras:
--  * So organizador (eh_organizador + crachá em organizadores_auth). Parceiro
--    nunca chega aqui.
--  * A tela manda os IDs que o organizador viu e confirmou; o servidor so
--    aprova os que AINDA estao pendentes. Inscricao que chegou depois nao entra
--    de carona.
--  * A senha errada conta nas mesmas tentativas do login (10 erros = 10 min
--    bloqueado), para o lote nao virar uma maneira de adivinhar senha.
--  * Desfazer devolve a "pendente" quem continua aprovado por aquele lote e
--    ainda nao foi escalado nem pagou. Quem ja mudou de situacao, foi escalado
--    ou pagou fica como esta e a resposta diz quantos e por que.
-- ---------------------------------------------------------------------------

create table if not exists public.lotes_aprovacao (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null,
  criado_por    text not null,
  descricao     text not null,
  total         int  not null,
  desfeito_em   timestamptz,
  desfeito_por  text,
  desfeitos     int,
  nao_desfeitos int
);

create table if not exists public.lotes_aprovacao_itens (
  lote_id      uuid not null references public.lotes_aprovacao(id) on delete cascade,
  equipante_id uuid not null,
  nome         text,
  igreja       text,
  primary key (lote_id, equipante_id)
);
create index if not exists lotes_aprovacao_itens_equipante_idx
  on public.lotes_aprovacao_itens (equipante_id);

alter table public.lotes_aprovacao       enable row level security;
alter table public.lotes_aprovacao_itens enable row level security;
revoke all on public.lotes_aprovacao       from anon, authenticated;
revoke all on public.lotes_aprovacao_itens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aprovar
-- ---------------------------------------------------------------------------
create or replace function public.aprovar_em_lote(p_ids uuid[], p_senha text, p_descricao text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_org     public.organizadores_auth%rowtype;
  v_ate     timestamptz;
  v_quando  timestamptz := now();
  v_lote    uuid := gen_random_uuid();
  v_ids     uuid[];
  v_pedidos int;
  v_aprov   int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem aprovar em lote.');
  end if;

  select * into v_org from public._organizador_do_cracha();
  if v_org.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Não foi possível identificar o organizador logado.');
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_ids, '{}'::uuid[])) x);
  v_pedidos := coalesce(cardinality(v_ids), 0);
  if v_pedidos = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Nenhuma inscrição escolhida.');
  end if;
  if v_pedidos > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'Lote grande demais (máximo de 1000 inscrições por vez).');
  end if;

  -- Senha: mesmas tentativas e mesmo bloqueio do login do organizador.
  v_ate := public.login_bloqueado_ate('organizador', v_org.nome);
  if v_ate is not null then
    return jsonb_build_object('ok', false, 'erro',
      'Muitas tentativas de senha. Tente de novo depois das '
      || to_char(v_ate at time zone 'America/Sao_Paulo', 'HH24:MI') || '.');
  end if;

  if v_org.senha is null
     or v_org.senha <> extensions.crypt(coalesce(p_senha, ''), v_org.senha) then
    perform public.registrar_falha_login('organizador', v_org.nome);
    return jsonb_build_object('ok', false, 'erro', 'Senha incorreta.');
  end if;
  perform public.limpar_falhas_login('organizador', v_org.nome);

  insert into public.lotes_aprovacao (id, criado_em, criado_por, descricao, total)
  values (v_lote, v_quando, v_org.nome,
          left(coalesce(nullif(btrim(p_descricao), ''), 'Aprovação em lote'), 500), 0);

  with aprovados as (
    update public.equipantes e set
      status              = 'aprovado',
      decidido_por        = v_org.nome,
      decidido_por_tipo   = 'organizador',
      decidido_por_igreja = null,
      decidido_em         = v_quando
    where e.id = any(v_ids) and e.tipo = 'equipante' and e.status = 'pendente'
    returning e.id, e.nome, e.igreja
  ), guardados as (
    insert into public.lotes_aprovacao_itens (lote_id, equipante_id, nome, igreja)
    select v_lote, a.id, a.nome, a.igreja from aprovados a
    returning 1
  )
  select count(*) into v_aprov from guardados;

  if v_aprov = 0 then
    delete from public.lotes_aprovacao where id = v_lote;
    return jsonb_build_object('ok', true, 'aprovados', 0, 'ignorados', v_pedidos, 'lote', null);
  end if;

  update public.lotes_aprovacao set total = v_aprov where id = v_lote;

  return jsonb_build_object('ok', true, 'lote', v_lote, 'aprovados', v_aprov,
                            'ignorados', v_pedidos - v_aprov, 'por', v_org.nome);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Desfazer
-- ---------------------------------------------------------------------------
create or replace function public.desfazer_lote_aprovacao(p_lote uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_org     public.organizadores_auth%rowtype;
  v_lote    public.lotes_aprovacao%rowtype;
  v_ok      int;
  v_escal   int;
  v_pagos   int;
  v_alterad int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores podem desfazer um lote.');
  end if;
  select * into v_org from public._organizador_do_cracha();
  if v_org.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Não foi possível identificar o organizador logado.');
  end if;

  select * into v_lote from public.lotes_aprovacao where id = p_lote for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Lote não encontrado.');
  end if;
  if v_lote.desfeito_em is not null then
    return jsonb_build_object('ok', false, 'erro', 'Este lote já foi desfeito.');
  end if;

  -- Quem ainda esta aprovado POR ESTE lote (ninguem mexeu depois): volta a
  -- pendente, salvo se ja foi escalado ou pagou.
  select count(*) filter (where q.escalado),
         count(*) filter (where not q.escalado and q.pagou)
    into v_escal, v_pagos
    from (
      select exists (select 1 from public.escalas s where s.equipante_id = e.id) as escalado,
             coalesce(e.status_pagamento, 'pendente') <> 'pendente' as pagou
        from public.lotes_aprovacao_itens i
        join public.equipantes e on e.id = i.equipante_id
       where i.lote_id = p_lote
         and e.status = 'aprovado'
         and e.decidido_em = v_lote.criado_em
         and e.decidido_por_tipo = 'organizador'
    ) q;

  with revertidos as (
    update public.equipantes e set
      status = 'pendente',
      decidido_por = null, decidido_por_tipo = null,
      decidido_por_igreja = null, decidido_em = null
    from public.lotes_aprovacao_itens i
    where i.lote_id = p_lote
      and e.id = i.equipante_id
      and e.status = 'aprovado'
      and e.decidido_em = v_lote.criado_em
      and e.decidido_por_tipo = 'organizador'
      and coalesce(e.status_pagamento, 'pendente') = 'pendente'
      and not exists (select 1 from public.escalas s where s.equipante_id = e.id)
    returning e.id
  )
  select count(*) into v_ok from revertidos;

  v_alterad := v_lote.total - v_ok - v_escal - v_pagos;

  update public.lotes_aprovacao set
    desfeito_em = now(), desfeito_por = v_org.nome,
    desfeitos = v_ok, nao_desfeitos = v_lote.total - v_ok
  where id = p_lote;

  return jsonb_build_object('ok', true, 'desfeitos', v_ok, 'nao_desfeitos', v_lote.total - v_ok,
                            'escalados', v_escal, 'pagaram', v_pagos, 'alterados', v_alterad);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Historico
-- ---------------------------------------------------------------------------
create or replace function public.listar_lotes_aprovacao()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(x order by (x ->> 'criado_em') desc)
    from (
      select jsonb_build_object(
        'id', l.id,
        'criado_em', l.criado_em,
        'criado_por', l.criado_por,
        'descricao', l.descricao,
        'total', l.total,
        'desfeito_em', l.desfeito_em,
        'desfeito_por', l.desfeito_por,
        'desfeitos', l.desfeitos,
        'nao_desfeitos', l.nao_desfeitos,
        -- Quantos ainda voltariam a pendente agora (so enquanto o lote nao foi desfeito).
        'desfazivel', case when l.desfeito_em is not null then 0 else (
          select count(*)
            from public.lotes_aprovacao_itens i
            join public.equipantes e on e.id = i.equipante_id
           where i.lote_id = l.id
             and e.status = 'aprovado'
             and e.decidido_em = l.criado_em
             and e.decidido_por_tipo = 'organizador'
             and coalesce(e.status_pagamento, 'pendente') = 'pendente'
             and not exists (select 1 from public.escalas s where s.equipante_id = e.id)
        ) end
      ) as x
      from public.lotes_aprovacao l
      order by l.criado_em desc
      limit 30
    ) t
  ), '[]'::jsonb);
end;
$fn$;

revoke all on function public.aprovar_em_lote(uuid[], text, text) from public, anon;
revoke all on function public.desfazer_lote_aprovacao(uuid)       from public, anon;
revoke all on function public.listar_lotes_aprovacao()            from public, anon;
grant execute on function public.aprovar_em_lote(uuid[], text, text) to authenticated;
grant execute on function public.desfazer_lote_aprovacao(uuid)       to authenticated;
grant execute on function public.listar_lotes_aprovacao()            to authenticated;
