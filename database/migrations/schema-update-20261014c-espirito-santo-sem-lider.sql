-- ---------------------------------------------------------------------------
-- Espirito Santo deixa de ter a atuacao "Líder" (14/10/2026, Patrick), como o
-- Inimigo (20261014b). Protegido: so apaga se ninguem usa.
-- ---------------------------------------------------------------------------
delete from public.atuacoes_areas
 where area_nome = 'Espírito Santo' and atuacao = 'Líder'
   and not exists (select 1 from public.escalas
                    where area_alocada = 'Espírito Santo' and atuacao = 'Líder');
