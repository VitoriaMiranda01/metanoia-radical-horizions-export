import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Tela da saude (login de apoio, 09/10/2026).
 *
 * A lider da saude nao le nenhuma tabela direto: o banco entrega, pela funcao
 * saude_acampantes(), so os campos que a tela usa (saude, medicamentos,
 * restricao alimentar, contato de emergencia, idade, grupo de trilha...).
 */
export const fetchSaudeAcampantes = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('saude_acampantes'),
    { rotulo: 'dados de saúde' }
  );
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar os dados de saúde.');
  return data.acampantes || [];
};
