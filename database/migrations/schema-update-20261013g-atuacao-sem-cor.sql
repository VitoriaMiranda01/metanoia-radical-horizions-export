-- ---------------------------------------------------------------------------
-- Atuacao que nao usa cor (Patrick, 13/10/2026). Na Recepção Sítio so quem
-- fica na "Fila / Confronto" tem cor de grupo; quem fica no "Celular / Mesa"
-- nao tem. Ate aqui a cor valia para a area inteira (_area_com_cor).
--
--  * atuacoes_areas.sem_cor: a atuacao nao usa cor, mesmo numa area com cor.
--  * definir_atuacao_alocacao: ao passar para uma atuacao sem cor, a cor
--    da pessoa e apagada (nao fica uma cor "escondida" na ficha).
--  * alocar_em_lote_na_area ganha p_atuacao: o lote escolhe a atuacao de
--    todos; a cor so e gravada se a atuacao usa cor.
-- ---------------------------------------------------------------------------

alter table public.atuacoes_areas add column if not exists sem_cor boolean not null default false;

update public.atuacoes_areas set sem_cor = true
 where area_nome = 'Recepção Sítio' and atuacao = 'Celular / Mesa';

create or replace function public.definir_atuacao_alocacao(p_escala_id uuid, p_atuacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_area text; v_atuacao text := nullif(btrim(coalesce(p_atuacao, '')), ''); v_sem_cor boolean := false;
BEGIN
  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem mudar a atuação.');
  END IF;

  SELECT e.area_alocada INTO v_area FROM escalas e WHERE e.id = p_escala_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Alocação não encontrada.');
  END IF;

  IF v_atuacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM atuacoes_areas a WHERE a.area_nome = v_area AND a.atuacao = v_atuacao
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('"%s" não é uma atuação de %s.', v_atuacao, v_area));
  END IF;

  SELECT coalesce(a.sem_cor, false) INTO v_sem_cor
    FROM atuacoes_areas a WHERE a.area_nome = v_area AND a.atuacao = v_atuacao;

  UPDATE escalas
     SET atuacao = v_atuacao,
         cor = CASE WHEN coalesce(v_sem_cor, false) THEN null ELSE cor END
   WHERE id = p_escala_id;
  RETURN jsonb_build_object('ok', true, 'area', v_area, 'atuacao', v_atuacao, 'sem_cor', coalesce(v_sem_cor, false));
END;
$function$;

drop function if exists public.alocar_em_lote_na_area(text, uuid[], text, boolean);
create or replace function public.alocar_em_lote_na_area(p_area text, p_ids uuid[], p_cor text default null, p_forcar boolean default false, p_atuacao text default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id        uuid;
  v_r         record;
  v_alocados  int := 0;
  v_recusados jsonb := '[]'::jsonb;
  v_area      text := public._area_canonica(p_area);
  v_cor       text := nullif(btrim(coalesce(p_cor, '')), '');
  v_atuacao   text := nullif(btrim(coalesce(p_atuacao, '')), '');
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem alocar.');
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Ninguém escolhido.');
  end if;
  if v_cor is not null and v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho') then
    return jsonb_build_object('ok', false, 'erro', format('"%s" não é uma cor de grupo.', v_cor));
  end if;
  if v_atuacao is not null and not exists (
    select 1 from public.atuacoes_areas a where a.area_nome = v_area and a.atuacao = v_atuacao) then
    return jsonb_build_object('ok', false, 'erro', format('"%s" não é uma atuação de %s.', v_atuacao, v_area));
  end if;
  -- Cor so numa area com cor e numa atuacao que usa cor.
  if not public._area_com_cor(v_area) or exists (
    select 1 from public.atuacoes_areas a
     where a.area_nome = v_area and a.sem_cor
       and a.atuacao = coalesce(v_atuacao, public._atuacao_padrao(v_area))) then
    v_cor := null;
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  -- Na ordem em que vieram (a tela manda na ordem da lista), sem repetir.
  foreach v_id in array (select array_agg(x order by o) from (
      select x, min(o) o from unnest(p_ids) with ordinality t(x, o) group by x) u)
  loop
    select * into v_r from public.alocar_equipante_manualmente(v_id, p_area, coalesce(p_forcar, false));
    if v_r.sucesso then
      v_alocados := v_alocados + 1;
      if v_cor is not null or v_atuacao is not null then
        update public.escalas
           set cor = coalesce(v_cor, cor),
               atuacao = coalesce(v_atuacao, atuacao)
         where equipante_id = v_id and area_alocada = v_area;
      end if;
    else
      v_recusados := v_recusados || jsonb_build_object(
        'id', v_id,
        'nome', (select nome from public.equipantes where id = v_id),
        'motivo', v_r.mensagem);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'area', v_area, 'cor', v_cor, 'atuacao', v_atuacao,
    'alocados', v_alocados, 'recusados', v_recusados);
end;
$function$;

revoke all on function public.alocar_em_lote_na_area(text, uuid[], text, boolean, text) from public, anon;
grant execute on function public.alocar_em_lote_na_area(text, uuid[], text, boolean, text) to authenticated;
