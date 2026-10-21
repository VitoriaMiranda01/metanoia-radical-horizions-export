-- ---------------------------------------------------------------------------
-- Grupo de WhatsApp da equipe: link na tela do equipante, limite de envios e
-- pedido "nao consegui entrar" (21/10/2026, Patrick).
--
-- Problema: convidar um por um pelo WhatsApp pessoal travou o numero de varios
-- lideres por 24h (o WhatsApp entende como spam), e quem foi removido de um
-- grupo nao consegue voltar pelo link ("um admin removeu voce").
--
-- 1) O equipante escalado ve, na propria area, o botao "Entrar no grupo". O
--    clique grava "abriu o link" (grupo_whatsapp_equipe). Se o WhatsApp nao o
--    deixar entrar, ele toca em "Nao consegui entrar" e aparece destacado na
--    lista do lider/responsavel (que o adiciona pelo contato).
-- 2) O lider/responsavel marca "ja esta no grupo" a mao (o site nao sabe se
--    a pessoa realmente entrou).
-- 3) Envio manual do convite (lider_marcar_convite): no maximo 40 a cada 24h por
--    quem envia (janela movel; grupo_envios_lider). O limite fica em
--    _limite_envios_convite().
-- ---------------------------------------------------------------------------

create table if not exists public.grupo_whatsapp_equipe (
  escala_id        uuid primary key references public.escalas(id) on delete cascade,
  aberto_em        timestamptz,
  nao_conseguiu_em timestamptz,
  no_grupo_em      timestamptz
);
alter table public.grupo_whatsapp_equipe enable row level security;
revoke all on public.grupo_whatsapp_equipe from anon, authenticated;

create table if not exists public.grupo_envios_lider (
  id         bigint generated always as identity primary key,
  lider_id   uuid not null references public.equipantes(id) on delete cascade,
  escala_id  uuid references public.escalas(id) on delete cascade,
  enviado_em timestamptz not null default now()
);
create index if not exists grupo_envios_lider_idx on public.grupo_envios_lider (lider_id, enviado_em);
alter table public.grupo_envios_lider enable row level security;
revoke all on public.grupo_envios_lider from anon, authenticated;

create or replace function public._limite_envios_convite()
returns int language sql immutable as $$ select 40 $$;
revoke all on function public._limite_envios_convite() from public, anon, authenticated;

-- { usados, limite, libera_em } de quem envia (janela movel de 24h).
create or replace function public._envios_do_lider(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usados', count(*),
    'limite', public._limite_envios_convite(),
    'libera_em', case when count(*) >= public._limite_envios_convite()
                      then (select min(x.enviado_em) + interval '24 hours'
                              from (select enviado_em from public.grupo_envios_lider
                                     where lider_id = p_id and enviado_em > now() - interval '24 hours'
                                     order by enviado_em desc limit public._limite_envios_convite()) x)
                 end)
  from public.grupo_envios_lider
  where lider_id = p_id and enviado_em > now() - interval '24 hours';
$$;
revoke all on function public._envios_do_lider(uuid) from public, anon, authenticated;

-- Link do grupo da equipe de uma participacao. Mesma regra da relacao do
-- lider: trilha com cor = um grupo por cor; as demais = grupo da area (a cor
-- so conta nas areas que tem cor).
create or replace function public._grupo_link_da_escala(p_escala uuid)
returns text language sql stable security definer set search_path = public as $$
  select g.link
    from public.grupos_lider g
    join public.escalas l on l.id = g.escala_id
    join public.escalas s on s.id = p_escala
   where (
           (public._area_trilha(s.area_alocada) and s.cor is not null
            and public._area_trilha(l.area_alocada) and l.cor = s.cor)
        or (not (public._area_trilha(s.area_alocada) and s.cor is not null)
            and (l.area_alocada = s.area_alocada
                 or (s.area_alocada = 'Marcador' and l.area_alocada = 'Invisível')
                 or (s.area_alocada = 'Perseguidos' and l.area_alocada = 'Selva'))
            and (not public._equipe_por_cor(s.area_alocada) or s.cor is null or l.cor is null or l.cor = s.cor))
         )
   order by (l.area_alocada = s.area_alocada) desc, g.atualizado_em desc nulls last
   limit 1;
$$;
revoke all on function public._grupo_link_da_escala(uuid) from public, anon, authenticated;

-- Equipante: abriu o link do grupo.
create or replace function public.equipante_grupo_abriu(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;
  if not exists (select 1 from public.escalas s where s.id = p_escala_id and s.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Participação não encontrada.');
  end if;
  insert into public.grupo_whatsapp_equipe (escala_id, aberto_em) values (p_escala_id, now())
  on conflict (escala_id) do update set aberto_em = coalesce(public.grupo_whatsapp_equipe.aberto_em, now());
  return jsonb_build_object('ok', true);
end;
$$;

-- Equipante: "Nao consegui entrar" (p_valor true) ou desfaz (false).
create or replace function public.equipante_grupo_nao_consegui(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid, p_valor boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;
  if not exists (select 1 from public.escalas s where s.id = p_escala_id and s.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Participação não encontrada.');
  end if;
  insert into public.grupo_whatsapp_equipe (escala_id, nao_conseguiu_em)
  values (p_escala_id, case when p_valor then now() end)
  on conflict (escala_id) do update
    set nao_conseguiu_em = case when p_valor then now() end,
        no_grupo_em = case when p_valor then null else public.grupo_whatsapp_equipe.no_grupo_em end;
  return jsonb_build_object('ok', true);
end;
$$;

-- Lider/responsavel: marca (ou desmarca) "ja esta no grupo".
create or replace function public.lider_marcar_no_grupo(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid, p_valor boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if public._lider_da_participacao(p_id, p_escala_id) is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;
  insert into public.grupo_whatsapp_equipe (escala_id, no_grupo_em)
  values (p_escala_id, case when p_valor then now() end)
  on conflict (escala_id) do update
    set no_grupo_em = case when p_valor then now() end,
        nao_conseguiu_em = case when p_valor then null else public.grupo_whatsapp_equipe.nao_conseguiu_em end;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.equipante_grupo_abriu(uuid, text, text, date, uuid) from public;
revoke all on function public.equipante_grupo_nao_consegui(uuid, text, text, date, uuid, boolean) from public;
revoke all on function public.lider_marcar_no_grupo(uuid, text, text, date, uuid, boolean) from public;
grant execute on function public.equipante_grupo_abriu(uuid, text, text, date, uuid) to anon, authenticated;
grant execute on function public.equipante_grupo_nao_consegui(uuid, text, text, date, uuid, boolean) to anon, authenticated;
grant execute on function public.lider_marcar_no_grupo(uuid, text, text, date, uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patches em funcoes existentes (pg_get_functiondef + replace; erro se o
-- trecho nao for encontrado).
-- ---------------------------------------------------------------------------
create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text)
returns void language plpgsql as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> 1 then
    raise exception 'patch %: esperava 1 ocorrencia de [%], achou %', p_fn, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

-- revelar_area: cada area devolve a participacao, o link e o estado do grupo.
select pg_temp._patch('public.revelar_area(uuid,text,text,date)'::regprocedure,
$a$'principal', public._area_principal(s.area_alocada))$a$,
$b$'principal', public._area_principal(s.area_alocada),
             'escala_id', s.id,
             'grupo_link', public._grupo_link_da_escala(s.id),
             'grupo_aberto_em', (select w.aberto_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
             'grupo_pedido_em', (select w.nao_conseguiu_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
             'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id))$b$);

-- relacao_lider: estado do grupo de cada membro e a conta de envios de quem esta vendo.
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
$a$'convite_enviado_em', c.convite_enviado_em,$a$,
$b$'convite_enviado_em', c.convite_enviado_em,
                      'grupo_aberto_em', (select w.aberto_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
                      'grupo_pedido_em', (select w.nao_conseguiu_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
                      'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),$b$);
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
$a$'assinatura', public._assinatura_relacao(p_id),$a$,
$b$'assinatura', public._assinatura_relacao(p_id),
    'envios', public._envios_do_lider(p_id),$b$);

-- A assinatura passa a mudar quando o estado do grupo muda (tela do lider atualiza).
select pg_temp._patch('public._assinatura_relacao(uuid)'::regprocedure,
$a$|| coalesce(c.convite_enviado_em::text, '-')$a$,
$b$|| coalesce(c.convite_enviado_em::text, '-') || ','
                                           || coalesce((select coalesce(w.aberto_em::text, '-') || coalesce(w.nao_conseguiu_em::text, '-') || coalesce(w.no_grupo_em::text, '-')
                                                          from public.grupo_whatsapp_equipe w where w.escala_id = s.id), '-')$b$);

-- lider_marcar_convite: limite de envios por 24h e registro de cada envio.
select pg_temp._patch('public.lider_marcar_convite(uuid,text,text,date,uuid)'::regprocedure,
$a$  select s.equipante_id into v_eq from public.escalas s where s.id = p_escala_id;
$a$,
$b$  select s.equipante_id into v_eq from public.escalas s where s.id = p_escala_id;

  if (select (public._envios_do_lider(p_id)->>'usados')::int) >= public._limite_envios_convite() then
    return jsonb_build_object('ok', false, 'limite', true,
      'erro', 'Limite de ' || public._limite_envios_convite() || ' envios em 24 horas atingido.',
      'envios', public._envios_do_lider(p_id));
  end if;
$b$);
select pg_temp._patch('public.lider_marcar_convite(uuid,text,text,date,uuid)'::regprocedure,
$a$  return jsonb_build_object('ok', true);
end;$a$,
$b$  insert into public.grupo_envios_lider (lider_id, escala_id) values (p_id, p_escala_id);
  return jsonb_build_object('ok', true, 'envios', public._envios_do_lider(p_id));
end;$b$);
