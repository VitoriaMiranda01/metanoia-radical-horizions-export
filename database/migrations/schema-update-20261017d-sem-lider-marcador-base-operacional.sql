-- Marcador e Base Operacional deixam de ter atuacao de Lider (17/10/2026,
-- Patrick): o lider dos Marcadores e o lider dos Invisiveis (trabalham juntos)
-- e a Base Operacional nao tem lider. Sem atuacao de lider, o aviso de "falta
-- lider" some dessas areas. Quem estiver com "Líder" nelas volta para a
-- atuacao padrao da area (no oficial ninguem estava).

do $mig$
declare
  v_area text;
begin
  foreach v_area in array array['Marcador', 'Base Operacional'] loop
    update public.escalas e
       set atuacao = public._atuacao_padrao(v_area)
     where e.area_alocada = v_area and e.atuacao = 'Líder';
    delete from public.atuacoes_areas where area_nome = v_area and atuacao = 'Líder';
  end loop;
end
$mig$;
