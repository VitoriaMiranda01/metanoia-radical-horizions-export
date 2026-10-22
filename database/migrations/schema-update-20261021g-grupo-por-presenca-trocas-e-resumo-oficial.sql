-- ---------------------------------------------------------------------------
-- Grupo de WhatsApp por presenca, trocas de area, presenca automatica do
-- lider e resumo antes da escala oficial (21/10/2026, Patrick).
--
-- 1) O link do grupo so libera para quem esta PRESENTE na escala provisoria; na
--    oficial libera para todo escalado. O acompanhamento mostra o botao
--    (equipante_grupos) e a revelacao da area (revelar_area) usa a mesma regra.
-- 2) O convite manual do lider vale para qualquer pessoa da equipe (a presenca
--    so conta no dia da leitura): o envio fica no registro grupo_envios_lider.
-- 3) Troca de area/cor (qualquer caminho) vira registro em escala_trocas: a lista
--    da area nova mostra "veio de ...", a da antiga mostra "foi para ..." e as
--    marcacoes do grupo antigo da pessoa sao zeradas.
-- 4) Lider/responsavel ficam presentes no primeiro clique em "ver a lista da
--    equipe" (lider_presenca_propria); podem tirar a propria presenca depois.
-- 5) resumo_antes_da_oficial: quem ainda esta aguardando aprovacao, na fila
--    "A escalar", ausente ou sem chamada (so aviso, a decisao de lancar e do
--    organizador).
-- ---------------------------------------------------------------------------

-- 1) Liberacao do link ------------------------------------------------------
create or replace function public._grupo_liberado(p_escala uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select c.escala_oficial_em is not null from public.configuracoes c limit 1), false)
      or exists (select 1 from public.chamada_escala c
                   join public.escalas s on s.id = c.escala_id and c.area = s.area_alocada
                  where c.escala_id = p_escala and c.presente);
$$;
revoke all on function public._grupo_liberado(uuid) from public, anon, authenticated;

create or replace function public._grupo_link_liberado(p_escala uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when public._grupo_liberado(p_escala) then public._grupo_link_da_escala(p_escala) end;
$$;
revoke all on function public._grupo_link_liberado(uuid) from public, anon, authenticated;

create or replace function public.equipante_grupos(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_of boolean := coalesce((select c.escala_oficial_em is not null from public.configuracoes c limit 1), false);
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro', 'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;
  -- Sem escala lancada, com pendencia no cadastro ou (na provisoria) sem ter visto a
  -- area: nada a mostrar -- a area segue em segredo ate a revelacao.
  if (select escala_lancada_em from public.configuracoes limit 1) is null
     or jsonb_array_length(public._pendencias_equipante(p_id)) > 0
     or (not v_of and (select area_vista_em from public.equipantes where id = p_id) is null) then
    return jsonb_build_object('ok', true, 'oficial', v_of, 'areas', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'oficial', v_of, 'areas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'escala_id', s.id, 'area', s.area_alocada, 'cor', s.cor, 'atuacao', s.atuacao,
             'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
             'presente', (select c.presente from public.chamada_escala c where c.escala_id = s.id and c.area = s.area_alocada),
             'grupo_link', public._grupo_link_liberado(s.id),
             'grupo_aberto_em', (select w.aberto_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
             'grupo_pedido_em', (select w.nao_conseguiu_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
             'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id))
           order by not public._area_principal(s.area_alocada), s.created_at), '[]'::jsonb)
      from public.escalas s
     where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado'));
end;
$$;
revoke all on function public.equipante_grupos(uuid, text, text, date) from public;
grant execute on function public.equipante_grupos(uuid, text, text, date) to anon, authenticated;

-- 3) Trocas de area ---------------------------------------------------------
create table if not exists public.escala_trocas (
  id            bigint generated always as identity primary key,
  escala_id     uuid not null references public.escalas(id) on delete cascade,
  area_anterior text not null,
  cor_anterior  text,
  area_nova     text not null,
  cor_nova      text,
  em            timestamptz not null default now()
);
create index if not exists escala_trocas_escala_idx on public.escala_trocas (escala_id, em);
create index if not exists escala_trocas_area_idx on public.escala_trocas (area_anterior);
alter table public.escala_trocas enable row level security;
revoke all on public.escala_trocas from anon, authenticated;

create or replace function public._registrar_troca_area()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.area_alocada = 'Não será escalado' then
    return new;
  end if;
  -- Mesma cor entre areas de trilha = mesmo grupo de WhatsApp: nada a avisar.
  if public._area_trilha(old.area_alocada) and public._area_trilha(new.area_alocada)
     and old.cor is not null and old.cor is not distinct from new.cor then
    return new;
  end if;
  if new.area_alocada is distinct from old.area_alocada
     or (new.cor is distinct from old.cor and old.cor is not null and public._equipe_por_cor(new.area_alocada)) then
    insert into public.escala_trocas (escala_id, area_anterior, cor_anterior, area_nova, cor_nova)
    values (new.id, old.area_alocada, old.cor, new.area_alocada, new.cor);
    delete from public.grupo_whatsapp_equipe where escala_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public._registrar_troca_area() from public, anon, authenticated;

drop trigger if exists registrar_troca_area on public.escalas;
create trigger registrar_troca_area after update of area_alocada, cor on public.escalas
  for each row execute function public._registrar_troca_area();

-- 4) Presenca automatica do lider/responsavel -------------------------------
create or replace function public.lider_presenca_propria(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_n int;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  -- So no primeiro clique: quem ja tem chamada (mesmo ausente, ou retirada) nao e mexido.
  insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
  select s.id, s.area_alocada, true, v_auth->>'nome', now()
    from public.escalas s
   where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado'
  on conflict (escala_id) do update
    set area = excluded.area, presente = true, marcado_por = excluded.marcado_por, marcado_em = excluded.marcado_em,
        convite_enviado_em = null
    where public.chamada_escala.area <> excluded.area;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marcadas', v_n);
end;
$$;
revoke all on function public.lider_presenca_propria(uuid, text, text, date) from public;
grant execute on function public.lider_presenca_propria(uuid, text, text, date) to anon, authenticated;

-- 5) Resumo antes de lancar a oficial ---------------------------------------
create or replace function public.resumo_antes_da_oficial()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  return jsonb_build_object('ok', true,
    'aguardando', (select coalesce(jsonb_agg(jsonb_build_object('nome', q.nome, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra)
                                             order by q.nome), '[]'::jsonb)
                     from public.equipantes q where q.tipo = 'equipante' and q.status = 'pendente'),
    'a_escalar', (select coalesce(jsonb_agg(jsonb_build_object('nome', q.nome, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra)
                                            order by q.nome), '[]'::jsonb)
                    from public.equipantes q
                   where q.tipo = 'equipante' and q.status = 'aprovado'
                     and not exists (select 1 from public.escalas e where e.equipante_id = q.id)),
    'ausentes', (select coalesce(jsonb_agg(jsonb_build_object('nome', q.nome, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra,
                                                              'area', s.area_alocada) order by s.area_alocada, q.nome), '[]'::jsonb)
                   from public.escalas s
                   join public.equipantes q on q.id = s.equipante_id
                   join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
                  where c.presente = false and c.mantido_em is null
                    and s.area_alocada not in ('Não será escalado', 'Recepção Sítio', 'Recepção Igreja', 'Equipe de Manutenção')),
    'sem_chamada', (select coalesce(jsonb_agg(jsonb_build_object('nome', q.nome, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra,
                                                                 'area', s.area_alocada) order by s.area_alocada, q.nome), '[]'::jsonb)
                      from public.escalas s
                      join public.equipantes q on q.id = s.equipante_id
                      left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
                     where c.escala_id is null
                       and s.area_alocada not in ('Não será escalado', 'Recepção Sítio', 'Recepção Igreja', 'Equipe de Manutenção')));
end;
$$;
revoke all on function public.resumo_antes_da_oficial() from public, anon;
grant execute on function public.resumo_antes_da_oficial() to authenticated;

-- Patches em funcoes existentes (pg_get_functiondef + replace; erro se o
-- trecho nao for encontrado).
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

-- revelar_area: o link so vem para quem esta liberado (presente, ou oficial).
select pg_temp._patch('public.revelar_area(uuid,text,text,date)'::regprocedure,
  $a$public._grupo_link_da_escala(s.id)$a$, $b$public._grupo_link_liberado(s.id)$b$);

-- relacao_lider: convite enviado tambem para quem nao tem presenca; "veio de" nos
-- membros e "trocados" (quem saiu desta equipe) em cada equipe.
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
  $a$'convite_enviado_em', c.convite_enviado_em,$a$,
  $b$'convite_enviado_em', coalesce(c.convite_enviado_em,
                                       (select max(l2.enviado_em) from public.grupo_envios_lider l2 where l2.escala_id = s.id)),$b$);
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
  $a$'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),$a$,
  $b$'no_grupo_em', (select w.no_grupo_em from public.grupo_whatsapp_equipe w where w.escala_id = s.id),
                      'veio_de', (select t.area_anterior || coalesce(' ' || t.cor_anterior, '')
                                    from public.escala_trocas t
                                   where t.escala_id = s.id and t.area_nova = s.area_alocada
                                   order by t.em desc limit 1),$b$);
select pg_temp._patch('public.relacao_lider(uuid,text,text,date)'::regprocedure,
  $a$'grupo_link', (select g.link from public.grupos_lider g where g.escala_id = e.chave_grupo),$a$,
  $b$'grupo_link', (select g.link from public.grupos_lider g where g.escala_id = e.chave_grupo),
           'trocados', (select coalesce(jsonb_agg(jsonb_build_object('escala_id', z.escala_id, 'nome', z.nome, 'foi_para', z.foi_para)
                                                  order by z.nome), '[]'::jsonb)
                          from (select distinct on (t.escala_id) t.escala_id, q.nome,
                                       s2.area_alocada || coalesce(' ' || s2.cor, '') as foi_para
                                  from public.escala_trocas t
                                  join public.escalas s2 on s2.id = t.escala_id
                                  join public.equipantes q on q.id = s2.equipante_id
                                 where (t.area_anterior = e.area
                                        or (e.area = 'Invisível' and t.area_anterior = 'Marcador')
                                        or (e.area = 'Selva' and t.area_anterior = 'Perseguidos'))
                                   and (not public._equipe_por_cor(e.area) or e.cor is null
                                        or t.cor_anterior is null or t.cor_anterior = e.cor)
                                   and not public._na_equipe_de(e.area, e.cor, t.escala_id)
                                 order by t.escala_id, t.em desc) z),$b$);

-- A assinatura passa a mudar quando o convite e enviado a quem nao tem chamada.
select pg_temp._patch('public._assinatura_relacao(uuid)'::regprocedure,
  $a$coalesce(c.convite_enviado_em::text, '-')$a$,
  $b$coalesce(c.convite_enviado_em::text, (select max(l2.enviado_em)::text from public.grupo_envios_lider l2 where l2.escala_id = s.id), '-')$b$);

-- lider_marcar_convite: sem exigir presenca (a decisao e do lider; o limite de
-- envios continua valendo).
select pg_temp._patch('public.lider_marcar_convite(uuid,text,text,date,uuid)'::regprocedure,
  $a$  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Marque a presença antes de enviar o convite.');
  end if;
$a$, '');
