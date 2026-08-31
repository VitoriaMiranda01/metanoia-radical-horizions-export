-- Migration: Remove colunas obsoletas da tabela escalas
-- Date: 2026-09-01
--
-- Contexto: revisando a tabela `escalas` a pedido da usuaria (Vitoria),
-- encontramos 3 colunas que nao sao mais usadas de verdade pela aplicacao:
--
--   1. equipante_nome: copia duplicada do nome do equipante, gravada em todo
--      INSERT. A leitura (fetchAllAllocations, em scalesService.js) sempre
--      prioriza o nome vindo do JOIN com a tabela equipantes (equipantes!inner)
--      e so cairia nesse valor duplicado se o JOIN nao trouxesse nada — o que
--      e impossivel com inner join, ja que equipante_id e obrigatorio. Ou
--      seja: nunca e realmente exibida. Na pratica ja esta desatualizada em
--      producao (linhas antigas tem "Sem nome" enquanto o equipante real tem
--      nome cadastrado).
--   2. is_manual: gravada certinho em todo INSERT (false = alocacao
--      automatica, true = manual), inclusive relida de volta como isManual
--      em fetchAllAllocations — mas nada no app le esse campo depois disso
--      (nenhum componente, filtro ou exportacao usa isManual). E
--      escrita-apenas hoje.
--   3. updated_at: tem default now() e so era atualizada pelo antigo fluxo
--      manual "Gerar Escalas" (saveScales, com upsert), que ja foi removido
--      do app. Nada mais faz UPDATE em linhas de escalas depois de criadas,
--      entao hoje ela e sempre identica a created_at — redundante.
--
-- Nenhuma das 3 e usada por regra de negocio nenhuma (confirmado lendo todo
-- o codigo que le/escreve na tabela escalas antes desta migration) — analise
-- completa de dependencias feita e aprovada pela usuaria antes de aplicar.
--
-- As duas funcoes que inserem em escalas (alocar_equipante_automaticamente e
-- alocar_equipante_manualmente) precisam ser recriadas pra parar de tentar
-- gravar equipante_nome/is_manual, que deixam de existir.

ALTER TABLE escalas DROP COLUMN IF EXISTS equipante_nome;
ALTER TABLE escalas DROP COLUMN IF EXISTS is_manual;
ALTER TABLE escalas DROP COLUMN IF EXISTS updated_at;

CREATE OR REPLACE FUNCTION public.alocar_equipante_automaticamente(p_equipante_id uuid)
RETURNS TABLE(alocado boolean, area_alocada text) AS $$
DECLARE
  v_equipante RECORD;
  v_area text;
  v_area_existente text;
  v_disponibilidade RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT id, nome, sexo, status, area_trabalho_opcao1, area_trabalho_opcao2, area_trabalho_opcao3
    INTO v_equipante
    FROM equipantes
    WHERE id = p_equipante_id AND tipo = 'equipante';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  SELECT e.area_alocada INTO v_area_existente FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_area_existente;
    RETURN;
  END IF;

  FOR v_area IN
    SELECT unnest(ARRAY[v_equipante.area_trabalho_opcao1, v_equipante.area_trabalho_opcao2, v_equipante.area_trabalho_opcao3])
  LOOP
    IF v_area IS NULL OR v_area = '' THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(v_area, v_equipante.sexo);

    IF v_disponibilidade.tem_vaga THEN
      INSERT INTO escalas (equipante_id, area_alocada)
      VALUES (v_equipante.id, v_area);

      UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

      RETURN QUERY SELECT true, v_area;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT false, NULL::text;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.alocar_equipante_manualmente(p_equipante_id uuid, p_area text)
RETURNS TABLE(sucesso boolean, mensagem text) AS $$
DECLARE
  v_equipante RECORD;
  v_disponibilidade RECORD;
  v_area_existente text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT id, nome, sexo, status
    INTO v_equipante
    FROM equipantes
    WHERE id = p_equipante_id AND tipo = 'equipante';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Equipante nao encontrado'::text;
    RETURN;
  END IF;

  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, 'Equipante ainda nao esta aprovado'::text;
    RETURN;
  END IF;

  SELECT e.area_alocada INTO v_area_existente FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF FOUND THEN
    RETURN QUERY SELECT false, format('Equipante ja esta alocado em %s', v_area_existente);
    RETURN;
  END IF;

  SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(p_area, v_equipante.sexo);

  IF NOT v_disponibilidade.tem_vaga THEN
    RETURN QUERY SELECT false, v_disponibilidade.motivo;
    RETURN;
  END IF;

  INSERT INTO escalas (equipante_id, area_alocada)
  VALUES (v_equipante.id, p_area);

  UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

  RETURN QUERY SELECT true, 'Alocado com sucesso'::text;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.alocar_equipante_automaticamente(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alocar_equipante_manualmente(uuid, text) TO anon, authenticated;
