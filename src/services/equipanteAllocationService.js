import { supabase } from '@/services/supabaseClient';
import { AREAS_ESPECIAIS } from '@/constants/workAreas';

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

// Move UMA participacao de area. Endereçada pelo id da LINHA em escalas
// (escalaId), nao pela pessoa: desde 12/09/2026 a mesma pessoa pode estar em
// mais de uma area, entao "realocar o fulano" deixou de ser sem ambiguidade.
export const realocarAlocacao = async (escalaId, novaArea) => {
  if (!escalaId || !novaArea) {
    return { success: false, error: 'Alocação ou área não informadas' };
  }
  try {
    const { data, error } = await supabase.rpc('realocar_alocacao', {
      p_escala_id: escalaId,
      p_nova_area: novaArea
    });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível realocar' };
    return { success: true, areaAnterior: data.area_anterior };
  } catch (error) {
    console.error('equipanteAllocationApi - realocarAlocacao', error, { escalaId, novaArea });
    return { success: false, error: error.message || 'Erro ao realocar' };
  }
};

// Tira a pessoa de UMA area. Se era a unica, ela volta para a fila "A
// escalar" -- e por isso o botao pede confirmacao na tela.
export const removerAlocacao = async (escalaId) => {
  if (!escalaId) return { success: false, error: 'Alocação não informada' };
  try {
    const { data, error } = await supabase.rpc('remover_alocacao', { p_escala_id: escalaId });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível remover' };
    return { success: true, area: data.area, restam: data.restam };
  } catch (error) {
    console.error('equipanteAllocationApi - removerAlocacao', error, { escalaId });
    return { success: false, error: error.message || 'Erro ao remover' };
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

// Aplica as listas de CPF pre-cadastradas em Configuracoes (Guia/Inimigo/
// Espirito Santo -- ver CpfsAreaEspecialManager.jsx e
// updateCpfsAreaEspecial em organizerConfigService.js) contra quem ja foi
// aprovado, casando por CPF (chave estavel, nao muda com reinscricao nem
// com nome digitado diferente) e alocando/realocando cada equipante
// encontrado na area especial correspondente.
//
// Nao precisou de nenhuma funcao nova no banco: reaproveita
// alocarEquipanteManualmente (quem ainda esta na fila "A escalar") e
// realocarAlocacao (quem ja tem alguma alocacao -- inclusive numa das
// OUTRAS 2 areas especiais, e ai a exclusividade quem barra e o proprio
// banco, _area_especial(), migration 20260912t-uma-area-especial-por-
// pessoa -- nao duplicamos essa regra aqui).
//
// cpfsPorArea: { guia: [cpf, ...], inimigo: [...], espirito_santo: [...] }
//   (formato salvo em configuracoes.cpfs_area_*)
// equipantesAprovados / allocations: os mesmos arrays que a tela de
// Geracao de Escalas ja mantem em memoria (fetchApprovedEquipantes /
// fetchAllAllocations, em scalesService.js) -- esta funcao nao faz
// nenhuma consulta nova, so orquestra chamadas de alocacao/realocacao.
export const alocarAreasEspeciaisPorCpf = async (cpfsPorArea, equipantesAprovados, allocations) => {
  const resultado = { alocados: 0, realocados: 0, semCorrespondencia: [], erros: [] };

  const soDigitos = (v) => (v || '').replace(/\D/g, '');

  const equipantePorCpf = new Map();
  (equipantesAprovados || []).forEach(eq => {
    const cpf = soDigitos(eq.cpf);
    if (cpf) equipantePorCpf.set(cpf, eq);
  });

  // allocations tem uma linha por PARTICIPACAO (a mesma pessoa pode estar
  // em mais de uma area desde 12/09/2026) -- por isso guardamos as duas
  // coisas que precisamos separadamente: se a pessoa ja esta EXATAMENTE
  // nesta area (nada a fazer) e, se nao esta, qual e a primeira alocacao
  // dela em qualquer area (para decidir entre "alocar" e "realocar").
  const alocacaoPorEquipanteEArea = new Map();
  const primeiraAlocacaoPorEquipante = new Map();
  (allocations || []).forEach(a => {
    alocacaoPorEquipanteEArea.set(`${a.id}::${a.allocatedArea}`, a);
    if (!primeiraAlocacaoPorEquipante.has(a.id)) primeiraAlocacaoPorEquipante.set(a.id, a);
  });

  for (const areaInfo of AREAS_ESPECIAIS) {
    const cpfs = cpfsPorArea?.[areaInfo.key] || [];

    for (const cpfBruto of cpfs) {
      const cpf = soDigitos(cpfBruto);
      const equipante = equipantePorCpf.get(cpf);

      if (!equipante) {
        resultado.semCorrespondencia.push({ cpf, area: areaInfo.label });
        continue;
      }

      if (alocacaoPorEquipanteEArea.has(`${equipante.id}::${areaInfo.label}`)) {
        continue; // ja esta exatamente onde deveria -- nada a fazer
      }

      const alocacaoExistente = primeiraAlocacaoPorEquipante.get(equipante.id);
      const r = alocacaoExistente
        ? await realocarAlocacao(alocacaoExistente.escalaId, areaInfo.label)
        : await alocarEquipanteManualmente(equipante.id, areaInfo.label);

      if (r.success) {
        if (alocacaoExistente) resultado.realocados += 1; else resultado.alocados += 1;
      } else {
        resultado.erros.push({ cpf, nome: equipante.nome, area: areaInfo.label, erro: r.error });
      }
    }
  }

  return resultado;
};
