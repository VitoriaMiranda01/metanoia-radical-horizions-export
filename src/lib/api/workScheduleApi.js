import { supabase } from '@/lib/supabase';

/**
 * Updates the scale_status to 'ok' for an equipante by CPF
 * @param {string} cpf - CPF of the equipante to update
 * @returns {Object} { success: boolean, data?: object, error?: string }
 */
export const updateWorkScheduleStatus = async (cpf) => {
  try {
    if (!cpf || cpf.length < 11) {
      return {
        success: false,
        error: 'CPF inválido fornecido'
      };
    }

    // Find equipante by CPF
    const { data: equipante, error: searchError } = await supabase
      .from('equipantes')
      .select('id, nome, nome_completo, cpf, scale_status')
      .eq('cpf', cpf)
      .maybeSingle();

    if (searchError) {
      console.error('[updateWorkScheduleStatus] Error searching equipante:', searchError);
      return {
        success: false,
        error: 'Erro ao buscar equipante no banco de dados'
      };
    }

    // No matching equipante found
    if (!equipante) {
      console.log(`[updateWorkScheduleStatus] No equipante found with CPF: ${cpf}`);
      return {
        success: true,
        noMatch: true,
        message: 'Nenhum equipante encontrado com este CPF'
      };
    }

    // Check if already 'ok'
    if (equipante.scale_status === 'ok') {
      console.log(`[updateWorkScheduleStatus] Equipante ${equipante.nome || equipante.nome_completo} already has scale_status = 'ok'`);
      return {
        success: true,
        alreadyUpdated: true,
        data: equipante,
        message: 'Status de escala já estava atualizado'
      };
    }

    // Update scale_status to 'ok'
    const { data, error: updateError } = await supabase
      .from('equipantes')
      .update({ scale_status: 'ok' })
      .eq('id', equipante.id)
      .select()
      .single();

    if (updateError) {
      console.error('[updateWorkScheduleStatus] Error updating work schedule status:', updateError);
      return {
        success: false,
        error: 'Erro ao atualizar status de escala do equipante'
      };
    }

    console.log(`[updateWorkScheduleStatus] Successfully updated scale_status for equipante: ${equipante.nome || equipante.nome_completo} (CPF: ${cpf})`);

    return {
      success: true,
      data,
      equipanteName: equipante.nome || equipante.nome_completo,
      message: 'Status de escala atualizado com sucesso'
    };

  } catch (err) {
    console.error('[updateWorkScheduleStatus] Unexpected error:', err);
    return {
      success: false,
      error: 'Erro inesperado ao atualizar status de escala'
    };
  }
};

/**
 * Batch update scale_status for multiple equipantes by CPF
 * @param {Array<string>} cpfs - Array of CPFs to update
 * @returns {Object} { success: boolean, updated: number, failed: number, errors: Array }
 */
export const batchUpdateWorkScheduleStatus = async (cpfs) => {
  try {
    if (!Array.isArray(cpfs) || cpfs.length === 0) {
      return {
        success: false,
        error: 'Nenhum CPF fornecido para atualização'
      };
    }

    const results = {
      updated: 0,
      failed: 0,
      alreadyUpdated: 0,
      notFound: 0,
      errors: []
    };

    // Process each CPF
    for (const cpf of cpfs) {
      const result = await updateWorkScheduleStatus(cpf);
      
      if (result.success) {
        if (result.noMatch) {
          results.notFound++;
        } else if (result.alreadyUpdated) {
          results.alreadyUpdated++;
        } else {
          results.updated++;
        }
      } else {
        results.failed++;
        results.errors.push({
          cpf,
          error: result.error
        });
      }
    }

    console.log('[batchUpdateWorkScheduleStatus] Batch update completed:', results);

    return {
      success: true,
      ...results,
      message: `Atualizado: ${results.updated}, Já atualizado: ${results.alreadyUpdated}, Não encontrado: ${results.notFound}, Falhas: ${results.failed}`
    };

  } catch (err) {
    console.error('[batchUpdateWorkScheduleStatus] Unexpected error:', err);
    return {
      success: false,
      error: 'Erro inesperado na atualização em lote'
    };
  }
};