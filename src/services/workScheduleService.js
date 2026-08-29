import { supabase } from '@/services/supabaseClient';

export const updateWorkScheduleStatus = async (cpf) => {
  try {
    if (!cpf || cpf.length < 11) {
      return { success: false, error: 'CPF inválido fornecido' };
    }

    const { data: equipante, error: searchError } = await supabase
      .from('equipantes')
      .select('id, nome, cpf, scale_status')
      .eq('cpf', cpf)
      .maybeSingle();

    if (searchError) {
      console.error('workScheduleApi - updateWorkScheduleStatus search', searchError, { cpf });
      return { success: false, error: 'Erro ao buscar equipante no banco de dados' };
    }

    if (!equipante) {
      return { success: true, noMatch: true, message: 'Nenhum equipante encontrado com este CPF' };
    }

    if (equipante.scale_status === 'ok') {
      return { success: true, alreadyUpdated: true, data: equipante, message: 'Status de escala já estava atualizado' };
    }

    const { data, error: updateError } = await supabase
      .from('equipantes')
      .update({ scale_status: 'ok' })
      .eq('id', equipante.id)
      .select()
      .single();

    if (updateError) {
      console.error('workScheduleApi - updateWorkScheduleStatus update', updateError, { id: equipante.id });
      return { success: false, error: 'Erro ao atualizar status de escala do equipante' };
    }

    return {
      success: true,
      data,
      equipanteName: equipante.nome,
      message: 'Status de escala atualizado com sucesso'
    };

  } catch (err) {
    console.error('workScheduleApi - updateWorkScheduleStatus', err);
    return { success: false, error: 'Erro inesperado ao atualizar status de escala' };
  }
};

export const batchUpdateWorkScheduleStatus = async (cpfs) => {
  try {
    if (!Array.isArray(cpfs) || cpfs.length === 0) {
      return { success: false, error: 'Nenhum CPF fornecido para atualização' };
    }

    const results = { updated: 0, failed: 0, alreadyUpdated: 0, notFound: 0, errors: [] };

    for (const cpf of cpfs) {
      if (!cpf) continue;
      const result = await updateWorkScheduleStatus(cpf);
      
      if (result.success) {
        if (result.noMatch) results.notFound++;
        else if (result.alreadyUpdated) results.alreadyUpdated++;
        else results.updated++;
      } else {
        results.failed++;
        results.errors.push({ cpf, error: result.error });
      }
    }

    return {
      success: true,
      ...results,
      message: `Atualizado: ${results.updated}, Já atualizado: ${results.alreadyUpdated}, Não encontrado: ${results.notFound}, Falhas: ${results.failed}`
    };

  } catch (err) {
    console.error('workScheduleApi - batchUpdateWorkScheduleStatus', err);
    return { success: false, error: 'Erro inesperado na atualização em lote' };
  }
};