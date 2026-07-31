import { supabase } from '@/lib/supabase';
import { validateConfiguracoes, validateInscricoesStatus, validateEscala } from '@/lib/validationHelpers';

const handleSupabaseError = (error, context) => {
  if (error) {
    console.error(`Error in ${context}:`, error.message || error);
    throw new Error(error.message || 'Unknown error occurred');
  }
};

const withRetry = async (operation, retries = 3, delay = 1000) => {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) throw error;
    const isNetworkError = error.message === 'Failed to fetch' || error.status >= 500;
    if (!isNetworkError) throw error;
    console.warn(`Retrying operation... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(operation, retries - 1, delay * 2);
  }
};

export const fetchConfiguracoes = async (organizadorId, editionNumber = null) => {
  return withRetry(async () => {
    try {
      if (!navigator.onLine) return { max_equipantes: 0, max_acampantes: 0, max_acampantes_homens: 0, max_acampantes_mulheres: 0, edicao_numero: 0 };
      
      // Load general configs with edition filter
      let configQuery = supabase.from('configuracoes').select('*');
      if (editionNumber) {
        configQuery = configQuery.eq('edicao_numero', editionNumber);
      }
      
      const { data, error } = await configQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (error && !['PGRST205', '42P01', '42703'].includes(error.code)) {
        throw error;
      }

      // Load dates from organizadores table based on organizadorId and/or editionNumber
      let dateData = {};
      try {
        let query = supabase.from('organizadores').select('data_edicao_dia_inicio, data_edicao_dia_fim, data_edicao_mes, data_edicao_ano');
        
        if (organizadorId) {
          query = query.eq('id', organizadorId);
        }
        if (editionNumber) {
          query = query.eq('edicao_numero', editionNumber);
        }
        
        const { data: orgData } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (orgData) {
          dateData = orgData;
        } else if (organizadorId && !editionNumber) {
          // Fallback just to the organizer if edition doesn't match yet
          const { data: orgDataFB } = await supabase.from('organizadores')
            .select('data_edicao_dia_inicio, data_edicao_dia_fim, data_edicao_mes, data_edicao_ano')
            .eq('id', organizadorId)
            .limit(1)
            .maybeSingle();
          if (orgDataFB) {
            dateData = orgDataFB;
          }
        }
      } catch (err) {
        console.error("[fetchConfiguracoes] Error fetching dates from organizadores:", err);
      }

      const mergedConfig = {
        id: data?.id || '00000000-0000-0000-0000-000000000001',
        max_equipantes: data?.max_equipantes ?? 0,
        max_acampantes: data?.max_acampantes ?? 0,
        max_acampantes_homens: data?.max_acampantes_homens ?? 0,
        max_acampantes_mulheres: data?.max_acampantes_mulheres ?? 0,
        edicao_numero: data?.edicao_numero ?? editionNumber ?? 0,
        observacoes: data?.observacoes ?? '',
        horario_saida_igreja: data?.horario_saida_igreja || '',
        horario_retorno_sitio: data?.horario_retorno_sitio || '',
        data_limite_inscricao_pagamento: data?.data_limite_inscricao_pagamento || '',
        updated_at: data?.updated_at,
        equipante_pricing_periods: data?.equipante_pricing_periods || [],
        acampante_pricing_periods: data?.acampante_pricing_periods || [],
        // Map date fields from organizadores payload to ensure they load identically
        data_edicao_dia_inicio: dateData.data_edicao_dia_inicio || '',
        data_edicao_dia_fim: dateData.data_edicao_dia_fim || '',
        data_edicao_mes: dateData.data_edicao_mes || '',
        data_edicao_ano: dateData.data_edicao_ano || ''
      };

      console.log("[fetchConfiguracoes] Final merged config loaded:", mergedConfig);
      return mergedConfig;
    } catch (error) {
      console.error("[fetchConfiguracoes] Fatal load error:", error);
      return { max_equipantes: 0, max_acampantes: 0, max_acampantes_homens: 0, max_acampantes_mulheres: 0, edicao_numero: 0, equipante_pricing_periods: [], acampante_pricing_periods: [] };
    }
  });
};

export const saveConfiguracoes = async (config, fieldName = null) => {
  try {
    if (!navigator.onLine) throw new Error("Você está offline. Verifique sua conexão.");
    
    console.log("[saveConfiguracoes] START. Payload received:", config, "Field:", fieldName);

    const edicaoNum = parseInt(config.edicao_numero || config.numero_edicao, 10);
    const validEdicaoNum = isNaN(edicaoNum) ? 0 : edicaoNum;

    // Retrieve existing configuracao for this edition
    let configQuery = supabase.from('configuracoes').select('id');
    if (validEdicaoNum > 0) {
      configQuery = configQuery.eq('edicao_numero', validEdicaoNum);
    }
    const { data: existing } = await configQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle();

    // Determine target table for partial update
    const isOrgDateTable = ['data_edicao_dia_inicio', 'data_edicao_dia_fim', 'data_edicao_mes', 'data_edicao_ano'].includes(fieldName);

    if (fieldName && !isOrgDateTable) {
      // Partial update for configuracoes
      const payload = { updated_at: new Date() };
      
      if (['max_equipantes', 'max_acampantes', 'max_acampantes_homens', 'max_acampantes_mulheres', 'numero_edicao', 'edicao_numero'].includes(fieldName)) {
        payload[fieldName === 'numero_edicao' ? 'edicao_numero' : fieldName] = parseInt(config[fieldName], 10) || 0;
        if (fieldName === 'max_acampantes_homens' || fieldName === 'max_acampantes_mulheres') {
          payload.max_acampantes = parseInt(config.max_acampantes, 10) || 0;
        }
      } else if (['horario_saida_igreja', 'horario_retorno_sitio', 'data_limite_inscricao_pagamento'].includes(fieldName)) {
        payload[fieldName] = config[fieldName] ? config[fieldName] : null;
      } else {
        payload[fieldName] = config[fieldName];
      }

      if (existing?.id) {
        const { data, error } = await supabase.from('configuracoes').update(payload).eq('id', existing.id).select().single();
        if (error) throw error;
        return data;
      }
    } else if (fieldName && isOrgDateTable) {
      // Partial update for organizadores (dates)
      const { data: orgExisting } = await supabase.from('organizadores').select('id').limit(1).maybeSingle();
      const orgIdToUpdate = config.organizadorId || orgExisting?.id;

      if (orgIdToUpdate) {
        const payload = { edicao_numero: validEdicaoNum };
        if (fieldName === 'data_edicao_mes') {
          payload[fieldName] = config[fieldName] || null;
        } else {
          payload[fieldName] = config[fieldName] ? parseInt(config[fieldName], 10) : null;
        }

        const { data, error } = await supabase.from('organizadores').update(payload).eq('id', orgIdToUpdate).select();
        if (error) throw error;
        return data;
      }
      return null;
    }

    // Full Update fallback
    const payloadBase = { 
      max_equipantes: parseInt(config.max_equipantes, 10) || 0,
      max_acampantes: parseInt(config.max_acampantes, 10) || 0,
      max_acampantes_homens: parseInt(config.max_acampantes_homens, 10) || 0,
      max_acampantes_mulheres: parseInt(config.max_acampantes_mulheres, 10) || 0,
      edicao_numero: validEdicaoNum,
      observacoes: config.observacoes || '',
      horario_saida_igreja: config.horario_saida_igreja || null,
      horario_retorno_sitio: config.horario_retorno_sitio || null,
      data_limite_inscricao_pagamento: config.data_limite_inscricao_pagamento || null,
      equipante_pricing_periods: config.equipante_pricing_periods || [],
      acampante_pricing_periods: config.acampante_pricing_periods || [],
      updated_at: new Date() 
    };

    const validation = validateConfiguracoes({ id: existing?.id || 'new', ...payloadBase });
    if (!validation.isValid) throw new Error(validation.errors.join(' '));

    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabase.from('configuracoes').update(payloadBase).eq('id', existing.id).select().single());
    } else {
      ({ data, error } = await supabase.from('configuracoes').insert(payloadBase).select().single());
    }
    if (error) throw error;

    const { data: orgExisting } = await supabase.from('organizadores').select('id').limit(1).maybeSingle();
    const orgIdToUpdate = config.organizadorId || orgExisting?.id;

    if (orgIdToUpdate) {
      const datePayload = {
        data_edicao_dia_inicio: config.data_edicao_dia_inicio ? parseInt(config.data_edicao_dia_inicio, 10) : null,
        data_edicao_dia_fim: config.data_edicao_dia_fim ? parseInt(config.data_edicao_dia_fim, 10) : null,
        data_edicao_mes: config.data_edicao_mes || null,
        data_edicao_ano: config.data_edicao_ano ? parseInt(config.data_edicao_ano, 10) : null,
        edicao_numero: validEdicaoNum
      };
      const { error: orgError } = await supabase.from('organizadores').update(datePayload).eq('id', orgIdToUpdate).select();
      if (orgError) throw new Error("Falha ao salvar as datas no organizador.");
    }

    return data;
  } catch (error) {
    handleSupabaseError(error, 'saveConfiguracoes');
    return null;
  }
};

export const fetchInscricoesStatus = async () => {
  return withRetry(async () => {
    try {
      if (!navigator.onLine) return { inscricoes_equipantes: true, inscricoes_acampantes: true };
      const { data, error } = await supabase.from('inscricoes_status').select('id, inscricoes_equipantes, inscricoes_acampantes, updated_at').limit(1).maybeSingle();
      if (error) {
         if (['42P01', 'PGRST116', 'PGRST205'].includes(error.code)) return { inscricoes_equipantes: true, inscricoes_acampantes: true };
         throw error;
      }
      return data || { inscricoes_equipantes: true, inscricoes_acampantes: true };
    } catch (error) {
      return { inscricoes_equipantes: true, inscricoes_acampantes: true };
    }
  });
};

export const updateInscricoesStatus = async (equipantes, acampantes) => {
  try {
    if (!navigator.onLine) throw new Error("Você está offline. Verifique sua conexão.");
    const validation = validateInscricoesStatus({ equipantes, acampantes });
    if (!validation.isValid) throw new Error(validation.errors.join(' '));

    const { data: existing } = await supabase.from('inscricoes_status').select('id').limit(1).maybeSingle();

    const statusPayload = {
      inscricoes_equipantes: equipantes,
      inscricoes_acampantes: acampantes,
      updated_at: new Date()
    };

    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabase
        .from('inscricoes_status')
        .update(statusPayload)
        .eq('id', existing.id)
        .select());
    } else {
      ({ data, error } = await supabase
        .from('inscricoes_status')
        .insert(statusPayload)
        .select());
    }

    if (error) throw error;
    return data;
  } catch (error) {
    handleSupabaseError(error, 'updateInscricoesStatus');
    return null;
  }
};

export const fetchApprovedEquipantes = async (editionNumber = null) => {
  return withRetry(async () => {
    try {
      let query = supabase.from('equipantes').select('*').eq('status', 'aprovado');
      if (editionNumber) {
        query = query.eq('numero_edicao', editionNumber);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(eq => ({
        ...eq,
        nome_completo: eq.nome_completo || eq.nome,
        nome: eq.nome_completo || eq.nome
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
        equipante_nome: a.nome || a.nome_completo || a.equipante_nome || 'Sem nome',
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

export const fetchEquipantesByArea = async (areaNome, editionNumber = null) => {
  return withRetry(async () => {
    try {
      let query = supabase.from('escalas').select(`id, equipante_id, area_alocada, is_manual, equipante_nome, equipantes!inner (*)`).eq('area_alocada', areaNome);
      if (editionNumber) {
        query = query.eq('equipantes.numero_edicao', editionNumber);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data.map(item => ({
        ...item.equipantes,
        id: item.equipantes?.id || item.equipante_id,
        nome: item.equipantes?.nome_completo || item.equipantes?.nome || item.equipante_nome,
        allocatedArea: item.area_alocada,
        statusAllocation: 'Alocado',
        isManual: item.is_manual
      }));
    } catch (error) {
      return [];
    }
  });
};

export const fetchEquipantesByAreaAndGender = async (areaNome, editionNumber = null) => {
  const equipantes = await fetchEquipantesByArea(areaNome, editionNumber);
  const mulheres = equipantes.filter(e => e.sexo?.toLowerCase() === 'feminino' || e.genero?.toLowerCase() === 'feminino');
  const homens = equipantes.filter(e => e.sexo?.toLowerCase() === 'masculino' || e.genero?.toLowerCase() === 'masculino');
  return { mulheres, homens, todos: equipantes };
};

export const fetchAllAllocations = async (editionNumber = null) => {
  return withRetry(async () => {
    try {
      let query = supabase.from('escalas').select(`id, equipante_id, area_alocada, is_manual, equipante_nome, equipantes!inner (*)`);
      if (editionNumber) {
         query = query.eq('equipantes.numero_edicao', editionNumber);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data.map(item => ({
        ...item.equipantes,
        id: item.equipantes?.id || item.equipante_id,
        nome: item.equipantes?.nome_completo || item.equipantes?.nome || item.equipante_nome,
        allocatedArea: item.area_alocada,
        statusAllocation: 'Alocado',
        isManual: item.is_manual
      }));
    } catch (error) {
      return [];
    }
  });
};

export const fetchRelatoriosRapidos = async (edicaoId, editionNumber = null) => {
  return withRetry(async () => {
    try {
      if (!navigator.onLine) return { homens: { total: 0, confirmados: 0 }, mulheres: { total: 0, confirmados: 0 }, saude: { total: 0, confirmados: 0 }, medicamentos: { total: 0, confirmados: 0 }, camisas: {} };
      
      let query = supabase.from('acampantes').select('genero, tem_problema_saude, usa_medicamento, tamanho_camisa, status');
      if (editionNumber) {
        query = query.eq('numero_edicao', editionNumber);
      }

      const { data: acampantes, error: acampantesError } = await query;
      if (acampantesError) throw acampantesError;

      const stats = { homens: { total: 0, confirmados: 0 }, mulheres: { total: 0, confirmados: 0 }, saude: { total: 0, confirmados: 0 }, medicamentos: { total: 0, confirmados: 0 }, camisas: {} };
      acampantes?.forEach(acampante => {
        const isConfirmed = acampante.status === 'confirmado';
        if (acampante.genero === 'Masculino') { stats.homens.total++; if (isConfirmed) stats.homens.confirmados++; }
        else if (acampante.genero === 'Feminino') { stats.mulheres.total++; if (isConfirmed) stats.mulheres.confirmados++; }
        if (acampante.tem_problema_saude) { stats.saude.total++; if (isConfirmed) stats.saude.confirmados++; }
        if (acampante.usa_medicamento) { stats.medicamentos.total++; if (isConfirmed) stats.medicamentos.confirmados++; }
        if (acampante.tamanho_camisa) { const size = acampante.tamanho_camisa; stats.camisas[size] = (stats.camisas[size] || 0) + 1; }
      });
      return stats;
    } catch (error) {
      return { homens: { total: 0, confirmados: 0 }, mulheres: { total: 0, confirmados: 0 }, saude: { total: 0, confirmados: 0 }, medicamentos: { total: 0, confirmados: 0 }, camisas: {} };
    }
  });
};