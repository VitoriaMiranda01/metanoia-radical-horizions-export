-- ---------------------------------------------------------------------------
-- Pastor Invisivel deixa de ter a atuacao "Líder" (14/10/2026, Patrick), como
-- Inimigo (20261014b) e Espirito Santo (20261014c). Familia muculmana,
-- Apresentadores e Equipe de Manutencao ja nao tinham atuacao de lider.
-- Protegido: so apaga se ninguem usa.
-- ---------------------------------------------------------------------------
delete from public.atuacoes_areas
 where area_nome = 'Pastor Invisível' and atuacao = 'Líder'
   and not exists (select 1 from public.escalas
                    where area_alocada = 'Pastor Invisível' and atuacao = 'Líder');
