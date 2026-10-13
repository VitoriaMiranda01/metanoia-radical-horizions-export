-- ---------------------------------------------------------------------------
-- Alocacao em lote numa area (Patrick, 12/10/2026).
--
-- No cabecalho de cada area da Geracao de Escalas, "Alocar em lote": o
-- organizador marca varias pessoas da fila "A escalar" e coloca todas na
-- area de uma vez. Cada pessoa passa pela mesma regra da alocacao manual
-- (alocar_equipante_manualmente): aprovado, vaga na area, limite por sexo,
-- um papel especial por pessoa. Quem nao couber volta na resposta com o
-- motivo -- o lote nunca passa do limite da area.
-- ---------------------------------------------------------------------------
create or replace function public.alocar_em_lote_na_area(p_area text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_id        uuid;
  v_r         record;
  v_alocados  int := 0;
  v_recusados jsonb := '[]'::jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem alocar.');
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Ninguém escolhido.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  -- Na ordem em que vieram (a tela manda na ordem da lista), sem repetir.
  foreach v_id in array (select array_agg(x order by o) from (
      select x, min(o) o from unnest(p_ids) with ordinality t(x, o) group by x) u)
  loop
    select * into v_r from public.alocar_equipante_manualmente(v_id, p_area);
    if v_r.sucesso then
      v_alocados := v_alocados + 1;
    else
      v_recusados := v_recusados || jsonb_build_object(
        'id', v_id,
        'nome', (select nome from public.equipantes where id = v_id),
        'motivo', v_r.mensagem);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'area', public._area_canonica(p_area),
    'alocados', v_alocados, 'recusados', v_recusados);
end;
$fn$;

revoke all on function public.alocar_em_lote_na_area(text, uuid[]) from public, anon;
grant execute on function public.alocar_em_lote_na_area(text, uuid[]) to authenticated;
