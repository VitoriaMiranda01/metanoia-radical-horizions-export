-- ---------------------------------------------------------------------------
-- Mensagem para ausentes e sem chamada (28/10/2026, Patrick).
--
-- No quadro da chamada, cada "ausente" e "sem chamada" ganha o botao
-- "Mensagem": abre o WhatsApp de quem envia com um texto pronto perguntando se
-- a pessoa vai mesmo nesta edicao. O site nao envia nada -- quem aperta enviar
-- e o organizador, no proprio WhatsApp.
--
-- Mesmo cuidado do convite do grupo (20261021f): mensagens em sequencia para
-- quem nao tem o numero salvo travaram o WhatsApp de varios lideres por 24h,
-- com ou sem link. Limite: 40 a cada 24h por organizador (janela movel),
-- contado aqui. Cada envio fica registrado (quem, quando) para a tela mostrar
-- "mensagem enviada" e evitar mandar duas vezes.
-- ---------------------------------------------------------------------------

create table if not exists public.chamada_mensagens (
  id             bigint generated always as identity primary key,
  escala_id      uuid not null references public.escalas(id) on delete cascade,
  organizador_id uuid not null,
  enviado_por    text,
  tipo           text not null check (tipo in ('ausente', 'sem')),
  enviado_em     timestamptz not null default now()
);
create index if not exists chamada_mensagens_org_idx on public.chamada_mensagens (organizador_id, enviado_em);
create index if not exists chamada_mensagens_escala_idx on public.chamada_mensagens (escala_id);
alter table public.chamada_mensagens enable row level security;
revoke all on public.chamada_mensagens from anon, authenticated;

create or replace function public._limite_mensagens_chamada()
returns int language sql immutable as $$ select 40 $$;
revoke all on function public._limite_mensagens_chamada() from public, anon, authenticated;

-- { usados, limite, libera_em } do organizador (janela movel de 24h).
create or replace function public._mensagens_do_organizador(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'usados', count(*),
    'limite', public._limite_mensagens_chamada(),
    'libera_em', case when count(*) >= public._limite_mensagens_chamada()
                      then (select min(x.enviado_em) + interval '24 hours'
                              from (select enviado_em from public.chamada_mensagens
                                     where organizador_id = p_org and enviado_em > now() - interval '24 hours'
                                     order by enviado_em desc limit public._limite_mensagens_chamada()) x)
                 end)
  from public.chamada_mensagens
  where organizador_id = p_org and enviado_em > now() - interval '24 hours';
$$;
revoke all on function public._mensagens_do_organizador(uuid) from public, anon, authenticated;

-- Estado para a tela: conta de quem esta vendo, o nome dele (vai na mensagem)
-- e a ultima mensagem de cada escala_id ({ em, por, vezes }).
create or replace function public.chamada_mensagens_estado()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  return jsonb_build_object('ok', true,
    'remetente', public._nome_organizador_logado(),
    'envios', public._mensagens_do_organizador(auth.uid()),
    'enviadas', (
      select coalesce(jsonb_object_agg(m.escala_id, jsonb_build_object('em', m.em, 'por', m.por, 'vezes', m.vezes)), '{}'::jsonb)
        from (select escala_id, max(enviado_em) as em,
                     (array_agg(enviado_por order by enviado_em desc))[1] as por,
                     count(*) as vezes
                from public.chamada_mensagens
               group by escala_id) m));
end;
$$;
revoke all on function public.chamada_mensagens_estado() from public, anon;
grant execute on function public.chamada_mensagens_estado() to authenticated;

-- Registra o envio (antes de abrir o WhatsApp). Barra no limite.
create or replace function public.chamada_registrar_mensagem(p_escala_id uuid, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := auth.uid();
begin
  if not public._gere_escala() or v_org is null then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if p_tipo is null or p_tipo not in ('ausente', 'sem') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de mensagem inválido.');
  end if;
  if not exists (select 1 from public.escalas
                  where id = p_escala_id and area_alocada <> 'Não será escalado') then
    return jsonb_build_object('ok', false, 'erro', 'Essa pessoa não está mais na escala.');
  end if;
  if (public._mensagens_do_organizador(v_org)->>'usados')::int >= public._limite_mensagens_chamada() then
    return jsonb_build_object('ok', false, 'limite', true,
      'erro', 'Limite de ' || public._limite_mensagens_chamada() || ' mensagens em 24 horas atingido.',
      'envios', public._mensagens_do_organizador(v_org));
  end if;

  insert into public.chamada_mensagens (escala_id, organizador_id, enviado_por, tipo)
  values (p_escala_id, v_org, public._nome_organizador_logado(), p_tipo);

  return jsonb_build_object('ok', true, 'envios', public._mensagens_do_organizador(v_org));
end;
$$;
revoke all on function public.chamada_registrar_mensagem(uuid, text) from public, anon;
grant execute on function public.chamada_registrar_mensagem(uuid, text) to authenticated;
