import { supabase } from '@/lib/supabase';

export const searchEquipanteByCPF = async (cpf) => {
  try {
    if (!cpf || cpf.length < 11) return null;

    const { data, error } = await supabase
      .from('equipantes')
      .select('*')
      .eq('cpf', cpf)
      .eq('tipo', 'equipante')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error searching equipante by CPF:', error);
      return null;
    }

    if (!data) return null;

    return {
      nome: data.nome_completo || data.nome,
      whatsapp: data.whatsapp || data.telefone,
      tamanhoCamisa: data.tamanho_camisa || data.tamanho_camiseta,
      igreja: data.igreja || data.nome_igreja,
      areaTrabalhoOpcao1: data.area_trabalho_opcao1,
      areaTrabalhoOpcao2: data.area_trabalho_opcao2,
      areaTrabalhoOpcao3: data.area_trabalho_opcao3
    };

  } catch (err) {
    console.error('Unexpected error in searchEquipanteByCPF:', err);
    return null;
  }
};

/**
 * Initializes workflow fields on the equipante record based on their age.
 * @param {string} equipante_id
 * @param {number} age - age in years (from the 'idade' form field)
 */
export const initEquipanteWorkflow = async (equipante_id, age) => {
  const isMinor = Number(age) < 18;

  const { data, error } = await supabase
    .from('equipantes')
    .update({
      current_stage: isMinor ? 'parental_auth' : 'pastoral_auth',
      pastoral_auth_status: 'pendente',
      scale_status: 'pendente',
    })
    .eq('id', equipante_id)
    .eq('tipo', 'equipante')
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateWorkflowStage = async (equipante_id, updates) => {
  const { data, error } = await supabase
    .from('equipantes')
    .update(updates)
    .eq('id', equipante_id)
    .eq('tipo', 'equipante')
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const uploadParentalAuthFile = async (equipante_id, file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${equipante_id}-${Math.random()}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('equipante-authorizations')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from('equipante-authorizations')
    .getPublicUrl(fileName);

  const { data, error } = await supabase
    .from('equipantes')
    .update({
      parental_auth_file_url: publicUrlData.publicUrl,
      parental_auth_uploaded_at: new Date().toISOString(),
      current_stage: 'pastoral_auth'
    })
    .eq('id', equipante_id)
    .eq('tipo', 'equipante')
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getEquipanteWorkflow = async (equipante_id) => {
  const { data, error } = await supabase
    .from('equipantes')
    .select('id, idade, current_stage, parental_auth_file_url, parental_auth_uploaded_at, pastoral_auth_status, scale_status, status_pagamento, created_at, updated_at')
    .eq('id', equipante_id)
    .eq('tipo', 'equipante')
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getEquipantesByWorkflowStage = async () => {
  const { data, error } = await supabase
    .from('equipantes')
    .select('id, nome_completo, nome, cpf, idade, current_stage, parental_auth_file_url, parental_auth_uploaded_at, pastoral_auth_status, scale_status, status_pagamento, created_at, updated_at')
    .eq('tipo', 'equipante')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const updatePastoralAuthStatus = async (equipanteId, status) => {
  const { data, error } = await supabase
    .from('equipantes')
    .update({ pastoral_auth_status: status })
    .eq('id', equipanteId)
    .eq('tipo', 'equipante')
    .select()
    .single();

  if (error) {
    console.error('Error updating pastoral auth status:', error);
    throw error;
  }
  
  return data;
};

/**
 * Updates the pastoral authorization status for an equipante by CPF
 * Used when approving acampante inscriptions to auto-approve linked equipante
 * @param {string} cpf - CPF to search for in equipantes table
 * @returns {Object} { success: boolean, message: string, data?: object }
 */
export const updatePastoralAuthOnApproval = async (cpf) => {
  try {
    if (!cpf || cpf.length < 11) {
      console.warn('[updatePastoralAuthOnApproval] Invalid CPF provided:', cpf);
      return { 
        success: false, 
        message: 'CPF inválido fornecido' 
      };
    }

    // Find equipante by CPF - CRITICAL: Only match tipo='equipante'
    const { data: equipante, error: searchError } = await supabase
      .from('equipantes')
      .select('id, nome, nome_completo, cpf, pastoral_auth_status')
      .eq('cpf', cpf)
      .eq('tipo', 'equipante')
      .maybeSingle();

    if (searchError) {
      console.error('[updatePastoralAuthOnApproval] Error searching equipante:', searchError);
      return { 
        success: false, 
        message: 'Erro ao buscar equipante no banco de dados',
        error: searchError 
      };
    }

    // No matching equipante found - log but don't error
    if (!equipante) {
      console.log(`[updatePastoralAuthOnApproval] No equipante found with CPF: ${cpf}`);
      return { 
        success: true, 
        message: 'Nenhum equipante encontrado com este CPF (esperado se pessoa só é acampante)',
        noMatch: true
      };
    }

    // Update pastoral auth status to 'ok'
    const { data, error: updateError } = await supabase
      .from('equipantes')
      .update({ pastoral_auth_status: 'ok' })
      .eq('id', equipante.id)
      .eq('tipo', 'equipante')
      .select()
      .single();

    if (updateError) {
      console.error('[updatePastoralAuthOnApproval] Error updating pastoral auth:', updateError);
      return { 
        success: false, 
        message: 'Erro ao atualizar autorização pastoral do equipante',
        error: updateError 
      };
    }

    console.log(`[updatePastoralAuthOnApproval] Successfully updated pastoral auth for equipante: ${equipante.nome || equipante.nome_completo} (CPF: ${cpf})`);
    
    return { 
      success: true, 
      message: 'Autorização pastoral atualizada com sucesso',
      data,
      equipanteName: equipante.nome || equipante.nome_completo
    };

  } catch (err) {
    console.error('[updatePastoralAuthOnApproval] Unexpected error:', err);
    return { 
      success: false, 
      message: 'Erro inesperado ao atualizar autorização pastoral',
      error: err 
    };
  }
};

/**
 * Fetches all equipantes records with tipo='equipante' for display in list views
 * @returns {Array} Array of equipante records
 */
export const getAllEquipantes = async () => {
  const { data, error } = await supabase
    .from('equipantes')
    .select('*')
    .eq('tipo', 'equipante')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching equipantes:', error);
    throw error;
  }

  return data || [];
};