-- ---------------------------------------------------------------------------
-- Guia, Inimigo e Espírito Santo passam a ter UM lugar so: a tela de
-- Geracao de Escalas.
--
-- O QUE SAIU
-- ----------
-- O bloco "Áreas de Trabalho Especiais" em Configuracoes (listas de CPF) e o
-- botao "Alocar Áreas Especiais" na tela de escalas. Eram dois lugares para
-- dizer a mesma coisa, sem nada que os mantivesse de acordo: a lista de CPF
-- so virava alocacao quando alguem lembrava de apertar o botao, e ate la as
-- duas telas mostravam coisas diferentes. O Patrick escolheu ficar com a
-- tela de escalas (12/09/2026), onde essas tres areas ja tinham tabela
-- propria e ja funcionavam como qualquer outra.
--
-- AS COLUNAS
-- ----------
-- cpfs_area_guia / cpfs_area_inimigo / cpfs_area_espirito_santo continuam
-- existindo, mas ninguem mais le nem escreve nelas. Nao apago a coluna: e
-- irreversivel, e o ganho seria estetico. Esvazio o conteudo (eram CPFs de
-- teste) para que uma consulta antiga nao ressuscite uma lista morta
-- achando que ela vale.
--
-- Se um dia a decisao voltar atras, o caminho e reconstruir a partir de
-- escalas -- que passou a ser a unica verdade sobre quem e o que.
-- ---------------------------------------------------------------------------

update public.configuracoes
   set cpfs_area_guia = '[]'::jsonb,
       cpfs_area_inimigo = '[]'::jsonb,
       cpfs_area_espirito_santo = '[]'::jsonb
 where cpfs_area_guia <> '[]'::jsonb
    or cpfs_area_inimigo <> '[]'::jsonb
    or cpfs_area_espirito_santo <> '[]'::jsonb;

comment on column public.configuracoes.cpfs_area_guia is
  'OBSOLETA desde 12/09/2026: Guia agora se define so na tela de Geracao de Escalas. Nada le nem escreve aqui.';
comment on column public.configuracoes.cpfs_area_inimigo is
  'OBSOLETA desde 12/09/2026: Inimigo agora se define so na tela de Geracao de Escalas. Nada le nem escreve aqui.';
comment on column public.configuracoes.cpfs_area_espirito_santo is
  'OBSOLETA desde 12/09/2026: Espírito Santo agora se define so na tela de Geracao de Escalas. Nada le nem escreve aqui.';
