-- Migration: Realocacao de equipante ja alocado (organizador troca a area)
-- Date: 2026-09-03
--
-- Contexto: ate aqui, so existia alocacao manual pra quem estava na lista de
-- espera (alocar_equipante_manualmente, ver schema-update-20260831-alocacao-
-- equipantes.sql) -- essa funcao recusa explicitamente qualquer equipante
-- que ja tenha linha em escalas ("Equipante ja esta alocado em %s"). A
-- usuaria (Vitoria) pediu um botao "Realocar" na tela de escalas, pra que o
-- organizador consiga mover um equipante JA alocado de uma area pra outra
-- (ex: area X esta cheia de gente mas com poucas inscricoes qualificadas
-- pra outra necessidade, ou o organizador simplesmente quer reorganizar).
--
-- Esta migration cria uma funcao nova (realocar_equipante) especifica pra
-- esse caso -- nao mexe em alocar_equipante_manualmente nem em
-- alocar_equipante_automaticamente, que continuam servindo soh quem esta na
-- lista de espera, exatamente como antes.
--
-- Regras da nova funcao (mesma logica de vaga ja usada nas outras duas, via
-- _equipante_area_tem_vaga -- capacidade total + limite por sexo da area de
-- DESTINO):
--   1. So realoca quem ja tem uma linha em escalas (equipante alocado). Se
--      nao tiver, retorna erro orientando a usar a alocacao manual da lista
--      de espera em vez desta funcao.
--   2. Verifica vaga na area de destino com a mesma funcao auxiliar
--      _equipante_area_tem_vaga usada pela alocacao automatica/manual --
--      ou seja, capacidade total e limite por sexo da area de destino
--      precisam estar respeitados, exatamente como quando a pessoa e
--      alocada pela primeira vez. A area de ORIGEM nao entra na conta (a
--      pessoa esta saindo dela, entao nao faz sentido checar vaga la).
--   3. Se a area de destino for igual a area atual, nao faz nada e retorna
--      erro (nao eh uma realocacao de verdade).
--   4. UPDATE na linha existente de escalas (troca so area_alocada) -- nao
--      apaga e reinsere, pra manter o mesmo id/created_at da linha.
--   5. Mesma trava de concorrencia (pg_advisory_xact_lock) das outras duas
--      funcoes de alocacao, pra dois organizadores nao conseguirem realocar
--      pra vagas que colidem ao mesmo tempo.
--   6. equipantes.scale_status nao muda -- a pessoa continua alocada (so
--      trocou de area), entao continua 'ok' como ja estava.
--
-- Nao cria tabela nem coluna nova -- so mais uma funcao, reaproveitando
-- escalas e limites_areas como ja existem hoje (colunas equipante_nome,
-- is_manual e updated_at ja foram removidas de escalas em schema-update-
-- 20260901b-remove-colunas-obsoletas-escalas.sql, entao o UPDATE aqui so
-- mexe em area_alocada mesmo).

CREATE OR REPLACE FUNCTION public.realocar_equipante(p_equipante_id uuid, p_nova_area text)
RETURNS TABLE(sucesso boolean, mensagem text, area_anterior text) AS $$
DECLARE
  v_equipante RECORD;
  v_disponibilidade RECORD;
  v_area_atual text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT id, nome, sexo, status
    INTO v_equipante
    FROM equipantes
    WHERE id = p_equipante_id AND tipo = 'equipante';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Equipante nao encontrado'::text, NULL::text;
    RETURN;
  END IF;

  IF v_equipante.status <> 'aprovado' THEN
    RETURN QUERY SELECT false, 'Equipante ainda nao esta aprovado'::text, NULL::text;
    RETURN;
  END IF;

  SELECT e.area_alocada INTO v_area_atual FROM escalas e WHERE e.equipante_id = p_equipante_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Equipante ainda nao esta alocado em nenhuma area (use a alocacao manual da lista de espera)'::text, NULL::text;
    RETURN;
  END IF;

  IF v_area_atual = p_nova_area THEN
    RETURN QUERY SELECT false, 'Equipante ja esta alocado nessa area'::text, v_area_atual;
    RETURN;
  END IF;

  SELECT * INTO v_disponibilidade FROM public._equipante_area_tem_vaga(p_nova_area, v_equipante.sexo);

  IF NOT v_disponibilidade.tem_vaga THEN
    RETURN QUERY SELECT false, v_disponibilidade.motivo, v_area_atual;
    RETURN;
  END IF;

  UPDATE escalas SET area_alocada = p_nova_area WHERE equipante_id = p_equipante_id;

  RETURN QUERY SELECT true, 'Realocado com sucesso'::text, v_area_atual;
END;
$$ LANGUAGE plpgsql;

-- Mesmo padrao das demais funcoes de alocacao: SECURITY INVOKER (padrao do
-- Postgres), GRANT explicito pro PostgREST expor como RPC pro papel anon
-- (usado pelo app).
GRANT EXECUTE ON FUNCTION public.realocar_equipante(uuid, text) TO anon, authenticated;
