-- Cracolandia ganha a atuacao Anjinho (29/10/2026, Patrick).
-- Entra no fim da lista, sem cor (sem_cor); a padrao (Cracolândia) e a de lider nao mudam.

do $mig$
begin
  if not exists (select 1 from public.limites_areas where area_nome = 'Cracolândia') then
    raise exception 'area Cracolândia nao existe';
  end if;

  insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
  select 'Cracolândia', 'Anjinho',
         coalesce((select max(ordem) from public.atuacoes_areas where area_nome = 'Cracolândia'), 0) + 1,
         false, false, true
   where not exists (select 1 from public.atuacoes_areas
                      where area_nome = 'Cracolândia' and atuacao = 'Anjinho');
end
$mig$;
