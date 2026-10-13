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
//
// Limite no manual e so aviso (13/10/2026, migration 20261013c): sem vaga, o
// retorno vem com semVaga = true; a tela pergunta "alocar mesmo assim?" e
// chama de novo com forcar = true (pula SO a checagem de vaga).
// Os dois motivos de "sem vaga" que _equipante_area_tem_vaga devolve.
export const ehSemVaga = (mensagem) => /capacidade total da área atingida|limite para o sexo atingido/i.test(mensagem || '');

export const alocarEquipanteManualmente = async (equipanteId, area, forcar = false) => {
  if (!equipanteId || !area) {
    return { success: false, error: 'Equipante ou área não informados' };
  }

  try {
    const { data, error } = await supabase.rpc('alocar_equipante_manualmente', {
      p_equipante_id: equipanteId,
      p_area: area,
      p_forcar: !!forcar
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado?.sucesso) {
      return { success: false, error: resultado?.mensagem || 'Não foi possível alocar', semVaga: ehSemVaga(resultado?.mensagem) };
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
export const realocarAlocacao = async (escalaId, novaArea, forcar = false) => {
  if (!escalaId || !novaArea) {
    return { success: false, error: 'Alocação ou área não informadas' };
  }
  try {
    const { data, error } = await supabase.rpc('realocar_alocacao', {
      p_escala_id: escalaId,
      p_nova_area: novaArea,
      p_forcar: !!forcar
    });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível realocar', semVaga: !!data?.sem_vaga };
    return { success: true, areaAnterior: data.area_anterior };
  } catch (error) {
    console.error('equipanteAllocationApi - realocarAlocacao', error, { escalaId, novaArea });
    return { success: false, error: error.message || 'Erro ao realocar' };
  }
};

// Alocacao em lote numa area (12/10/2026, migration 20261012e): cada pessoa
// passa pela mesma regra da alocacao manual (vaga, limite por sexo, papel
// especial). Quem nao couber volta em `recusados` com o motivo.
// cor (13/10/2026): opcional, vai para todos que entraram numa area com cor.
// forcar (13/10/2026, migration 20261013d): o limite e so aviso -- a tela
// confirma e manda forcar = true quando a selecao passa das vagas.
// atuacao (13/10/2026, migration 20261013g): a atuacao de todos; sem ela fica a
// padrao da area. A cor so e gravada se a atuacao usa cor.
export const alocarEmLoteNaArea = async (area, ids, cor = null, forcar = false, atuacao = null) => {
  try {
    const { data, error } = await supabase.rpc('alocar_em_lote_na_area', { p_area: area, p_ids: ids, p_cor: cor || null, p_forcar: !!forcar, p_atuacao: atuacao || null });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível alocar' };
    return { success: true, alocados: data.alocados ?? 0, recusados: Array.isArray(data.recusados) ? data.recusados : [] };
  } catch (error) {
    console.error('equipanteAllocationApi - alocarEmLoteNaArea', error, { area, total: ids?.length });
    return { success: false, error: error.message || 'Erro ao alocar em lote' };
  }
};

// Fixos na area (13/10/2026, migration 20261013b): o "core" de cada area,
// marcado com 📌 na ficha do equipante (atravessa as edicoes). O "Alocar
// automático" coloca os fixos antes de todo mundo. Marcar/desmarcar e
// "Limpar área" so Raquel, Dudu e Desenvolvedores (o banco confere).
export const fetchAreasFixas = async () => {
  const { data, error } = await supabase.rpc('areas_fixas');
  if (error) {
    console.error('equipanteAllocationApi - fetchAreasFixas', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};

// Fixar numa area em que a pessoa ainda nao esta ja coloca ela la (alocado).
// Area cheia: fica marcado, mas nao entra (semVaga) -- a tela pergunta e
// chama de novo com forcar.
export const marcarAreaFixa = async (equipanteId, area, fixo, forcar = false) => {
  try {
    const { data, error } = await supabase.rpc('marcar_area_fixa', { p_equipante_id: equipanteId, p_area: area, p_fixo: !!fixo, p_forcar: !!forcar });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível marcar' };
    return { success: true, alocado: !!data.alocado, aviso: data.aviso || null, semVaga: !!data.sem_vaga, motivo: data.motivo || null };
  } catch (error) {
    console.error('equipanteAllocationApi - marcarAreaFixa', error, { equipanteId, area, fixo });
    return { success: false, error: error.message || 'Erro ao marcar fixo' };
  }
};

// Tira todo mundo de uma area (fixos inclusive -- a marca fica). So antes de
// lancar a escala provisoria.
export const limparArea = async (area) => {
  try {
    const { data, error } = await supabase.rpc('limpar_area', { p_area: area });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível limpar a área' };
    return { success: true, removidos: data.removidos ?? 0, voltaramFila: data.voltaram_fila ?? 0 };
  } catch (error) {
    console.error('equipanteAllocationApi - limparArea', error, { area });
    return { success: false, error: error.message || 'Erro ao limpar a área' };
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
//
// forcar (13/10/2026): o limite da area e so aviso na alocacao manual. Sem
// vaga, o erro volta com semVaga = true; a tela pergunta e chama de novo so
// com esses CPFs e forcar = true.
export const alocarAreasEspeciaisPorCpf = async (cpfsPorArea, equipantesAprovados, allocations, forcar = false) => {
  const resultado = { alocados: 0, realocados: 0, semCorrespondencia: [], erros: [] };

  const soDigitos = (v) => (v || '').replace(/\D/g, '');

  const equipantePorCpf = new Map();
  (equipantesAprovados || []).forEach(eq => {
    const cpf = soDigitos(eq.cpf);
    if (cpf) equipantePorCpf.set(cpf, eq);
  });

  // allocations tem uma linha por PARTICIPACAO (a mesma pessoa pode estar
  // em mais de uma area desde 12/09/2026). A area especial e ACRESCENTADA
  // (13/10/2026, Patrick: a pessoa pode estar numa especial e numa comum ao
  // mesmo tempo). So MOVE quando a pessoa ja esta em OUTRA especial (uma
  // especial por pessoa) ou em "Não será escalado" (nao faz sentido ficar
  // nas duas). Antes movia a primeira area que achasse -- tirava a pessoa da
  // area comum.
  const nomesEspeciais = AREAS_ESPECIAIS.map(a => a.label);
  const alocacaoPorEquipanteEArea = new Map();
  const aMoverPorEquipante = new Map();
  (allocations || []).forEach(a => {
    alocacaoPorEquipanteEArea.set(`${a.id}::${a.allocatedArea}`, a);
    if (nomesEspeciais.includes(a.allocatedArea)) aMoverPorEquipante.set(a.id, a);
    else if (a.allocatedArea === 'Não será escalado' && !aMoverPorEquipante.has(a.id)) aMoverPorEquipante.set(a.id, a);
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

      const aMover = aMoverPorEquipante.get(equipante.id);
      const r = aMover
        ? await realocarAlocacao(aMover.escalaId, areaInfo.label, forcar)
        : await alocarEquipanteManualmente(equipante.id, areaInfo.label, forcar);

      if (r.success) {
        if (aMover) {
          resultado.realocados += 1;
          resultado.saiuDe = aMover.allocatedArea;
        } else {
          resultado.alocados += 1;
        }
      } else {
        resultado.erros.push({ cpf, key: areaInfo.key, nome: equipante.nome, area: areaInfo.label, erro: r.error, semVaga: !!r.semVaga });
      }
    }
  }

  return resultado;
};
