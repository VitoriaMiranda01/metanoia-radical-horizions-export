import { supabase } from '@/services/supabaseClient';
import { validateInscricoesStatus } from '@/utils/validation';
import { withRetry, handleSupabaseError } from '@/services/serviceHelpers';
import { fetchConfigPublica } from '@/services/publicDataService';

// Chamada pelas paginas publicas de inscricao -- por isso passa pela funcao
// config_publica em vez de ler a tabela "configuracoes" direto.
export const fetchInscricoesStatus = async () => {
  return withRetry(async () => {
    const PADRAO = { inscricoes_equipantes: true, inscricoes_acampantes: true };
    try {
      if (!navigator.onLine) return PADRAO;
      const config = await fetchConfigPublica();
      if (!config) return PADRAO;
      // lote_*_hoje (20261104e): sem lote de preco hoje nao ha como pagar,
      // entao o site trata como fechado. Ausente (banco antigo) = tem lote.
      return {
        inscricoes_equipantes: config.inscricoes_equipantes,
        inscricoes_acampantes: config.inscricoes_acampantes,
        lote_equipante_hoje: config.lote_equipante_hoje !== false,
        lote_acampante_hoje: config.lote_acampante_hoje !== false,
        updated_at: config.updated_at
      };
    } catch (error) {
      console.error('inscricoesStatusService - fetchInscricoesStatus', error?.message || error);
      return PADRAO;
    }
  });
};

export const updateInscricoesStatus = async (equipantes, acampantes) => {
  try {
    if (!navigator.onLine) throw new Error("Você está offline. Verifique sua conexão.");
    const validation = validateInscricoesStatus({ equipantes, acampantes });
    if (!validation.isValid) throw new Error(validation.errors.join(' '));

    const { data: existing } = await supabase.from('configuracoes').select('id').limit(1).maybeSingle();

    const statusPayload = {
      inscricoes_equipantes: equipantes,
      inscricoes_acampantes: acampantes,
      updated_at: new Date()
    };

    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabase
        .from('configuracoes')
        .update(statusPayload)
        .eq('id', existing.id)
        .select());
    } else {
      ({ data, error } = await supabase
        .from('configuracoes')
        .insert(statusPayload)
        .select());
    }

    if (error) {
      // Gatilho inscricoes_exigem_lote (20261104e): abrir sem lote hoje.
      if (error.message?.includes('SEM_LOTE_HOJE_ACAMPANTE')) {
        throw new Error('Não há lote de preço de acampante cobrindo a data de hoje. Cadastre o lote antes de abrir as inscrições.');
      }
      if (error.message?.includes('SEM_LOTE_HOJE_EQUIPANTE')) {
        throw new Error('Não há lote de preço de equipante cobrindo a data de hoje. Cadastre o lote antes de abrir as inscrições.');
      }
      throw error;
    }
    return data;
  } catch (error) {
    handleSupabaseError(error, 'updateInscricoesStatus');
    return null;
  }
};
