-- ---------------------------------------------------------------------------
-- Inimigo deixa de ter a atuacao "Líder" (14/10/2026, Patrick).
--
-- Ninguem estava com essa atuacao (conferido antes); a area fica so com a
-- atuacao "Inimigo". Sem atuacao de lider, a tela tambem para de avisar
-- "sem líder" nessa area. Protegido: so apaga se ninguem usa.
-- ---------------------------------------------------------------------------
delete from public.atuacoes_areas
 where area_nome = 'Inimigo' and atuacao = 'Líder'
   and not exists (select 1 from public.escalas
                    where area_alocada = 'Inimigo' and atuacao = 'Líder');
