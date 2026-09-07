-- Migration: Garante as colunas email, profissao e estado_civil em acampantes
-- Date: 2026-09-07
--
-- Contexto: pedido da usuaria em 2026-09-07 -- o formulario de acampante
-- passou a coletar E-mail, Profissão e Estado Civil.
--
-- Nota: o arquivo database/database-setup.sql (script de referencia do
-- schema) ja declara essas 3 colunas na tabela acampantes -- mas esse
-- arquivo nem sempre reflete o banco de producao real (ja aconteceu antes
-- neste projeto de uma coluna existir num lugar e nao no outro). Por
-- seguranca, este script usa "ADD COLUMN IF NOT EXISTS": se a coluna ja
-- existir na producao, o comando nao faz nada (nao dá erro, nao apaga
-- dado nenhum); se nao existir, ela e criada.
--
-- Nao mexe na tabela equipantes -- ela ja tem essas 3 colunas (nao usadas
-- no formulario de equipante, e essa mudanca nao pediu pra usar).

ALTER TABLE acampantes
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS profissao TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT;
