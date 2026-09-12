-- ---------------------------------------------------------------------------
-- A escala passa a ser montada A MAO pelo organizador
--
-- Decidido com o Patrick em 12/09/2026, depois do teste de ponta a ponta.
--
-- Como era: aprovar um equipante (pelo parceiro ou pelo organizador) ja o
-- jogava, na hora, na primeira das 3 preferencias que tivesse vaga. E
-- cancelar alguem ja alocado puxava sozinho o primeiro da fila para a vaga
-- que abriu.
--
-- Como fica: aprovar so aprova. A pessoa entra na fila "A escalar" da tela
-- de Geracao de Escalas e o organizador coloca uma a uma na area, olhando o
-- conjunto -- que e como a escala oficial sempre foi montada. Cancelar
-- apenas libera a vaga; quem entra no lugar tambem e escolha do
-- organizador.
--
-- As 3 preferencias continuam gravadas e aparecem ao lado de cada nome na
-- fila, como sugestao. Elas so deixaram de decidir sozinhas.
--
-- No app, a mudanca correspondente e uma chamada a menos em
-- src/components/aprovacoes/ApprovalsView.jsx (aprovarInscricao nao chama
-- mais alocarEquipanteAutomaticamente).
-- ---------------------------------------------------------------------------

-- Assinatura mantida de proposito -- novo_alocado_* passam a vir sempre
-- nulos. A tela ja sabia lidar com esse caso ("ninguem se encaixou"), entao
-- o site publicado nao quebra enquanto o front novo nao sobe.
create or replace function public.liberar_vaga_e_realocar(p_equipante_id uuid)
returns table(
  vaga_liberada boolean, area_liberada text,
  novo_alocado_id uuid, novo_alocado_nome text, novo_alocado_area text
)
language plpgsql security definer
set search_path to 'public'
as $fn$
DECLARE
  v_area_liberada text;
  v_teve_vaga     boolean;
BEGIN
  IF NOT public._pode_escalar_equipante(p_equipante_id) THEN
    RAISE EXCEPTION 'Sem permissão para liberar a vaga deste equipante' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  SELECT e.area_alocada INTO v_area_liberada FROM escalas e WHERE e.equipante_id = p_equipante_id;
  v_teve_vaga := FOUND;

  IF v_teve_vaga THEN
    DELETE FROM escalas WHERE equipante_id = p_equipante_id;
    UPDATE equipantes SET scale_status = 'pendente' WHERE id = p_equipante_id;
  END IF;

  RETURN QUERY SELECT v_teve_vaga, v_area_liberada, NULL::uuid, NULL::text, NULL::text;
END;
$fn$;

-- alocar_equipante_automaticamente deixa de ser chamada pelo site, mas
-- continua no banco: e ela que sabe ler as 3 preferencias respeitando teto
-- e limite por sexo. Se a equipe pedir um botao "sugerir pelas
-- preferencias" na tela de escalas, e so voltar a chama-la. As permissoes
-- nao mudam (organizador, ou parceiro da propria igreja).
comment on function public.alocar_equipante_automaticamente(uuid) is
  'Aloca pela ordem de preferencia do equipante. Desde 12/09/2026 NAO e mais chamada na aprovacao -- a escala e montada a mao. Mantida para um eventual botao de sugestao em lote.';
