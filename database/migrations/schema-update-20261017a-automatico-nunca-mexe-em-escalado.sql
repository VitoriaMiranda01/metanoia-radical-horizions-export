-- Alocar automatico: NUNCA mexe em quem ja esta escalado (17/10/2026).
--
-- Incidente: o Pastor Invisivel puxava pastores que ja estavam em outras
-- areas (apagava as escalas deles e criava a do Pastor Invisivel). Regra do
-- Patrick: "as pessoas que estao escaladas nao se deve mexer jamais. Se eu
-- rodar um alocar automatico e depois chegar mais gente, o segundo alocar
-- nunca, jamais podera mexer no primeiro."
--
--  1) alocar_fila_automaticamente: o Pastor Invisivel so aceita pastor que
--     NAO tem nenhuma escala. O automatico so INSERE escalas, nunca apaga
--     nem troca a de ninguem.
--  2) desfazer_alocacao_automatica: desfaz so o ULTIMO lote (a ultima rodada
--     do automatico). Para desfazer o anterior, clica de novo.
--  3) situacao_alocacao_automatica: passa a descrever o ultimo lote e quantos
--     lotes ainda estao ativos.

do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.alocar_fila_automaticamente()'::regprocedure);

  -- (a) candidato do Pastor Invisivel: sem nenhuma escala
  if position($a$     where q.tipo = 'equipante' and q.status = 'aprovado'
       and (upper(btrim(coalesce(q.cargo_igreja, ''))) in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')$a$ in v) = 0 then
    raise exception 'trecho do candidato nao encontrado';
  end if;
  v := replace(v,
    $a$     where q.tipo = 'equipante' and q.status = 'aprovado'
       and (upper(btrim(coalesce(q.cargo_igreja, ''))) in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')$a$,
    $b$     where q.tipo = 'equipante' and q.status = 'aprovado'
       and not exists (select 1 from public.escalas ex where ex.equipante_id = q.id)
       and (upper(btrim(coalesce(q.cargo_igreja, ''))) in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')$b$);

  -- (b) o automatico nunca apaga escala de ninguem
  if position($a$    delete from public.escalas where equipante_id = v_cand.id;
$a$ in v) = 0 then
    raise exception 'trecho do delete nao encontrado';
  end if;
  v := replace(v, $a$    delete from public.escalas where equipante_id = v_cand.id;
$a$, '');

  if v like '%delete from public.escalas%' then
    raise exception 'ainda ha delete em escalas na funcao';
  end if;
  execute v;
end
$mig$;

-- ---------------------------------------------------------------- desfazer
create or replace function public.desfazer_alocacao_automatica()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quem      text := public._nome_organizador_logado();
  v_lote      uuid;
  v_total     int;
  v_desfeitos int;
  v_restaurar jsonb;
  v_restantes int;
  r           record;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem desfazer a alocação automática.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is not null then
    return jsonb_build_object('ok', false, 'erro',
      'A escala provisória já foi lançada: a alocação automática não pode mais ser desfeita. Ajuste pela troca de área.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  -- So o ULTIMO lote que ainda esta ativo.
  select l.id into v_lote
    from public.lotes_alocacao_automatica l
   where l.desfeito_em is null
   order by l.feito_em desc, l.id
   limit 1;
  if v_lote is null then
    return jsonb_build_object('ok', false, 'erro', 'Não há alocação automática para desfazer.');
  end if;

  select count(*) into v_total
    from public.lotes_alocacao_automatica_itens i
   where i.lote_id = v_lote;

  select coalesce(jsonb_agg(jsonb_build_object('eq', i.equipante_id, 'linhas', i.restaurar)), '[]'::jsonb)
    into v_restaurar
    from public.lotes_alocacao_automatica_itens i
   where i.lote_id = v_lote and i.restaurar is not null
     and exists (select 1 from public.escalas e where e.id = i.escala_id and e.area_alocada = i.area);

  with ativos as (
    select i.escala_id, i.area
      from public.lotes_alocacao_automatica_itens i
     where i.lote_id = v_lote
  ), apagados as (
    delete from public.escalas e
     using ativos d
     where e.id = d.escala_id and e.area_alocada = d.area
    returning e.equipante_id
  )
  select count(*) into v_desfeitos from apagados;

  for r in select (x ->> 'eq')::uuid as eq, x -> 'linhas' as linhas from jsonb_array_elements(v_restaurar) x loop
    insert into public.escalas (equipante_id, area_alocada, atuacao, cor, incluido_por)
    select r.eq, y ->> 'area', y ->> 'atuacao', y ->> 'cor', y ->> 'incluido_por'
      from jsonb_array_elements(r.linhas) y
    on conflict (equipante_id, area_alocada) do nothing;
    update public.equipantes set scale_status = 'ok' where id = r.eq;
  end loop;

  update public.equipantes q set scale_status = 'pendente'
   where q.id in (select i.equipante_id
                    from public.lotes_alocacao_automatica_itens i
                   where i.lote_id = v_lote)
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  update public.lotes_alocacao_automatica l
     set desfeito_em = now(), desfeito_por = v_quem,
         desfeitos = (select count(*) from public.lotes_alocacao_automatica_itens d
                       where d.lote_id = l.id
                         and not exists (select 1 from public.escalas e where e.id = d.escala_id)),
         mantidos  = (select count(*) from public.lotes_alocacao_automatica_itens d
                       where d.lote_id = l.id
                         and exists (select 1 from public.escalas e where e.id = d.escala_id))
   where l.id = v_lote;

  select count(*) into v_restantes
    from public.lotes_alocacao_automatica l where l.desfeito_em is null;

  return jsonb_build_object('ok', true, 'desfeitos', v_desfeitos, 'mantidos', v_total - v_desfeitos,
                            'restantes', v_restantes);
end;
$$;

-- ---------------------------------------------------------------- situacao
-- Descreve o ULTIMO lote ativo (o que o botao vai desfazer) e quantos lotes
-- ainda estao ativos.
create or replace function public.situacao_alocacao_automatica()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_lote  record;
  v_lotes int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ativo', false);
  end if;

  select count(*) into v_lotes from public.lotes_alocacao_automatica where desfeito_em is null;
  select l.id, l.feito_em, l.feito_por into v_lote
    from public.lotes_alocacao_automatica l
   where l.desfeito_em is null
   order by l.feito_em desc, l.id
   limit 1;
  if v_lote.id is null then
    return jsonb_build_object('ativo', false);
  end if;

  return jsonb_build_object(
    'ativo', true,
    'lotes', v_lotes,
    'total', (select count(*) from public.lotes_alocacao_automatica_itens i where i.lote_id = v_lote.id),
    'no_lugar', (select count(*) from public.lotes_alocacao_automatica_itens i
                  where i.lote_id = v_lote.id
                    and exists (select 1 from public.escalas e
                                 where e.id = i.escala_id and e.area_alocada = i.area
                                   and not exists (select 1 from public.equipantes_areas_fixas f
                                                    where f.equipante_id = e.equipante_id and f.area = e.area_alocada))),
    'feito_em', v_lote.feito_em,
    'feito_por', v_lote.feito_por,
    'pode_desfazer', (select escala_lancada_em is null from public.configuracoes limit 1));
end;
$$;
