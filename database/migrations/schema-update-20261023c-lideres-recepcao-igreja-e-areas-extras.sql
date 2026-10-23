-- ---------------------------------------------------------------------------
-- Lideres da Recepcao Igreja e varios lideres nas areas extras
-- (23/10/2026, pedido do Patrick)
--
-- 1. AREAS EXTRAS (caminhao, cozinha, limpeza): mais de um lider por area.
--    lideres_area_extra deixa de ter uma linha por area: a chave vira
--    (area, equipante_id). definir_lider_area_extra ADICIONA um lider (antes
--    trocava); remover_lider_area_extra tira um. Todos os lideres da area
--    puxam e tiram gente da lista (as funcoes lider_extra_* ja conferiam
--    "x.area = p_area and x.equipante_id = p_id", nada muda nelas).
--    disponibilidades_extra devolve tambem 'lideres_por_area' (lista); a
--    chave antiga 'lideres' (um por area) fica para a tela velha em cache.
--
-- 2. RECEPCAO IGREJA: atuacao "Lider" (eh_lider). Quem e lider da Recepcao
--    Igreja e lider do MODULO inteiro (Recepcao Igreja, Cozinha Igreja,
--    Som / Multimidia, Estacionamento, Mesa cracha): _equipes_do devolve as
--    cinco equipes como 'lider', e a relacao ganha 'pode_gerenciar'.
--    Na relacao ele:
--      * inclui equipante aprovado em qualquer uma das cinco areas
--        (lider_modulo_buscar / lider_modulo_incluir). Sem teto de vagas: o
--        limite dessas areas e so aviso (migration 20261014a);
--      * tira pessoas dessas areas (lider_modulo_remover). Nunca tira lider,
--        nem a si mesmo. Se a pessoa ficaria SEM nenhuma area, so tira quem
--        foi incluido por um lider e ainda nao pagou -- o resto e com a
--        organizacao (senao o lider tiraria alguem da escala inteira);
--      * troca atuacao e delega a reuniao, como qualquer lider.
--    Tudo fica em alteracoes_lider (campo 'inclusao' / 'remocao') e a
--    inclusao marca escalas.incluido_por = 'Líder: <nome>'.
-- ---------------------------------------------------------------------------

-- ===================================================== 1. areas extras
alter table public.lideres_area_extra drop constraint if exists lideres_area_extra_pkey;
alter table public.lideres_area_extra add primary key (area, equipante_id);

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
  -- null: tira todos (compatibilidade com a tela antiga).
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
  on conflict (area, equipante_id) do nothing;

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

-- Tira UM lider. Ele continua aprovado na lista (como antes, ao trocar o lider).
create or replace function public.remover_lider_area_extra(p_area text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  delete from public.lideres_area_extra where area = p_area and equipante_id = p_equipante_id;
  return jsonb_build_object('ok', true);
end;
$$;

do $$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('public.disponibilidades_extra()'::regprocedure) into v_def;
  v_novo := replace(v_def,
    $a$  return jsonb_build_object('ok', true, 'itens', v, 'lideres', v_lideres);$a$,
    $b$  return jsonb_build_object('ok', true, 'itens', v, 'lideres', v_lideres,
    'lideres_por_area', (select coalesce(jsonb_object_agg(t.area, t.lista), '{}'::jsonb)
                           from (select x.area, jsonb_agg(jsonb_build_object('equipante_id', q.id, 'nome', q.nome)
                                                          order by q.nome) as lista
                                   from public.lideres_area_extra x join public.equipantes q on q.id = x.equipante_id
                                  group by x.area) t));$b$);
  if v_novo = v_def then
    raise exception 'disponibilidades_extra: trecho não encontrado';
  end if;
  execute v_novo;
end;
$$;

-- ===================================================== 2. recepcao igreja
insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
values ('Recepção Igreja', 'Líder', 0, false, true, false)
on conflict (area_nome, atuacao) do update set eh_lider = true, eh_padrao = false;

-- As cinco areas do modulo. Espelha AREAS_RECEPCAO_IGREJA (constants/workAreas.js).
create or replace function public._areas_modulo_recepcao()
returns text[] language sql immutable set search_path = public as $$
  select array['Recepção Igreja', 'Cozinha Igreja', 'Som / Multimídia', 'Estacionamento', 'Mesa crachá']::text[];
$$;

create or replace function public._lider_modulo_recepcao(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.escalas l
                  where l.equipante_id = p_id and l.area_alocada = 'Recepção Igreja'
                    and public._eh_lider(l.area_alocada, l.atuacao));
$$;

-- _equipes_do: + as areas do modulo para o lider da Recepcao Igreja (CTE mod).
create or replace function public._equipes_do(p_id uuid)
returns table(area text, cor text, papel text, chave_grupo uuid, escala_lider uuid)
language sql stable security definer set search_path = public as $$
  with lid as (
    select l.area_alocada as area,
           case when public._equipe_por_cor(l.area_alocada) then l.cor end as cor,
           'lider'::text as papel, l.id as escala_lider
      from public.escalas l
     where l.equipante_id = p_id and public._eh_lider(l.area_alocada, l.atuacao)
  ), mod as (
    select a.area, null::text as cor, 'lider'::text as papel, null::uuid as escala_lider
      from unnest(public._areas_modulo_recepcao()) as a(area)
     where public._lider_modulo_recepcao(p_id)
       and not exists (select 1 from lid where lid.area = a.area)
  ), del as (
    select r.area, r.cor, 'delegado'::text as papel,
           (select l.id from public.escalas l
             where l.area_alocada = r.area and public._eh_lider(l.area_alocada, l.atuacao)
               and (not public._equipe_por_cor(r.area) or r.cor is null or l.cor is null or l.cor = r.cor)
             order by l.created_at limit 1) as escala_lider
      from public.responsaveis_reuniao r
     where r.equipante_id = p_id
       and not exists (select 1 from lid where lid.area = r.area and lid.cor is not distinct from r.cor)
       and not exists (select 1 from mod where mod.area = r.area)
  ), x as (
    select *, public._equipe_por_cor(t.area) as com_cor
      from (select * from lid union all select * from mod union all select * from del) t
  )
  select x.area, x.cor, x.papel,
         coalesce(x.escala_lider,
                  (select g.escala_id
                     from public.grupos_lider g
                     join public.escalas s on s.id = g.escala_id
                    where (s.area_alocada = x.area
                           or (x.area = 'Invisível' and s.area_alocada = 'Marcador')
                           or (x.area = 'Selva' and s.area_alocada = 'Perseguidos'))
                      and (not x.com_cor or x.cor is null or s.cor is null or s.cor = x.cor)
                    order by g.atualizado_em nulls last, g.escala_id limit 1),
                  (select s.id from public.escalas s
                    where (s.area_alocada = x.area
                           or (x.area = 'Invisível' and s.area_alocada = 'Marcador')
                           or (x.area = 'Selva' and s.area_alocada = 'Perseguidos'))
                      and (not x.com_cor or x.cor is null or s.cor is null or s.cor = x.cor)
                    order by s.created_at, s.id limit 1)),
         x.escala_lider
    from x;
$$;

-- relacao_lider: 'pode_gerenciar' nas equipes do modulo; nas areas extras,
-- os outros lideres e quem incluiu cada pessoa.
do $$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('public.relacao_lider(uuid, text, text, date)'::regprocedure) into v_def;
  v_novo := replace(v_def,
    $a$           'papel', e.papel,$a$,
    $b$           'papel', e.papel,
           'pode_gerenciar', e.papel = 'lider' and e.area = any(public._areas_modulo_recepcao())
                             and public._lider_modulo_recepcao(p_id),$b$);
  if v_novo = v_def then
    raise exception 'relacao_lider: trecho papel não encontrado';
  end if;
  v_def := v_novo;
  v_novo := replace(v_def,
    $a$                      'incluido_pelo_lider', d.decidido_por_tipo = 'lider')$a$,
    $b$                      'incluido_pelo_lider', d.decidido_por_tipo = 'lider',
                      'incluido_por', case when d.decidido_por_tipo = 'lider' then d.decidido_por end)$b$);
  if v_novo = v_def then
    raise exception 'relacao_lider: trecho incluido_pelo_lider não encontrado';
  end if;
  v_def := v_novo;
  v_novo := replace(v_def,
    $a$           'area', x.area,
           'membros', ($a$,
    $b$           'area', x.area,
           'lideres', (select coalesce(jsonb_agg(q.nome order by q.nome), '[]'::jsonb)
                         from public.lideres_area_extra y join public.equipantes q on q.id = y.equipante_id
                        where y.area = x.area),
           'membros', ($b$);
  if v_novo = v_def then
    raise exception 'relacao_lider: trecho extras não encontrado';
  end if;
  execute v_novo;
end;
$$;

-- Busca de quem incluir numa area do modulo: equipantes aprovados que ainda
-- nao estao nela, com as areas em que ja estao.
create or replace function public.lider_modulo_buscar(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_area text, p_termo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_termo text := lower(public.unaccent_simples(btrim(coalesce(p_termo, ''))));
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not public._lider_modulo_recepcao(p_id) or not (p_area = any(public._areas_modulo_recepcao())) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Recepção Igreja inclui gente nesta área.');
  end if;
  if length(v_termo) < 3 then
    return jsonb_build_object('ok', true, 'pessoas', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'pessoas', (
    select coalesce(jsonb_agg(jsonb_build_object('equipante_id', t.id, 'nome', t.nome,
                                                 'igreja', t.igreja, 'igreja_outra', t.igreja_outra,
                                                 'areas', t.areas)
                              order by t.nome), '[]'::jsonb)
      from (select e.id, e.nome, e.igreja, e.igreja_outra,
                   (select string_agg(s.area_alocada, ', ' order by s.area_alocada)
                      from public.escalas s where s.equipante_id = e.id) as areas
              from public.equipantes e
             where e.tipo = 'equipante' and e.status = 'aprovado'
               and lower(public.unaccent_simples(e.nome)) like '%' || v_termo || '%'
               and not exists (select 1 from public.escalas s
                                where s.equipante_id = e.id and s.area_alocada = p_area)
             order by e.nome limit 15) t));
end;
$$;

create or replace function public.lider_modulo_incluir(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_area text, p_equipante_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  v_pessoa record;
  v_escala uuid;
  v_atuacao text := public._atuacao_padrao(p_area);
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if not public._lider_modulo_recepcao(p_id) or not (p_area = any(public._areas_modulo_recepcao())) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Recepção Igreja inclui gente nesta área.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  select id, nome, status into v_pessoa from public.equipantes where id = p_equipante_id and tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if v_pessoa.status <> 'aprovado' then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição ainda não foi aprovada pela igreja.');
  end if;
  if exists (select 1 from public.escalas where equipante_id = p_equipante_id and area_alocada = p_area) then
    return jsonb_build_object('ok', false, 'erro', format('%s já está em %s.', v_pessoa.nome, p_area));
  end if;

  insert into public.escalas (equipante_id, area_alocada, atuacao, incluido_por)
  values (p_equipante_id, p_area, v_atuacao, 'Líder: ' || (v_auth->>'nome'))
  returning id into v_escala;
  update public.equipantes set scale_status = 'ok' where id = p_equipante_id;

  insert into public.alteracoes_lider (escala_id, equipante_id, area, campo, de, para, por)
  values (v_escala, p_equipante_id, p_area, 'inclusao', null, v_atuacao, v_auth->>'nome');

  return jsonb_build_object('ok', true, 'escala_id', v_escala);
end;
$$;

create or replace function public.lider_modulo_remover(p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_escala_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
  s public.escalas;
  v_outras int;
  v_pago boolean;
  v_nome text;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  select * into s from public.escalas where id = p_escala_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está mais na escala.');
  end if;
  if not public._lider_modulo_recepcao(p_id) or not (s.area_alocada = any(public._areas_modulo_recepcao())) then
    return jsonb_build_object('ok', false, 'erro', 'Só o líder da Recepção Igreja tira gente desta área.');
  end if;
  if s.equipante_id = p_id then
    return jsonb_build_object('ok', false, 'erro', 'Você não pode se tirar da área. Fale com a organização.');
  end if;
  if public._eh_lider(s.area_alocada, s.atuacao) then
    return jsonb_build_object('ok', false, 'erro', 'Líder só a organização tira.');
  end if;

  select count(*) into v_outras from public.escalas where equipante_id = s.equipante_id and id <> s.id;
  select coalesce(status_pagamento, 'pendente') <> 'pendente', nome into v_pago, v_nome
    from public.equipantes where id = s.equipante_id;
  if v_outras = 0 and (coalesce(s.incluido_por, '') not like 'Líder:%' or v_pago) then
    return jsonb_build_object('ok', false, 'erro',
      format('%s só está nesta área: tirar daqui tiraria da escala. Fale com a organização.', v_nome));
  end if;

  insert into public.alteracoes_lider (escala_id, equipante_id, area, campo, de, para, por)
  values (s.id, s.equipante_id, s.area_alocada, 'remocao', s.atuacao, null, v_auth->>'nome');

  delete from public.escalas where id = s.id;
  if v_outras = 0 then
    update public.equipantes set scale_status = 'pendente' where id = s.equipante_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- permissoes
revoke all on function public._areas_modulo_recepcao(), public._lider_modulo_recepcao(uuid)
  from public, anon, authenticated;
revoke all on function public.remover_lider_area_extra(text, uuid) from public, anon;
grant execute on function public.remover_lider_area_extra(text, uuid) to authenticated;
grant execute on function public.lider_modulo_buscar(uuid, text, text, date, text, text),
  public.lider_modulo_incluir(uuid, text, text, date, text, uuid),
  public.lider_modulo_remover(uuid, text, text, date, uuid)
  to anon, authenticated;
