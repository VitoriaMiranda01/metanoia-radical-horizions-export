-- ---------------------------------------------------------------------------
-- Cor do grupo: aviso, nao bloqueio (Patrick, 13/10/2026).
--
-- "Todas as pessoas alocadas em areas que tem divisao de cores tem que ter a
-- cor -- nao deixe com o bloqueador, mas com um aviso." A tela avisa em
-- varios lugares (cabecalho da area, coluna Cor, topo da escala, lancamento);
-- o banco deixa de recusar.
--
--  1. trocar_area_escala: Infiltrados sem cor deixa de ser recusado.
--  2. alocar_em_lote_na_area ganha p_cor (opcional): a cor vai para todos os
--     que entraram, numa area que trabalha por cor.
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

-- 1.
select pg_temp._patch(
  'public.trocar_area_escala(uuid,text,text)'::regprocedure,
  '  if v_nova = ''Infiltrados'' and v_cor is null then
    return jsonb_build_object(''ok'', false, ''erro'',
      ''Escolha a cor do grupo em que o infiltrado vai entrar.'');
  end if;
',
  '',
  1);

-- 2.
drop function if exists public.alocar_em_lote_na_area(text, uuid[]);

create or replace function public.alocar_em_lote_na_area(p_area text, p_ids uuid[], p_cor text default null)
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
    select * into v_r from public.alocar_equipante_manualmente(v_id, p_area);
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
$fn$;

revoke all on function public.alocar_em_lote_na_area(text, uuid[], text) from public, anon;
grant execute on function public.alocar_em_lote_na_area(text, uuid[], text) to authenticated;
