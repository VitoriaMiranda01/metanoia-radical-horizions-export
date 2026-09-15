-- ---------------------------------------------------------------------------
-- Volta o cadastro por CPF de Guia, Inimigo e Espírito Santo.
-- Date: 2026-09-15
--
-- CONTEXTO
-- --------
-- A usuaria (Vitoria) tinha esse fluxo desde 03/09/2026 (migration
-- schema-update-20260903-cpfs-areas-especiais.sql): o organizador
-- pre-cadastra em Configuracoes, para cada uma das 3 areas que nao
-- aparecem no formulario de inscricao (Guia, Inimigo, Espirito Santo),
-- quais equipantes vao ocupa-las -- normalmente antes mesmo de a pessoa
-- terminar de se inscrever. Em 12/09/2026 o Patrick removeu esse fluxo
-- (migration schema-update-20260912u-areas-especiais-so-na-escala.sql),
-- consolidando as 3 areas como mais uma alocacao manual na tela de
-- Geracao de Escalas, sem cadastro previo por CPF.
--
-- A usuaria decidiu (15/09/2026) manter a alocacao automatica do Patrick
-- (o botao "Alocar automático", com o algoritmo por passadas de
-- preferencia) como esta, mas quer de volta especificamente o cadastro
-- por CPF das 3 areas especiais.
--
-- O QUE ESTA MIGRATION FAZ
-- -------------------------
-- As colunas cpfs_area_guia / cpfs_area_inimigo / cpfs_area_espirito_santo
-- nunca foram apagadas (schema-update-20260912u so esvaziou o conteudo e
-- comentou como obsoletas) -- o ADD COLUMN IF NOT EXISTS abaixo e so por
-- seguranca/idempotencia, na pratica so os COMMENT ON mudam algo.
--
-- Nao precisa de nenhuma funcao nova no banco: a comparacao/decisao
-- (alocarAreasEspeciaisPorCpf, em src/services/equipanteAllocationService.js)
-- e pura orquestracao em JS, reaproveitando as funcoes de alocacao/
-- realocacao que ja existem e ja estao no ar hoje --
-- alocar_equipante_manualmente e realocar_alocacao (ambas com a regra de
-- exclusividade entre as 3 areas especiais, ja vigente desde a migration
-- 20260912t-uma-area-especial-por-pessoa -- nao mexemos nela).
-- ---------------------------------------------------------------------------

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_guia jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_inimigo jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_espirito_santo jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN configuracoes.cpfs_area_guia IS
  'CPFs (so digitos) dos equipantes pre-cadastrados pelo organizador para a área Guia. Aplicado pelo botão "Aplicar CPFs cadastrados" na tela de Geração de Escalas -- ver alocarAreasEspeciaisPorCpf.';
COMMENT ON COLUMN configuracoes.cpfs_area_inimigo IS
  'CPFs (so digitos) dos equipantes pre-cadastrados pelo organizador para a área Inimigo. Aplicado pelo botão "Aplicar CPFs cadastrados" na tela de Geração de Escalas -- ver alocarAreasEspeciaisPorCpf.';
COMMENT ON COLUMN configuracoes.cpfs_area_espirito_santo IS
  'CPFs (so digitos) dos equipantes pre-cadastrados pelo organizador para a área Espírito Santo. Aplicado pelo botão "Aplicar CPFs cadastrados" na tela de Geração de Escalas -- ver alocarAreasEspeciaisPorCpf.';
