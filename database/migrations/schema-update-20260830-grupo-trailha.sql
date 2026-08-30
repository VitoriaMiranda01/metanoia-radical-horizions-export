-- Migration: Alocação persistente de Grupo de Trilha para acampantes
-- Date: 2026-08-30
--
-- Contexto: até aqui, o grupo de cada acampante (Vermelho/Amarelo/Verde/Azul/Roxo)
-- era recalculado do zero em memória a cada carregamento da tela de gerenciamento
-- (função allocateAcampantesToGroups em src/utils/gruposTrailha.js), o que fazia
-- todo mundo poder trocar de grupo a cada nova aprovação. Esta migração cria a
-- coluna que passa a guardar essa alocação de forma definitiva; o código da
-- aplicação (src/services/acampantesService.js) passa a preencher essa coluna
-- automaticamente no momento da aprovação, uma única vez por acampante.

-- 1. Nova coluna (nullable: quem ainda não foi aprovado não tem grupo).
ALTER TABLE acampantes ADD COLUMN IF NOT EXISTS grupo_trailha TEXT;

-- 2. Backfill: aloca quem já está aprovado hoje e ainda não tem grupo salvo.
--    Usa exatamente a mesma regra que o código da aplicação usará dali pra frente:
--    para cada pessoa, escolhe o grupo com menos gente do MESMO SEXO já alocada
--    nele (empate resolvido pela ordem fixa Vermelho, Amarelo, Verde, Azul, Roxo).
--    A ordem de processamento usa data_pagamento (quando existe) e, como
--    critério estável de desempate/fallback, o próprio id — a tabela não tem
--    coluna de data de criação (created_at), então não há um "quem se inscreveu
--    primeiro" real e confiável pra usar aqui. Isso não afeta o equilíbrio por
--    sexo entre os grupos, só decide, entre pessoas do mesmo sexo, qual delas
--    "passa primeiro" nesta rodada única de backfill.
DO $$
DECLARE
  grupos TEXT[] := ARRAY['Vermelho', 'Amarelo', 'Verde', 'Azul', 'Roxo'];
  r RECORD;
  escolhido TEXT;
  menor_contagem INT;
  g TEXT;
  contagem INT;
BEGIN
  FOR r IN
    SELECT id, sexo
    FROM acampantes
    WHERE status = 'aprovado'
      AND grupo_trailha IS NULL
    ORDER BY data_pagamento ASC NULLS LAST, id ASC
  LOOP
    escolhido := NULL;
    menor_contagem := NULL;

    FOREACH g IN ARRAY grupos LOOP
      SELECT COUNT(*) INTO contagem
      FROM acampantes
      WHERE grupo_trailha = g
        AND sexo = r.sexo
        AND status = 'aprovado';

      IF menor_contagem IS NULL OR contagem < menor_contagem THEN
        menor_contagem := contagem;
        escolhido := g;
      END IF;
    END LOOP;

    UPDATE acampantes SET grupo_trailha = escolhido WHERE id = r.id;
  END LOOP;
END $$;
