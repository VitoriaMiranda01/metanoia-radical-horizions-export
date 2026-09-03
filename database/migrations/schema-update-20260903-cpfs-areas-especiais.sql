-- Migration: Campos pra alocacao manual de CPFs nas 3 areas que nao
-- aparecem no formulario de equipante (Guia, Inimigo, Espirito Santo)
-- Date: 2026-09-03
--
-- Contexto: Guia, Inimigo e Espirito Santo sao 3 areas de trabalho que ja
-- existem em WORK_AREAS (src/constants/workAreas.js) e ja aparecem na tela
-- de geracao de escalas, mas foram deliberadamente excluidas da lista AREAS
-- do formulario de inscricao de equipante (src/components/inscricao/
-- AreasDeTrabalho.jsx) -- ninguem se inscreve pra elas diretamente.
--
-- A usuaria (Vitoria) pediu uma tela em Configuracoes onde o organizador
-- informa, pra cada uma dessas 3 areas, quais CPFs de equipantes serao
-- alocados nelas. Por pedido explicito da usuaria, ESTA ETAPA NAO CRIA
-- NENHUMA REGRA DE ALOCACAO -- so os campos pra guardar essa informacao.
-- Nenhuma tela (escalas, aprovacoes, etc) le essas colunas ainda.
--
-- Cada coluna guarda uma lista JSON de CPFs, somente digitos (sem
-- formatacao, ex: "12345678900"), dos equipantes escolhidos pro
-- organizador pra aquela area -- mesmo padrao ja usado por
-- equipante_pricing_periods / acampante_pricing_periods (colunas JSONB na
-- tabela configuracoes, default '[]', salvas de forma independente do
-- botao "Salvar Configuracoes Gerais", ver updatePricingPeriods em
-- organizerConfigService.js).
--
-- Nao cria tabela nova -- reaproveita configuracoes, que ja guarda outras
-- listas no mesmo formato.

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_guia jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_inimigo jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cpfs_area_espirito_santo jsonb NOT NULL DEFAULT '[]'::jsonb;
