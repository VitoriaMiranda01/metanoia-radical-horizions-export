import { supabase } from '@/services/supabaseClient';
import { validateEscala } from '@/utils/validation';
import { withRetry } from '@/services/serviceHelpers';

export const fetchApprovedEquipantes = async () => {
  return withRetry(async () => {
    try {
      let query = supabase.from('equipantes')
        .select('id, nome, email, whatsapp, sexo, igreja, area_trabalho_opcao1, area_trabalho_opcao2, area_trabalho_opcao3, tamanho_camiseta, numero_edicao, status, status_pagamento, cpf')
        .eq('status', 'aprovado');
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(eq => ({
        ...eq,
        nome: eq.nome
      }));
    } catch (error) {
      return [];
    }
  });
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
        equipante_nome: a.nome || a.equipante_nome || 'Sem nome',
        area_alocada: a.allocatedArea || a.area_alocada,
        is_manual: a.isManual !== undefined ? a.isManual : true,
        updated_at: new Date()
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
  return withRetry(async () => {
    try {
      let query = supabase.from('escalas').select(`id, equipante_id, area_alocada, is_manual, equipante_nome, equipantes!inner (id, nome, email, whatsapp, sexo, igreja, area_trabalho_opcao1, area_trabalho_opcao2, area_trabalho_opcao3, tamanho_camiseta, numero_edicao, status, status_pagamento, cpf)`);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(item => ({
        ...item.equipantes,
        id: item.equipantes?.id || item.equipante_id,
        nome: item.equipantes?.nome || item.equipante_nome,
        allocatedArea: item.area_alocada,
        statusAllocation: 'Alocado',
        isManual: item.is_manual
      }));
    } catch (error) {
      return [];
    }
  });
};
