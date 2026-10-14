-- ---------------------------------------------------------------------------
-- Cristolândia ganha a atuacao "Líder" (14/10/2026, Patrick).
-- Fica logo depois da atuacao padrao, como nas outras areas; as demais descem
-- uma posicao. Idempotente.
-- ---------------------------------------------------------------------------
update public.atuacoes_areas
   set ordem = ordem + 1
 where area_nome = 'Cristolândia' and ordem >= 2
   and not exists (select 1 from public.atuacoes_areas
                    where area_nome = 'Cristolândia' and atuacao = 'Líder');

insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider)
values ('Cristolândia', 'Líder', 2, false, true)
on conflict (area_nome, atuacao) do nothing;
