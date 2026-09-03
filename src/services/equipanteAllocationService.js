import { supabase } from '@/services/supabaseClient';

// Camada de service pra alocacao automatica/manual de equipantes em areas de
// trabalho. Toda a decisao (preferencias, capacidade, limite por sexo,
// concorrencia) mora na funcao do banco (alocar_equipante_automaticamente /
// alocar_equipante_manualmente — ver database/migrations/schema-update-
// 20260831-alocacao-equipantes.sql); este arquivo so chama a funcao certa e
// normaliza o retorno pro resto do app.

// Chamada automaticamente logo apos um equipante ser aprovado (ver
// ApprovalsView.jsx). Nunca lanca excecao pro chamador — se a alocacao falhar
// por qualquer motivo de infra, a aprovacao em si ja aconteceu e nao deve
// ficar bloqueada por causa disso (mesmo padrao ja usado pro sorteio de
// grupo de trilha do acampante, em criarInscricao).
export const alocarEquipanteAutomaticamente = async (equipanteId) => {
  if (!equipanteId) {
    return { success: false, error: 'ID de equipante ausente' };
  }

  try {
    const { data, error } = await supabase.rpc('alocar_equipante_automaticamente', {
      p_equipante_id: equipanteId
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      alocado: !!resultado?.alocado,
      area: resultado?.area_alocada || null
    };
  } catch (error) {
    console.error('equipanteAllocationApi - alocarEquipanteAutomaticamente', error, { equipanteId });
    return { success: false, error: error.message || 'Erro ao tentar alocar equipante automaticamente' };
  }
};

// Alocacao manual: organizador escolhe a area de alguem que esta na lista de
// espera. A funcao do banco confere de novo, na hora, se a vaga realmente
// ainda existe (capacidade total + limite do sexo) antes de gravar — por
// isso o retorno pode vir com sucesso=false mesmo que a tela achasse que
// havia vaga (ex: outro organizador ocupou a vaga um instante antes).
export const alocarEquipanteManualmente = async (equipanteId, area) => {
  if (!equipanteId || !area) {
    return { success: false, error: 'Equipante ou área não informados' };
  }

  try {
    const { data, error } = await supabase.rpc('alocar_equipante_manualmente', {
      p_equipante_id: equipanteId,
      p_area: area
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado?.sucesso) {
      return { success: false, error: resultado?.mensagem || 'Não foi possível alocar' };
    }

    return { success: true };
  } catch (error) {
    console.error('equipanteAllocationApi - alocarEquipanteManualmente', error, { equipanteId, area });
    return { success: false, error: error.message || 'Erro ao tentar alocar equipante manualmente' };
  }
};

// Cancelamento de um equipante ja aprovado (organizador clica em "Rejeitar"
// na aba "Aprovadas" da tela de Aprovacoes, apos confirmar num dialogo).
// Chamada pelo app logo apos o UPDATE que muda equipantes.status pra
// 'rejeitado'. Se o equipante tinha uma linha em escalas, ela e apagada
// (libera a vaga) e em seguida a funcao tenta alocar o primeiro compativel
// da lista de espera (por ordem de chegada) nessa vaga liberada — tudo
// dentro da funcao do banco (liberar_vaga_e_realocar, ver
// database/migrations/schema-update-20260901-liberacao-vaga-cancelamento.sql),
// protegido pela mesma trava usada nas outras alocacoes. Nunca lanca
// excecao pro chamador — mesmo espirito das outras funcoes desta camada: o
// cancelamento em si ja aconteceu e nao deve ficar bloqueado por causa de
// uma falha aqui.
export const liberarVagaERealocar = async (equipanteId) => {
  if (!equipanteId) {
    return { success: false, error: 'ID de equipante ausente' };
  }

  try {
    const { data, error } = await supabase.rpc('liberar_vaga_e_realocar', {
      p_equipante_id: equipanteId
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      vagaLiberada: !!resultado?.vaga_liberada,
      areaLiberada: resultado?.area_liberada || null,
      novoAlocadoId: resultado?.novo_alocado_id || null,
      novoAlocadoNome: resultado?.novo_alocado_nome || null,
      novoAlocadoArea: resultado?.novo_alocado_area || null
    };
  } catch (error) {
    console.error('equipanteAllocationApi - liberarVagaERealocar', error, { equipanteId });
    return { success: false, error: error.message || 'Erro ao tentar liberar vaga e realocar' };
  }
};

// Realocacao: organizador troca a area de um equipante que JA esta alocado
// (diferente de alocarEquipanteManualmente, que so serve pra quem ainda esta
// na lista de espera -- a funcao do banco recusa explicitamente qualquer
// equipante que ja tenha linha em escalas). A funcao do banco
// (realocar_equipante, ver database/migrations/schema-update-20260903-
// realocar-equipante.sql) confere vaga na area de destino (capacidade +
// limite por sexo) com a mesma trava de concorrencia das outras alocacoes,
// e so entao atualiza a linha existente em escalas (mesma linha, so troca
// area_alocada -- nao apaga e recria).
export const realocarEquipante = async (equipanteId, novaArea) => {
  if (!equipanteId || !novaArea) {
    return { success: false, error: 'Equipante ou área não informados' };
  }

  try {
    const { data, error } = await supabase.rpc('realocar_equipante', {
      p_equipante_id: equipanteId,
      p_nova_area: novaArea
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado?.sucesso) {
      return { success: false, error: resultado?.mensagem || 'Não foi possível realocar' };
    }

    return { success: true, areaAnterior: resultado?.area_anterior || null };
  } catch (error) {
    console.error('equipanteAllocationApi - realocarEquipante', error, { equipanteId, novaArea });
    return { success: false, error: error.message || 'Erro ao tentar realocar equipante' };
  }
};

// Lista de espera: equipantes aprovados que ainda nao tem linha em escalas.
// Calculada ao vivo (nao persistida em lugar nenhum) a partir de duas
// consultas que ja existiam (fetchApprovedEquipantes/fetchAllAllocations,
// em scalesService.js) — reaproveitadas aqui pra nao duplicar logica de
// busca, so a comparacao muda.
export const fetchListaEspera = async (equipantesAprovados, alocacoesAtuais) => {
  const idsAlocados = new Set((alocacoesAtuais || []).map(a => a.id));
  return (equipantesAprovados || []).filter(eq => !idsAlocados.has(eq.id));
};
