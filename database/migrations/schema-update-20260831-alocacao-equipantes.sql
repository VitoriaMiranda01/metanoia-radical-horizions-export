-- Migration: Alocacao automatica de equipantes em areas de trabalho
-- Date: 2026-08-31
--
-- Contexto: ate aqui, a alocacao de equipantes em areas de trabalho so
-- acontecia quando um organizador clicava manualmente em "Gerar Escalas"
-- (handleRunAlgorithm, em src/pages/OrganizerScalesPage.jsx), que recalculava
-- TODOS os equipantes aprovados do zero, em memoria no navegador, sem
-- verificar limite por sexo (so verificava capacidade total da area).
--
-- A partir de agora, a alocacao acontece automaticamente no momento em que a
-- inscricao do equipante e aprovada (chamada pelo app logo apos o UPDATE que
-- muda equipantes.status para 'aprovado'), processando SO aquele equipante,
-- sem reorganizar quem ja estava alocado.
--
-- Regras de negocio combinadas com a usuaria (Vitoria) em 2026-08-31:
--   1. Prioridade estrita: area_trabalho_opcao1 -> opcao2 -> opcao3. So passa
--      pra proxima se a anterior nao tiver vaga (capacidade total OU limite
--      do sexo da pessoa esgotados).
--   2. Se nenhuma das 3 tiver vaga, o equipante NAO e alocado — fica
--      implicitamente "na lista de espera": aprovado, mas sem linha na
--      tabela escalas. Não guardamos motivo nem qual preferencia foi
--      atendida (decisao explicita da usuaria: essas duas informacoes nao
--      sao necessarias) — quem quiser saber o motivo pode recalcular na hora
--      olhando a ocupacao atual de cada area.
--   3. Limite por sexo: limites_areas.limite_mulheres/limite_homens vindo
--      NULL quando o OUTRO sexo tem numero configurado explicitamente
--      significa "zero vagas pra este sexo" (ex: Presidio tem
--      limite_homens=10 e limite_mulheres=NULL -> 0 mulheres). Quando os
--      DOIS campos estao NULL (area nunca configurada por sexo — e a
--      situacao de 28 das 32 areas hoje), NAO ha restricao por sexo: so o
--      limite_maximo total conta, exatamente como funciona hoje.
--   4. Idempotente: se o equipante ja tem uma linha em escalas, a funcao nao
--      faz nada (evita duplicidade se for chamada de novo pro mesmo id).
--   5. Concorrencia: duas aprovacoes/alocacoes simultaneas nao podem ambas
--      "verem" a mesma vaga livre e furarem o limite. Usamos um advisory
--      lock do Postgres (pg_advisory_xact_lock) pra serializar todas as
--      tentativas de alocacao (automatica ou manual) — como aprovacao e uma
--      acao feita por um organizador (nao um pico de centenas de pessoas ao
--      mesmo tempo, como o cadastro), travar durante o calculo e seguro e
--      nao gera fila perceptivel.
--
-- Nao cria nenhuma tabela nem coluna nova — reaproveita escalas e
-- limites_areas, que ja existem e ja tem tudo que e necessario.

-- Funcao auxiliar (privada, prefixo _): calcula se ainda ha vaga numa area
-- pra um sexo especifico, aplicando a regra 3 acima. Compartilhada pela
-- alocacao automatica e pela alocacao manual, pra nao duplicar a logica.
CREATE OR REPLACE FUNCTION public._equipante_area_tem_vaga(
  p_area text,
  p_sexo text,
  OUT tem_vaga boolean,
  OUT motivo text
) AS $$
DECLARE
  v_limite_maximo integer;
  v_limite_mulheres integer;
  v_limite_homens integer;
  v_total_ocupado integer;
  v_sexo_ocupado integer;
  v_limite_sexo_efetivo integer; -- NULL = sem restricao especifica por sexo
BEGIN
  SELECT limite_maximo, limite_mulheres, limite_homens
    INTO v_limite_maximo, v_limite_mulheres, v_limite_homens
    FROM limites_areas
    WHERE area_nome = p_area;

  IF NOT FOUND THEN
    -- Area nunca configurada em limites_areas: mesmo padrao ja usado hoje no
    -- front-end (DEFAULT_AREA_CAPACITY, em src/constants/workAreas.js).
    v_limite_maximo := 5;
    v_limite_mulheres := NULL;
    v_limite_homens := NULL;
  END IF;

  IF p_sexo = 'Feminino' THEN
    IF v_limite_mulheres IS NULL AND v_limite_homens IS NOT NULL THEN
      v_limite_sexo_efetivo := 0;
    ELSE
      v_limite_sexo_efetivo := v_limite_mulheres;
    END IF;
  ELSE
    IF v_limite_homens IS NULL AND v_limite_mulheres IS NOT NULL THEN
      v_limite_sexo_efetivo := 0;
    ELSE
      v_limite_sexo_efetivo := v_limite_homens;
    END IF;
  END IF;

  SELECT count(*) INTO v_total_ocupado
    FROM escalas
    WHERE area_alocada = p_area;

  SELECT count(*) INTO v_sexo_ocupado
    FROM escalas e
    JOIN equipantes eq ON eq.id = e.equipante_id
    WHERE e.area_alocada = p_area AND eq.sexo = p_sexo;

  IF v_total_ocupado >= v_limite_maximo THEN
    tem_vaga := false;
    motivo := 'Capacidade total da area atingida';
    RETURN;
  END IF;

  IF v_limite_sexo_efetivo IS NOT NULL AND v_sexo_ocupado >= v_limite_sexo_efetivo THEN
    tem_vaga := false;
    motivo := 'Limite para o sexo atingido nesta area';
    RETURN;
  END IF;

  tem_vaga := true;
  motivo := NULL;
END;
$$ LANGUAGE plpgsql;

-- Funcao principal: chamada pelo app logo apos aprovar um equipante.
-- Retorna (alocado boolean, area_alocada text) — area_alocada vem NULL
-- quando o equipante fica na lista de espera.
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

  -- So aloca quem esta EFETIVAMENTE aprovado — nunca pendente, rejeitado ou
  -- qualquer outro status.
  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- Idempotencia (regra 4): se ja tem alocacao, retorna a existente sem
  -- mexer em nada.
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
      INSERT INTO escalas (equipante_id, equipante_nome, area_alocada, is_manual)
      VALUES (v_equipante.id, v_equipante.nome, v_area, false);

      UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

      RETURN QUERY SELECT true, v_area;
      RETURN;
    END IF;
  END LOOP;

  -- Nenhuma das 3 opcoes tinha vaga (regra 2): fica na lista de espera. Nao
  -- grava nada em escalas — "estar na espera" e simplesmente nao ter linha
  -- ali (aprovado + sem escala).
  RETURN QUERY SELECT false, NULL::text;
END;
$$ LANGUAGE plpgsql;

-- Funcao pra alocacao manual (organizador escolhe a area de alguem que esta
-- na lista de espera). Mesma trava de concorrencia e mesma verificacao de
-- vaga da automatica — assim dois organizadores nao conseguem ocupar a
-- mesma vaga ao mesmo tempo (item 9 do pedido original).
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

  INSERT INTO escalas (equipante_id, equipante_nome, area_alocada, is_manual)
  VALUES (v_equipante.id, v_equipante.nome, p_area, true);

  UPDATE equipantes SET scale_status = 'ok' WHERE id = p_equipante_id;

  RETURN QUERY SELECT true, 'Alocado com sucesso'::text;
END;
$$ LANGUAGE plpgsql;

-- As funcoes rodam com os privilegios de quem chama (SECURITY INVOKER, que e
-- o padrao do Postgres) — nao de quem criou a funcao. Isso é intencional:
-- o app hoje ja faz INSERT/UPDATE direto em escalas e equipantes usando a
-- chave anon (ex: saveScales, updateEquipanteStatus), entao as mesmas
-- permissoes que ja existem pra essas tabelas continuam valendo aqui, sem
-- precisar elevar privilegio nenhum.
--
-- GRANT explicito, pra garantir que o PostgREST exponha as funcoes como RPC
-- pro papel usado pelo app (anon):
GRANT EXECUTE ON FUNCTION public.alocar_equipante_automaticamente(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alocar_equipante_manualmente(uuid, text) TO anon, authenticated;
