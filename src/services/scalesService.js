import { supabase } from '@/services/supabaseClient';
import { validateEscala } from '@/utils/validation';
import { comReenvio } from '@/services/serviceHelpers';

const COLUNAS_EQUIPANTE =
  'id, nome, whatsapp, sexo, igreja, area_trabalho_opcao1, area_trabalho_opcao2, area_trabalho_opcao3, numero_edicao, status, status_pagamento, cpf';

// O PostgREST corta a resposta num teto de linhas (padrao 1000 no Supabase) e
// NAO avisa: devolve as primeiras N como se fossem todas. As edicoes reais
// tiveram 852, 912 e 852 equipantes -- ja perto do teto, e a 37a pode passar.
// Se passar sem esta paginacao, a tela de escalas simplesmente deixaria de
// mostrar parte das pessoas, sem nenhum erro na tela. Por isso lemos de
// 1000 em 1000 ate a pagina vir incompleta.
const PAGINA = 1000;

const lerTudoPaginado = async (montarConsulta, rotulo) => {
  const tudo = [];

  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await comReenvio(
      () => montarConsulta().range(inicio, inicio + PAGINA - 1),
      { rotulo }
    );

    // Antes esta camada devolvia [] em silencio quando dava erro, e a tela de
    // escalas abria com todas as areas vazias sem dizer por que. Continua
    // devolvendo o que conseguiu (nao vale derrubar a tela inteira), mas
    // agora deixa rastro no console.
    if (error) {
      console.error(`scalesApi - ${rotulo}`, error?.message || error);
      return tudo;
    }

    const pagina = data || [];
    tudo.push(...pagina);
    if (pagina.length < PAGINA) return tudo;
  }
};

export const fetchApprovedEquipantes = async () =>
  lerTudoPaginado(
    () => supabase.from('equipantes').select(COLUNAS_EQUIPANTE).eq('status', 'aprovado'),
    'equipantes aprovados'
  );

/**
 * Quantos equipantes ainda aguardam o parceiro aprovar.
 *
 * Os outros dois numeros do painel (a escalar / escalados) a tela ja tem de
 * graca -- sao o tamanho das duas listas que ela ja carregou. Este aqui
 * precisa de consulta propria, e vai como contagem pura (head: true), sem
 * trazer nenhuma linha: sao ate ~900 registros e a tela so quer o numero.
 */
export const contarAguardandoAprovacao = async () => {
  const { count, error } = await comReenvio(
    () => supabase
      .from('equipantes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente'),
    { rotulo: 'inscrições aguardando aprovação' }
  );

  if (error) {
    console.error('scalesApi - aguardando aprovação', error?.message || error);
    return null;
  }
  return count ?? 0;
};

export const detectAllocationChanges = (currentAllocations, previousAllocations) => {
  if (!previousAllocations || previousAllocations.length === 0) return currentAllocations;
  const prevMap = new Map(previousAllocations.map(a => [a.id, a]));
  const changes = [];
  currentAllocations.forEach(current => {
    const prev = prevMap.get(current.id);
    if (!prev || prev.allocatedArea !== current.allocatedArea) changes.push(current);
  });
  return changes;
};

export const saveScales = async (allocations) => {
  if (!allocations || allocations.length === 0) return { success: true, data: [] };
  try {
    const validRecords = [];
    for (const a of allocations) {
      const record = {
        equipante_id: a.id || a.equipante_id,
        area_alocada: a.allocatedArea || a.area_alocada
      };
      const validation = validateEscala(record);
      if (validation.isValid) validRecords.push(record);
    }
    if (validRecords.length === 0) return { success: false, error: "Nenhum registro válido para salvar." };
    const { data, error } = await supabase.from('escalas').upsert(validRecords, { onConflict: 'equipante_id' }).select();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message || "Erro ao salvar" };
  }
};

export const fetchAllAllocations = async () => {
  const linhas = await lerTudoPaginado(
    () => supabase.from('escalas').select(`id, equipante_id, area_alocada, atuacao, equipantes!inner (${COLUNAS_EQUIPANTE})`),
    'alocações'
  );

  return linhas.map(item => ({
    ...item.equipantes,
    id: item.equipantes?.id || item.equipante_id,
    nome: item.equipantes?.nome,
    allocatedArea: item.area_alocada,
    atuacao: item.atuacao || null,
    statusAllocation: 'Alocado'
  }));
};

/**
 * Catalogo de atuacoes (a coluna ATUAÇÃO da escala oficial: a função da
 * pessoa DENTRO da área -- "Líder", "Fila / Confronto", "Traficante"...).
 *
 * Devolve um mapa { [nome da area]: [{ atuacao, ehPadrao, ehLider }] }, já
 * na ordem em que deve aparecer no menu suspenso. Quem manda na lista é o
 * banco (tabela atuacoes_areas), não o bundle -- assim dá para corrigir uma
 * atuação sem publicar o site de novo.
 */
export const fetchAtuacoesPorArea = async () => {
  const { data, error } = await comReenvio(
    () => supabase
      .from('atuacoes_areas')
      .select('area_nome, atuacao, ordem, eh_padrao, eh_lider')
      .order('area_nome')
      .order('ordem'),
    { rotulo: 'atuações das áreas' }
  );

  if (error) {
    console.error('scalesApi - atuações das áreas', error?.message || error);
    return {};
  }

  return (data || []).reduce((acc, linha) => {
    (acc[linha.area_nome] = acc[linha.area_nome] || []).push({
      atuacao: linha.atuacao,
      ehPadrao: linha.eh_padrao,
      ehLider: linha.eh_lider
    });
    return acc;
  }, {});
};

/**
 * Troca a atuação de uma pessoa já alocada. O banco confere que é
 * organizador e que a atuação pertence à área onde ela está -- não dá para
 * gravar "Traficante" em alguém da Cozinha, mesmo forçando a chamada.
 */
export const definirAtuacao = async (equipanteId, atuacao) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('definir_atuacao_equipante', {
      p_equipante_id: equipanteId,
      p_atuacao: atuacao
    }),
    { rotulo: 'atuação do equipante' }
  );

  if (error) return { success: false, error: error.message || 'Erro ao salvar a atuação' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível salvar a atuação' };
  return { success: true };
};
