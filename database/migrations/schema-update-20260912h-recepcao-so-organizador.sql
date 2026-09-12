-- ---------------------------------------------------------------------------
-- Recepção sai do formulario; "Teatro" e "Louvor nas cenas" viram o que sao
--
-- Duas correcoes pedidas pelo Patrick em 12/09/2026, depois de ver a tela.
--
-- 1) RECEPÇÃO NAO E ESCOLHIDA PELO EQUIPANTE
--    Quem trabalha na recepcao -- e em qual das duas, igreja ou sitio -- e
--    sempre decisao do organizador, na geracao de escalas. As duas saem do
--    formulario e entram na mesma familia das areas da diretoria
--    (somente_organizador), junto com Estacionamento, Secretaria,
--    Infiltrados etc. Nem a alocacao automatica nem o coringa
--    "Disponível para qualquer área" mandam gente para la.
--
-- 2) "TEATRO" E "LOUVOR NAS CENAS" SAO PERGUNTAS, NAO LUGARES
--    Existem desde o commit inicial do repositorio (o export do Hostinger
--    Horizons) e sao genericas de proposito: a pessoa so diz que prefere
--    cena teatral, ou que quer tocar/cantar em cena. Quem direciona para a
--    cena de verdade -- Cristolândia, Pastor Enforcado, Família, Túmulo... --
--    e o organizador.
--
--    Eu tinha chutado atuacoes para as duas (Ator/Ministrador/Apoio e
--    Voz/Violão/Teclado/Cajon/Ministrador) tratando-as como area comum.
--    Agora a atuacao padrao das duas e "A direcionar", que diz a verdade: a
--    pessoa esta esperando destino. No Louvor ficam tambem os instrumentos,
--    que ajudam o organizador a escolher para onde mandar.
--
--    A tela marca as duas com o selo "A direcionar" (AREAS_A_DIRECIONAR em
--    src/constants/workAreas.js), para nao ficar gente esquecida ali dentro
--    quando a escala for fechada.
-- ---------------------------------------------------------------------------

update public.limites_areas set somente_organizador = true, updated_at = now()
where area_nome in ('Recepção Igreja', 'Recepção Sítio');

delete from public.atuacoes_areas where area_nome in ('Teatro', 'Louvor nas cenas');

with dados(area, lista) as (values
  ('Teatro',           array['A direcionar']),
  ('Louvor nas cenas', array['A direcionar','Voz','Violão','Teclado','Cajon'])
)
insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider)
select d.area, t.atuacao, t.ord, t.ord = 1, false
  from dados d, unnest(d.lista) with ordinality as t(atuacao, ord);
