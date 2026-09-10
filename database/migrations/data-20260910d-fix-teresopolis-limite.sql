-- Migration: Corrige limites apos resolver a duplicata BATISTA EM TERESOPOLIS
-- Date: 2026-09-10
--
-- Contexto: a lista de igrejas tinha "BATISTA EM TERESOPOLIS" duplicado
-- (codigos 23 e 129). A usuaria decidiu: codigo 23 fica como "BATISTA EM
-- TERESOPOLIS" (5 vagas -- das duas vagas informadas na planilha original,
-- 3 e 5, a usuaria confirmou que a certa e 5); codigo 129 passa a ser
-- "BATISTA JERUEL TRES RIOS" (que antes estava no codigo 146, ja com
-- limite de 4 vagas, importado na migration data-20260910c).
--
-- O DELETE abaixo remove a chave antiga (146 - ...) caso a migration
-- data-20260910c ja tenha sido rodada antes desta correcao -- se nao foi
-- rodada, o DELETE simplesmente nao acha nada e não faz nada. O INSERT
-- com ON CONFLICT garante as duas chaves corretas, sem duplicar caso
-- alguma delas ja exista.
DELETE FROM limites_igrejas WHERE igreja = '146 - BATISTA JERUEL TRÊS RIOS';

INSERT INTO limites_igrejas (igreja, limite_maximo, updated_at) VALUES
  ('23 - BATISTA EM TERESÓPOLIS', 5, now()),
  ('129 - BATISTA JERUEL TRÊS RIOS', 4, now())
ON CONFLICT (igreja) DO UPDATE SET
  limite_maximo = EXCLUDED.limite_maximo,
  updated_at = EXCLUDED.updated_at;
