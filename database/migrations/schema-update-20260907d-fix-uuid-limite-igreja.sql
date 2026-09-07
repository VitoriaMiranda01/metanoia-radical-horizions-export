-- Fix: erro "operator does not exist: uuid = integer" na trava de limite
-- de acampantes por igreja
-- Date: 2026-09-07
--
-- Contexto: a trigger criada em
-- schema-update-20260907-limite-acampantes-por-igreja.sql tinha
-- "WHERE id = 1" pra buscar a linha (unica) de configuracoes, seguindo o
-- "id INTEGER PRIMARY KEY DEFAULT 1" que o database-setup.sql (script de
-- referencia) declara. Só que esse script nem sempre reflete o banco de
-- producao real -- e nesse caso a coluna id de configuracoes e UUID, não
-- inteiro. Isso fazia TODA inscricao de acampante falhar com o erro 42883
-- "operator does not exist: uuid = integer" assim que a trigger tentava
-- ler o limite padrao.
--
-- Esse script so substitui a function (CREATE OR REPLACE) pela versao
-- corrigida, que busca a linha de configuracoes com LIMIT 1 em vez de
-- comparar id a 1 -- configuracoes so tem uma linha mesmo, entao LIMIT 1
-- pega a mesma linha sem depender do tipo/valor do id. Nao precisa mexer
-- na trigger em si (ela ja aponta pra essa function pelo nome) nem em
-- nenhum dado existente.

CREATE OR REPLACE FUNCTION public._acampantes_verificar_limite_igreja()
RETURNS TRIGGER AS $$
DECLARE
  v_limite INTEGER;
  v_ocupado INTEGER;
BEGIN
  IF NEW.admin_responsavel IS NULL OR NEW.admin_responsavel = '' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.admin_responsavel));

  SELECT limite_maximo INTO v_limite
    FROM limites_igrejas
    WHERE igreja = NEW.admin_responsavel;

  IF NOT FOUND THEN
    SELECT limite_acampantes_por_igreja INTO v_limite
      FROM configuracoes
      LIMIT 1;
  END IF;

  IF v_limite IS NOT NULL THEN
    SELECT count(*) INTO v_ocupado
      FROM acampantes
      WHERE admin_responsavel = NEW.admin_responsavel;

    IF v_ocupado >= v_limite THEN
      RAISE EXCEPTION 'LIMITE_IGREJA_ATINGIDO: A igreja % atingiu o limite de % inscricoes de acampantes.', NEW.admin_responsavel, v_limite;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
