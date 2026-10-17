-- Atuacao "Líder" em Familia, Pastor Enforcado e Tumulo (17/10/2026, Patrick).
-- Mesmo padrao de Copa/Selva: "Líder" e a 2a da lista, nao e a padrao, eh_lider.
-- Quem manda e a tabela atuacoes_areas: a escala, a relacao do lider, a
-- chamada e a revelacao da area ja leem dela.

do $mig$
declare
  v_area text;
begin
  foreach v_area in array array['Família', 'Pastor Enforcado', 'Túmulo'] loop
    if not exists (select 1 from public.limites_areas where area_nome = v_area) then
      raise exception 'area % nao existe', v_area;
    end if;
    if exists (select 1 from public.atuacoes_areas where area_nome = v_area and atuacao = 'Líder') then
      continue;
    end if;
    -- abre o lugar 2 sem bater na ordem de ninguem (em dois passos)
    update public.atuacoes_areas set ordem = ordem + 100 where area_nome = v_area and ordem >= 2;
    update public.atuacoes_areas set ordem = ordem - 99 where area_nome = v_area and ordem >= 102;
    insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
    values (v_area, 'Líder', 2, false, true, false);
  end loop;
end
$mig$;
