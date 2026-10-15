-- Lider v2 (15/10/2026, pedido do Patrick, antes da Leitura de Escala de 18/10)
--
--  * Areas principais x secundarias (so interno): a revelacao mostra as
--    principais em destaque e as secundarias + areas extras embaixo. A
--    presenca "confirmada" conta so as principais.
--  * Equipe = (area, cor). O lider ve a sua; o Invisivel de cada cor ve
--    tambem os Marcadores da mesma cor (Marcador nao tem lider).
--  * Responsavel pela reuniao (delegado): escolhido pelo lider (dentro da
--    equipe) ou pelos organizadores. Faz chamada e grupo do WhatsApp.
--  * Lider troca a atuacao (areas com 2+ atuacoes alem do lider, menos Guia)
--    e, so na Fotografia, a cor. Cada troca fica registrada.
--  * Lider de area extra (caminhao/cozinha/limpeza): ve os aprovados e pode
--    puxar mais gente para a lista.
--  * Recepcao Sitio deixa de ter a atuacao Lider (nao tem lider).

-- ---------------------------------------------------------------- tabelas
create table if not exists public.responsaveis_reuniao (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  cor text,
  equipante_id uuid not null references public.equipantes(id) on delete cascade,
  definido_por text,
  definido_por_tipo text,           -- 'lider' | 'organizador'
  definido_em timestamptz not null default now()
);
create unique index if not exists responsaveis_reuniao_equipe
  on public.responsaveis_reuniao (area, (coalesce(cor, '')));
alter table public.responsaveis_reuniao enable row level security;

create table if not exists public.lideres_area_extra (
  area text primary key check (area in ('caminhao', 'cozinha', 'limpeza')),
  equipante_id uuid not null references public.equipantes(id) on delete cascade,
  definido_por text,
  definido_em timestamptz not null default now()
);
alter table public.lideres_area_extra enable row level security;

-- O que o lider mudou na escala (atuacao, cor): a auditoria so registra
-- organizador logado, e o lider nao loga.
create table if not exists public.alteracoes_lider (
  id bigint generated always as identity primary key,
  escala_id uuid references public.escalas(id) on delete set null,
  equipante_id uuid,
  area text,
  campo text not null,
  de text,
  para text,
  por text,
  em timestamptz not null default now()
);
alter table public.alteracoes_lider enable row level security;

delete from public.atuacoes_areas
 where area_nome = 'Recepção Sítio' and eh_lider
   and not exists (select 1 from public.escalas s
                    where s.area_alocada = 'Recepção Sítio' and s.atuacao = atuacoes_areas.atuacao);

-- ---------------------------------------------------------------- areas
create or replace function public._area_principal(p_area text)
returns boolean language sql immutable set search_path = public as $$
  select p_area is not null and p_area not in (
    'Não será escalado',
    'Ataque / Madrugada', 'Recepção Sítio',
    'Recepção Igreja', 'Cozinha Igreja', 'Som / Multimídia', 'Estacionamento', 'Mesa crachá',
    'Família muçulmana', 'Apresentadores', 'Equipe de Manutenção');
$$;

-- ---------------------------------------------------------------- equipes
create or replace function public._na_equipe_de(p_area text, p_cor text, p_escala uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.escalas s
     where s.id = p_escala
       and (s.area_alocada = p_area or (p_area = 'Invisível' and s.area_alocada = 'Marcador'))
       and (not public._area_com_cor(p_area) or p_cor is null or s.cor is null or s.cor = p_cor));
$$;

create or replace function public._na_equipe(p_lider_escala uuid, p_escala uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select public._na_equipe_de(l.area_alocada,
             case when public._area_com_cor(l.area_alocada) then l.cor end, p_escala)
      from public.escalas l where l.id = p_lider_escala), false);
$$;

-- As equipes que a pessoa conduz: como lider ou como responsavel pela
-- reuniao. chave_grupo = a linha que guarda o link do grupo do WhatsApp (a do
-- lider; sem lider, a do proprio responsavel na area).
create or replace function public._equipes_do(p_id uuid)
returns table(area text, cor text, papel text, chave_grupo uuid, escala_lider uuid)
language sql stable security definer set search_path = public as $$
  with lid as (
    select l.area_alocada as area,
           case when public._area_com_cor(l.area_alocada) then l.cor end as cor,
           'lider'::text as papel, l.id as escala_lider
      from public.escalas l
     where l.equipante_id = p_id and public._eh_lider(l.area_alocada, l.atuacao)
  ), del as (
    select r.area, r.cor, 'delegado'::text as papel,
           (select l.id from public.escalas l
             where l.area_alocada = r.area and public._eh_lider(l.area_alocada, l.atuacao)
               and (not public._area_com_cor(r.area) or r.cor is null or l.cor is null or l.cor = r.cor)
             order by l.created_at limit 1) as escala_lider
      from public.responsaveis_reuniao r
     where r.equipante_id = p_id
       and not exists (select 1 from lid where lid.area = r.area and lid.cor is not distinct from r.cor)
  )
  select x.area, x.cor, x.papel,
         coalesce(x.escala_lider,
                  (select s.id from public.escalas s
                    where s.equipante_id = p_id and s.area_alocada = x.area limit 1)),
         x.escala_lider
    from (select * from lid union all select * from del) x;
$$;

create or replace function public._lider_da_participacao(p_lider uuid, p_escala uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public._equipes_do(p_lider) e
                            where public._na_equipe_de(e.area, e.cor, p_escala))
              then p_escala end;
$$;

create or replace function public._lider_autenticado(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'A escala ainda não foi lançada.');
  end if;
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;
  if not exists (select 1 from public._equipes_do(p_id))
     and not exists (select 1 from public.lideres_area_extra x where x.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Você não está como líder na escala.');
  end if;
  return jsonb_build_object('ok', true,
    'nome', (select nome from public.equipantes where id = p_id));
end;
$$;

-- ---------------------------------------------------------------- relacao
create or replace function public.relacao_lider(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_equipes jsonb;
  v_extras jsonb;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'chave', e.area || '|' || coalesce(e.cor, ''),
           'escala_id', e.chave_grupo,
           'area', e.area,
           'cor', e.cor,
           'papel', e.papel,
           'grupo_link', (select g.link from public.grupos_lider g where g.escala_id = e.chave_grupo),
           'atuacoes', case when e.papel = 'lider' and e.area <> 'Guia'
                             and (select count(*) from public.atuacoes_areas a
                                   where a.area_nome = e.area and not a.eh_lider) >= 2
                            then (select jsonb_agg(a.atuacao order by a.ordem) from public.atuacoes_areas a
                                   where a.area_nome = e.area and not a.eh_lider) end,
           'pode_trocar_cor', e.papel = 'lider' and e.area = 'Fotografia',
           'delegado', (select jsonb_build_object('equipante_id', q.id, 'nome', q.nome,
                                                  'definido_por', r.definido_por)
                          from public.responsaveis_reuniao r
                          join public.equipantes q on q.id = r.equipante_id
                         where r.area = e.area and r.cor is not distinct from e.cor),
           'lideres', (select coalesce(jsonb_agg(q.nome order by q.nome), '[]'::jsonb)
                         from public.escalas l join public.equipantes q on q.id = l.equipante_id
                        where l.area_alocada = e.area and public._eh_lider(l.area_alocada, l.atuacao)
                          and (not public._area_com_cor(e.area) or e.cor is null or l.cor is null or l.cor = e.cor)),
           'membros', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'escala_id', s.id,
                      'equipante_id', q.id,
                      'nome', q.nome,
                      'igreja', q.igreja,
                      'igreja_outra', q.igreja_outra,
                      'whatsapp', q.whatsapp,
                      'estrangeiro', nullif(regexp_replace(coalesce(q.cpf,''), '\D', '', 'g'), '') is null,
                      'area', s.area_alocada,
                      'atuacao', s.atuacao,
                      'cor', s.cor,
                      'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
                      'eu', q.id = p_id,
                      'pendencias', public._pendencias_relacao(q.id),
                      'presente', c.presente,
                      'marcado_por', c.marcado_por,
                      'convite_enviado_em', c.convite_enviado_em)
                    order by q.nome), '[]'::jsonb)
               from public.escalas s
               join public.equipantes q on q.id = s.equipante_id
               left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
              where public._na_equipe_de(e.area, e.cor, s.id))
         ) order by e.papel = 'delegado', e.area, e.cor), '[]'::jsonb)
    into v_equipes
    from public._equipes_do(p_id) e;

  select coalesce(jsonb_agg(jsonb_build_object(
           'area', x.area,
           'membros', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'equipante_id', q.id,
                      'nome', q.nome,
                      'igreja', q.igreja,
                      'igreja_outra', q.igreja_outra,
                      'whatsapp', q.whatsapp,
                      'estrangeiro', nullif(regexp_replace(coalesce(q.cpf,''), '\D', '', 'g'), '') is null,
                      'eu', q.id = p_id,
                      'incluido_pelo_lider', d.decidido_por_tipo = 'lider')
                    order by q.nome), '[]'::jsonb)
               from public.disponibilidade_extra d
               join public.equipantes q on q.id = d.equipante_id
              where d.area = x.area and d.aprovado)
         ) order by x.area), '[]'::jsonb)
    into v_extras
    from public.lideres_area_extra x
   where x.equipante_id = p_id;

  return jsonb_build_object('ok', true,
    'lider', v_auth->>'nome',
    'escala_oficial', (select escala_oficial_em is not null from public.configuracoes limit 1),
    'equipes', v_equipes,
    'extras', v_extras);
end;
$$;

-- ---------------------------------------------------------------- grupo
create or replace function public.lider_salvar_grupo(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_lider uuid, p_link text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_link text := btrim(coalesce(p_link, ''));
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if p_escala_lider is null
     or not exists (select 1 from public._equipes_do(p_id) e where e.chave_grupo = p_escala_lider) then
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
$$;

-- ---------------------------------------------------------------- atuacao / cor
create or replace function public.lider_trocar_atuacao(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid, p_atuacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  s public.escalas;
  v_sem_cor boolean;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  select * into s from public.escalas where id = p_escala_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está mais na escala.');
  end if;
  if not exists (select 1 from public._equipes_do(p_id) e
                  where e.papel = 'lider' and e.area = s.area_alocada
                    and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da área troca a atuação.');
  end if;
  if s.area_alocada = 'Guia'
     or (select count(*) from public.atuacoes_areas a
          where a.area_nome = s.area_alocada and not a.eh_lider) < 2 then
    return jsonb_build_object('ok', false, 'erro', 'Esta área não tem troca de atuação.');
  end if;
  if public._eh_lider(s.area_alocada, s.atuacao) then
    return jsonb_build_object('ok', false, 'erro', 'A atuação de líder só os organizadores trocam.');
  end if;
  select a.sem_cor into v_sem_cor from public.atuacoes_areas a
   where a.area_nome = s.area_alocada and a.atuacao = p_atuacao and not a.eh_lider;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Atuação inválida para esta área.');
  end if;
  if s.atuacao is not distinct from p_atuacao then
    return jsonb_build_object('ok', true);
  end if;

  update public.escalas
     set atuacao = p_atuacao,
         cor = case when coalesce(v_sem_cor, false) then null else cor end
   where id = s.id;

  insert into public.alteracoes_lider (escala_id, equipante_id, area, campo, de, para, por)
  values (s.id, s.equipante_id, s.area_alocada, 'atuacao', s.atuacao, p_atuacao, v_auth->>'nome');

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.lider_definir_cor(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid, p_cor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  s public.escalas;
  v_cor text := nullif(btrim(coalesce(p_cor, '')), '');
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  select * into s from public.escalas where id = p_escala_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está mais na escala.');
  end if;
  if s.area_alocada <> 'Fotografia'
     or not exists (select 1 from public._equipes_do(p_id) e
                     where e.papel = 'lider' and e.area = 'Fotografia'
                       and public._na_equipe_de(e.area, e.cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Fotografia escolhe a cor.');
  end if;
  if public._eh_lider(s.area_alocada, s.atuacao) then
    return jsonb_build_object('ok', false, 'erro', 'A cor do líder só os organizadores trocam.');
  end if;
  if v_cor is not null and v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho') then
    return jsonb_build_object('ok', false, 'erro', 'Cor inválida.');
  end if;
  if s.cor is not distinct from v_cor then
    return jsonb_build_object('ok', true);
  end if;

  update public.escalas set cor = v_cor where id = s.id;

  insert into public.alteracoes_lider (escala_id, equipante_id, area, campo, de, para, por)
  values (s.id, s.equipante_id, s.area_alocada, 'cor', s.cor, v_cor, v_auth->>'nome');

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- delegar
create or replace function public.lider_delegar_reuniao(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_area text, p_cor text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_cor text := nullif(p_cor, '');
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public._equipes_do(p_id) e
                  where e.papel = 'lider' and e.area = p_area and e.cor is not distinct from v_cor) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da equipe delega a reunião.');
  end if;

  if p_equipante_id is null then
    delete from public.responsaveis_reuniao where area = p_area and cor is not distinct from v_cor;
    return jsonb_build_object('ok', true, 'delegado', null);
  end if;

  if p_equipante_id = p_id then
    return jsonb_build_object('ok', false, 'erro', 'Escolha outra pessoa da equipe.');
  end if;
  if not exists (select 1 from public.escalas s
                  where s.equipante_id = p_equipante_id
                    and public._na_equipe_de(p_area, v_cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;

  insert into public.responsaveis_reuniao (area, cor, equipante_id, definido_por, definido_por_tipo, definido_em)
  values (p_area, v_cor, p_equipante_id, v_auth->>'nome', 'lider', now())
  on conflict (area, (coalesce(cor, ''))) do update
     set equipante_id = excluded.equipante_id, definido_por = excluded.definido_por,
         definido_por_tipo = excluded.definido_por_tipo, definido_em = excluded.definido_em;

  return jsonb_build_object('ok', true,
    'delegado', (select nome from public.equipantes where id = p_equipante_id));
end;
$$;

-- Organizadores: todas as equipes, com lider(es), responsavel e membros.
create or replace function public.responsaveis_reuniao_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  with equipes as (
    select distinct l.area_alocada as area,
           case when public._area_com_cor(l.area_alocada) then l.cor end as cor
      from public.escalas l
     where public._eh_lider(l.area_alocada, l.atuacao)
    union
    select distinct s.area_alocada, null::text
      from public.escalas s
     where s.area_alocada not in ('Não será escalado', 'Marcador')
       and not exists (select 1 from public.escalas l
                        where l.area_alocada = s.area_alocada and public._eh_lider(l.area_alocada, l.atuacao))
    union
    select r.area, r.cor from public.responsaveis_reuniao r
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'area', e.area,
           'cor', e.cor,
           'lideres', (select coalesce(jsonb_agg(q.nome order by q.nome), '[]'::jsonb)
                         from public.escalas l join public.equipantes q on q.id = l.equipante_id
                        where l.area_alocada = e.area and public._eh_lider(l.area_alocada, l.atuacao)
                          and (not public._area_com_cor(e.area) or e.cor is null or l.cor is null or l.cor = e.cor)),
           'delegado', (select jsonb_build_object('equipante_id', q.id, 'nome', q.nome,
                                                  'definido_por', r.definido_por)
                          from public.responsaveis_reuniao r
                          join public.equipantes q on q.id = r.equipante_id
                         where r.area = e.area and r.cor is not distinct from e.cor),
           'membros', (select coalesce(jsonb_agg(distinct jsonb_build_object('equipante_id', q.id, 'nome', q.nome)), '[]'::jsonb)
                         from public.escalas s join public.equipantes q on q.id = s.equipante_id
                        where public._na_equipe_de(e.area, e.cor, s.id))
         ) order by e.area, e.cor), '[]'::jsonb)
    into v
    from equipes e;

  return jsonb_build_object('ok', true, 'equipes', v);
end;
$$;

create or replace function public.definir_responsavel_reuniao(p_area text, p_cor text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org record;
  v_cor text := nullif(p_cor, '');
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_equipante_id is null then
    delete from public.responsaveis_reuniao where area = p_area and cor is not distinct from v_cor;
    return jsonb_build_object('ok', true);
  end if;
  if not exists (select 1 from public.escalas s
                  where s.equipante_id = p_equipante_id and public._na_equipe_de(p_area, v_cor, s.id)) then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está nesta equipe.');
  end if;
  select * into v_org from public._organizador_do_cracha();
  insert into public.responsaveis_reuniao (area, cor, equipante_id, definido_por, definido_por_tipo, definido_em)
  values (p_area, v_cor, p_equipante_id, coalesce(v_org.nome, 'organizador'), 'organizador', now())
  on conflict (area, (coalesce(cor, ''))) do update
     set equipante_id = excluded.equipante_id, definido_por = excluded.definido_por,
         definido_por_tipo = excluded.definido_por_tipo, definido_em = excluded.definido_em;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- areas extras
create or replace function public.disponibilidades_extra()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  v_lideres jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  with ofertas as (
    select e.id as equipante_id, a.area, true as ofereceu
      from public.equipantes e
     cross join lateral (
       select unnest(array_remove(array[
         case when lower(public.unaccent_simples(e.area_trabalho_extra)) like '%caminh%' then 'caminhao' end,
         case when lower(public.unaccent_simples(e.area_trabalho_extra)) like '%cozinha%' then 'cozinha' end,
         case when lower(public.unaccent_simples(e.area_trabalho_extra)) like '%limpeza%' then 'limpeza' end
       ], null)) as area) a
     where e.tipo = 'equipante' and coalesce(btrim(e.area_trabalho_extra), '') <> ''
  ), todas as (
    select * from ofertas
    union all
    select d.equipante_id, d.area, false
      from public.disponibilidade_extra d
     where not exists (select 1 from ofertas o where o.equipante_id = d.equipante_id and o.area = d.area)
  )
  select coalesce(jsonb_agg(t order by t.area, t.nome), '[]'::jsonb) into v
  from (
    select e.id as equipante_id, e.nome, e.cpf, e.whatsapp, e.igreja, e.nacionalidade, e.status,
           o.area, o.ofereceu, d.aprovado, d.decidido_por, d.decidido_por_tipo, d.decidido_em
      from todas o
      join public.equipantes e on e.id = o.equipante_id
      left join public.disponibilidade_extra d on d.equipante_id = o.equipante_id and d.area = o.area
  ) t;

  select coalesce(jsonb_object_agg(x.area, jsonb_build_object('equipante_id', q.id, 'nome', q.nome)), '{}'::jsonb)
    into v_lideres
    from public.lideres_area_extra x join public.equipantes q on q.id = x.equipante_id;

  return jsonb_build_object('ok', true, 'itens', v, 'lideres', v_lideres);
end;
$$;

create or replace function public.definir_lider_area_extra(p_area text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org record;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_area is null or p_area not in ('caminhao', 'cozinha', 'limpeza') then
    return jsonb_build_object('ok', false, 'erro', 'Área extra inválida.');
  end if;
  if p_equipante_id is null then
    delete from public.lideres_area_extra where area = p_area;
    return jsonb_build_object('ok', true, 'lider', null);
  end if;
  if not exists (select 1 from public.equipantes where id = p_equipante_id and tipo = 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  select * into v_org from public._organizador_do_cracha();
  insert into public.lideres_area_extra (area, equipante_id, definido_por, definido_em)
  values (p_area, p_equipante_id, coalesce(v_org.nome, 'organizador'), now())
  on conflict (area) do update set equipante_id = excluded.equipante_id,
     definido_por = excluded.definido_por, definido_em = excluded.definido_em;

  -- O lider entra na propria lista, aprovado.
  insert into public.disponibilidade_extra (equipante_id, area, aprovado, decidido_por, decidido_por_tipo, decidido_em)
  values (p_equipante_id, p_area, true, coalesce(v_org.nome, 'organizador'), 'organizador', now())
  on conflict (equipante_id, area) do update set aprovado = true,
     decidido_por = excluded.decidido_por, decidido_por_tipo = excluded.decidido_por_tipo,
     decidido_em = excluded.decidido_em;

  return jsonb_build_object('ok', true,
    'lider', (select jsonb_build_object('equipante_id', id, 'nome', nome) from public.equipantes where id = p_equipante_id));
end;
$$;

create or replace function public.lider_extra_buscar(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_area text, p_termo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_termo text := lower(public.unaccent_simples(btrim(coalesce(p_termo, ''))));
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public.lideres_area_extra x where x.area = p_area and x.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Você não é o líder desta área extra.');
  end if;
  if length(v_termo) < 3 then
    return jsonb_build_object('ok', true, 'pessoas', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'pessoas', (
    select coalesce(jsonb_agg(jsonb_build_object('equipante_id', t.id, 'nome', t.nome,
                                                 'igreja', t.igreja, 'igreja_outra', t.igreja_outra)
                              order by t.nome), '[]'::jsonb)
      from (select e.id, e.nome, e.igreja, e.igreja_outra
              from public.equipantes e
             where e.tipo = 'equipante' and e.status = 'aprovado'
               and lower(public.unaccent_simples(e.nome)) like '%' || v_termo || '%'
               and not exists (select 1 from public.disponibilidade_extra d
                                where d.equipante_id = e.id and d.area = p_area and d.aprovado)
             order by e.nome limit 15) t));
end;
$$;

create or replace function public.lider_extra_incluir(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_area text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public.lideres_area_extra x where x.area = p_area and x.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Você não é o líder desta área extra.');
  end if;
  if not exists (select 1 from public.equipantes where id = p_equipante_id and tipo = 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  insert into public.disponibilidade_extra (equipante_id, area, aprovado, decidido_por, decidido_por_tipo, decidido_em)
  values (p_equipante_id, p_area, true, v_auth->>'nome', 'lider', now())
  on conflict (equipante_id, area) do update set aprovado = true,
     decidido_por = excluded.decidido_por, decidido_por_tipo = excluded.decidido_por_tipo,
     decidido_em = excluded.decidido_em;
  return jsonb_build_object('ok', true);
end;
$$;

-- O lider so tira quem ele mesmo puxou; quem o organizador aprovou fica.
create or replace function public.lider_extra_remover(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_area text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not exists (select 1 from public.lideres_area_extra x where x.area = p_area and x.equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'Você não é o líder desta área extra.');
  end if;
  delete from public.disponibilidade_extra
   where equipante_id = p_equipante_id and area = p_area and decidido_por_tipo = 'lider';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para tirar quem você incluiu. Os aprovados pela organização ficam.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- revelar
create or replace function public.revelar_area(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org boolean := public.eh_organizador();
  v_pend jsonb;
  v_areas jsonb;
  v_fora boolean;
  v_extras jsonb;
begin
  if not (v_org or public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'A escala ainda não foi divulgada.');
  end if;

  v_pend := public._pendencias_equipante(p_id);
  if jsonb_array_length(v_pend) > 0 and not v_org then
    return jsonb_build_object('ok', false, 'pendencias', v_pend);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
             'area', s.area_alocada, 'atuacao', s.atuacao, 'cor', s.cor,
             'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
             'principal', public._area_principal(s.area_alocada))
             order by not public._area_principal(s.area_alocada), s.created_at)
             filter (where s.area_alocada <> 'Não será escalado'), '[]'::jsonb),
         coalesce(bool_or(s.area_alocada = 'Não será escalado'), false)
    into v_areas, v_fora
    from public.escalas s
   where s.equipante_id = p_id;

  if jsonb_array_length(v_areas) = 0 then
    return jsonb_build_object('ok', true, 'areas', v_areas, 'nao_sera_escalado', v_fora);
  end if;

  select coalesce(jsonb_agg(d.area order by array_position(array['caminhao','cozinha','limpeza'], d.area)), '[]'::jsonb)
    into v_extras
    from public.disponibilidade_extra d
   where d.equipante_id = p_id and d.aprovado;

  if not v_org then
    update public.equipantes
       set area_vista_em = coalesce(area_vista_em, now())
     where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'areas', v_areas, 'extras', v_extras,
    'nao_sera_escalado', false,
    'escala_oficial', (select escala_oficial_em is not null from public.configuracoes limit 1));
end;
$$;

-- ---------------------------------------------------------------- situacao
create or replace function public.situacao_inscricao(p_tipo text, p_id uuid, p_cpf text default null, p_nome text default null, p_nascimento date default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  q record; v_lancada timestamptz; v_oficial timestamptz;
  v_tem_area boolean; v_tem_real boolean;
  v_fora boolean; v_escalado boolean; v_pago boolean; v_menor boolean;
  v_autorizado boolean;
  v_lider_de jsonb; v_delegado_de jsonb; v_extra_de jsonb; v_presenca text;
begin
  if not (public.eh_organizador()
          or public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome, p_nascimento)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  if p_tipo <> 'equipante' then
    select a.nome, a.status_pagamento into q from public.acampantes a where a.id = p_id;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
    end if;
    v_pago := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
    return jsonb_build_object('ok', true, 'tipo', 'acampante', 'nome', q.nome,
                              'pago', v_pago, 'pode_pagar', not v_pago);
  end if;

  select e.nome, public.idade(e) as idade, e.status, e.status_pagamento,
         e.parental_auth_file_url,
         e.autorizacao_entregue_em, e.autorizacao_conferida_em,
         e.autorizacao_conferida_por
    into q
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;

  select count(*) > 0,
         count(*) filter (where s.area_alocada <> 'Não será escalado') > 0
    into v_tem_area, v_tem_real
    from public.escalas s where s.equipante_id = p_id;

  v_pago  := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
  v_menor := coalesce(q.idade, 18) < 18;

  v_autorizado := q.parental_auth_file_url is not null
               or q.autorizacao_entregue_em is not null;

  v_escalado := v_lancada is not null and v_tem_real;
  v_fora     := v_lancada is not null and v_tem_area and not v_tem_real;

  if v_lancada is not null then
    select coalesce(jsonb_agg(jsonb_build_object('area', s.area_alocada,
             'cor', case when public._area_com_cor(s.area_alocada) then s.cor end)
             order by s.area_alocada), '[]'::jsonb)
      into v_lider_de
      from public.escalas s
     where s.equipante_id = p_id and public._eh_lider(s.area_alocada, s.atuacao);

    select coalesce(jsonb_agg(jsonb_build_object('area', e.area, 'cor', e.cor) order by e.area), '[]'::jsonb)
      into v_delegado_de
      from public._equipes_do(p_id) e where e.papel = 'delegado';

    select coalesce(jsonb_agg(x.area order by x.area), '[]'::jsonb)
      into v_extra_de
      from public.lideres_area_extra x where x.equipante_id = p_id;

    -- Presenca confirmada = presente em todas as areas PRINCIPAIS (as
    -- secundarias nem sempre tem quem faca a chamada). Sem principal, vale
    -- o que tiver.
    select case when bool_or(c.presente = false) then 'ausente'
                when count(c.escala_id) > 0 and count(c.escala_id) = count(*)
                     and bool_and(c.presente) then 'presente' end
      into v_presenca
      from public.escalas s
      left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
     where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado'
       and (public._area_principal(s.area_alocada)
            or not exists (select 1 from public.escalas p
                            where p.equipante_id = p_id and public._area_principal(p.area_alocada)));
  end if;

  return jsonb_build_object(
    'ok', true, 'tipo', 'equipante', 'nome', q.nome,
    'menor_de_idade', v_menor,
    'autorizacao_pais_enviada',   v_autorizado,
    'autorizacao_arquivo',        q.parental_auth_file_url is not null,
    'autorizacao_entregue_maos',  q.autorizacao_entregue_em is not null,
    'autorizacao_conferida',      q.autorizacao_conferida_em is not null,
    'autorizacao_conferida_por',  q.autorizacao_conferida_por,
    'aprovacao', coalesce(q.status, 'pendente'),
    'escala_lancada', v_lancada is not null,
    'escala_oficial', v_oficial is not null,
    'escalado', v_escalado,
    'nao_sera_escalado', v_fora,
    'lider_de', coalesce(v_lider_de, '[]'::jsonb),
    'delegado_de', coalesce(v_delegado_de, '[]'::jsonb),
    'lider_extra_de', coalesce(v_extra_de, '[]'::jsonb),
    'presenca', v_presenca,
    'pendencias', public._pendencias_equipante(p_id),
    'area_vista', (select area_vista_em is not null from public.equipantes where id = p_id),
    'pago', v_pago,
    'pode_pagar', (coalesce(q.status,'') = 'aprovado')
                  and v_escalado
                  and (not v_menor or v_autorizado)
                  and not v_pago
  );
end;
$$;

-- ---------------------------------------------------------------- permissoes
revoke all on function public._area_principal(text), public._na_equipe_de(text, text, uuid),
  public._equipes_do(uuid) from public, anon, authenticated;
grant execute on function public.lider_trocar_atuacao(uuid, text, text, date, uuid, text),
  public.lider_definir_cor(uuid, text, text, date, uuid, text),
  public.lider_delegar_reuniao(uuid, text, text, date, text, text, uuid),
  public.lider_extra_buscar(uuid, text, text, date, text, text),
  public.lider_extra_incluir(uuid, text, text, date, text, uuid),
  public.lider_extra_remover(uuid, text, text, date, text, uuid)
  to anon, authenticated;
grant execute on function public.responsaveis_reuniao_painel(),
  public.definir_responsavel_reuniao(text, text, uuid),
  public.definir_lider_area_extra(text, uuid)
  to authenticated;
