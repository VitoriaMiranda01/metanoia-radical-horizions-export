-- Migration: Liberacao de vaga ao cancelar equipante ja aprovado + coluna
-- created_at (necessaria pra decidir quem e "o primeiro" da lista de
-- espera).
-- Date: 2026-09-01
--
-- Contexto: ate aqui, cancelar um equipante que ja tinha sido aprovado
-- (status='aprovado') nao liberava a vaga dele de verdade. O unico caminho
-- que existia era o botao "Desativar" em Gerenciar Inscricoes, que so
-- marcava equipantes.inscrito=false, sem tocar em status nem em escalas.
-- Como toda a logica de alocacao/lista de espera olha pra `status` (nunca
-- pra `inscrito`), a pessoa continuava contando pra vaga da area dela pra
-- sempre, mesmo desativada — exatamente a lacuna do item 8 do pedido
-- original de alocacao automatica.
--
-- Decisao combinada com a usuaria (Vitoria) em 2026-09-01: o cancelamento
-- de um equipante ja aprovado passa a ser feito pelo botao "Rejeitar" na
-- aba "Aprovadas" da tela de Aprovacoes (que ja muda status pra
-- 'rejeitado' via updateEquipanteStatus) — com uma confirmacao antes de
-- executar, ja que agora pode desalocar alguem. O antigo botao "Desativar"
-- de Gerenciar Inscricoes sai de cena (removido no lado do app). Como
-- status='rejeitado' ja e respeitado por toda a logica existente
-- (alocar_equipante_automaticamente/manualmente, fetchApprovedEquipantes,
-- calculo da lista de espera), so falta: 1) liberar a linha em escalas do
-- equipante cancelado e 2) tentar realocar o primeiro compativel da lista
-- de espera nessa vaga que abriu.
--
-- Regras combinadas:
--   1. Ao cancelar (status vira 'rejeitado' no app, antes de chamar esta
--      funcao), se a pessoa tinha uma linha em escalas, ela e apagada
--      (libera a vaga) e o scale_status dela volta pra 'pendente'.
--   2. Em seguida percorre a lista de espera (aprovados, tipo='equipante',
--      sem linha em escalas) em ordem de chegada (created_at) e tenta
--      alocar cada um chamando a MESMA funcao
--      alocar_equipante_automaticamente ja existente — sem duplicar
--      nenhuma logica de preferencia/sexo/capacidade — parando no primeiro
--      que conseguir vaga. Como uma unica vaga foi liberada, no maximo uma
--      pessoa nova consegue entrar por chamada.
--   3. Idempotente: se a pessoa cancelada nao tinha linha em escalas (ja
--      estava na propria lista de espera), a funcao nao apaga nada — so
--      tenta percorrer a lista de espera mesmo assim (nao muda nada, ja
--      que nenhuma vaga nova se abriu, mas nao faz mal tentar).
--   4. Mesma trava de concorrencia (pg_advisory_xact_lock, mesma chave) das
--      outras duas funcoes de alocacao, pra essa liberacao+realocacao nunca
--      colidir com uma aprovacao ou alocacao manual acontecendo ao mesmo
--      tempo. A funcao chamada dentro do loop (alocar_equipante_automatica-
--      mente) tenta pegar a mesma trava de novo — travas advisory
--      transacionais do Postgres sao reentrantes dentro da mesma
--      transacao, entao isso e seguro e nao gera deadlock consigo mesma.
--
-- created_at: nao havia nenhuma coluna de data no cadastro do equipante,
-- entao nao tinha como saber quem chegou primeiro na lista de espera.
-- Adicionada aditivamente (ADD COLUMN IF NOT EXISTS, com default now()) —
-- nao quebra nada que ja existe, nenhuma tabela nova. Cadastros ja
-- existentes recebem o timestamp do momento em que esta migration roda
-- (mesmo valor pra todos os registros antigos — tudo bem, sao inscricoes
-- de teste); dali pra frente cada novo cadastro grava seu proprio horario
-- real.
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Funcao chamada pelo app logo apos um equipante ja aprovado ser
-- rejeitado/cancelado (equipantes.status ja tera virado 'rejeitado' antes
-- desta chamada). Apaga a alocacao dele em escalas, se existir, e tenta
-- realocar o primeiro da lista de espera compativel na vaga liberada.
CREATE OR REPLACE FUNCTION public.liberar_vaga_e_realocar(p_equipante_id uuid)
RETURNS TABLE(
  vaga_liberada boolean,
  area_liberada text,
  novo_alocado_id uuid,
  novo_alocado_nome text,
  novo_alocado_area text
) AS $$
DECLARE
  v_area_liberada text;
  v_teve_vaga boolean;
  v_candidato RECORD;
  v_resultado RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  -- Libera a vaga do proprio equipante cancelado, se ele tinha uma.
  SELECT e.area_alocada INTO v_area_liberada FROM escalas e WHERE e.equipante_id = p_equipante_id;
  v_teve_vaga := FOUND;

  IF v_teve_vaga THEN
    DELETE FROM escalas WHERE equipante_id = p_equipante_id;
    UPDATE equipantes SET scale_status = 'pendente' WHERE id = p_equipante_id;
  END IF;

  -- Percorre a lista de espera em ordem de chegada, tentando alocar cada
  -- um pela mesma funcao ja usada na aprovacao — para no primeiro que
  -- conseguir vaga.
  FOR v_candidato IN
    SELECT eq.id, eq.nome
    FROM equipantes eq
    WHERE eq.tipo = 'equipante'
      AND eq.status = 'aprovado'
      AND eq.id <> p_equipante_id
      AND NOT EXISTS (SELECT 1 FROM escalas e WHERE e.equipante_id = eq.id)
    ORDER BY eq.created_at ASC NULLS LAST, eq.id ASC
  LOOP
    SELECT * INTO v_resultado FROM public.alocar_equipante_automaticamente(v_candidato.id);

    IF v_resultado.alocado THEN
      RETURN QUERY SELECT v_teve_vaga, v_area_liberada, v_candidato.id, v_candidato.nome, v_resultado.area_alocada;
      RETURN;
    END IF;
  END LOOP;

  -- Ninguem da espera conseguiu vaga (ou a lista estava vazia) — so
  -- reporta se a vaga do proprio equipante cancelado foi liberada.
  RETURN QUERY SELECT v_teve_vaga, v_area_liberada, NULL::uuid, NULL::text, NULL::text;
END;
$$ LANGUAGE plpgsql;

-- Mesmo raciocinio de permissao das outras duas funcoes: SECURITY INVOKER
-- (padrao), roda com o mesmo privilegio que o app ja tem hoje pra mexer em
-- escalas/equipantes direto (chave anon).
GRANT EXECUTE ON FUNCTION public.liberar_vaga_e_realocar(uuid) TO anon, authenticated;
