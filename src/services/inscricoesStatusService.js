import { supabase } from '@/services/supabaseClient';
import { validateInscricoesStatus } from '@/utils/validation';
import { withRetry, handleSupabaseError } from '@/services/serviceHelpers';

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
