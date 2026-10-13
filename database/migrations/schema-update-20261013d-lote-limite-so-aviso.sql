-- ---------------------------------------------------------------------------
-- "Alocar em lote": o limite da area vira so aviso (Patrick, 13/10/2026),
-- como nas outras alocacoes manuais (migration 20261013c). A tela deixa
-- marcar alem das vagas, avisa e pergunta; confirmando, manda p_forcar = true,
-- que passa adiante para alocar_equipante_manualmente (pula SO a checagem de
-- vaga -- papel especial unico e o resto continuam valendo).
-- ---------------------------------------------------------------------------

drop function if exists public.alocar_em_lote_na_area(text, uuid[], text);
create or replace function public.alocar_em_lote_na_area(p_area text, p_ids uuid[], p_cor text default null, p_forcar boolean default false)
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
  if not public._area_com_cor(v_area) then
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
      if v_cor is not null then
        update public.escalas set cor = v_cor
         where equipante_id = v_id and area_alocada = v_area;
      end if;
    else
      v_recusados := v_recusados || jsonb_build_object(
        'id', v_id,
        'nome', (select nome from public.equipantes where id = v_id),
        'motivo', v_r.mensagem);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'area', v_area, 'cor', v_cor,
    'alocados', v_alocados, 'recusados', v_recusados);
end;
$function$;

revoke all on function public.alocar_em_lote_na_area(text, uuid[], text, boolean) from public, anon;
grant execute on function public.alocar_em_lote_na_area(text, uuid[], text, boolean) to authenticated;
