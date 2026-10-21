-- Fotografia ganha a atuacao "Treinamento" (21/10/2026, Patrick).
-- Mesma regra da 20261021b/c: Líder primeiro, o resto em ordem alfabetica;
-- Apoio segue como padrao.

do $mig$
begin
  if not exists (select 1 from public.limites_areas where area_nome = 'Fotografia') then
    raise exception 'area Fotografia nao existe';
  end if;

  insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider, sem_cor)
  select 'Fotografia', 'Treinamento', 900, false, false, false
   where not exists (select 1 from public.atuacoes_areas
                      where area_nome = 'Fotografia' and atuacao = 'Treinamento');

  update public.atuacoes_areas set ordem = ordem + 1000 where area_nome = 'Fotografia';

  update public.atuacoes_areas a
     set ordem = r.nova
    from (select atuacao,
                 row_number() over (order by (not eh_lider), lower(atuacao)) as nova
            from public.atuacoes_areas
           where area_nome = 'Fotografia') r
   where a.area_nome = 'Fotografia' and a.atuacao = r.atuacao;
end
$mig$;
