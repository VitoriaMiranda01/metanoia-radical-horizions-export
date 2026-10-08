import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Pastores Parceiros (Configuracoes, 08/10/2026): todos os pastores de cada
 * igreja -- pode haver varios por igreja. So organizador (o servidor confere).
 */

export const fetchPastores = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('pastores_listar'),
    { rotulo: 'pastores parceiros' }
  );
  if (error) throw new Error(error.message || 'Erro ao carregar os pastores');
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar os pastores');
  return data.pastores || [];
};

// id null = novo pastor. Sem reenvio automatico: e uma gravacao.
export const salvarPastor = async ({ id = null, nome, cpf, telefone, igrejaCodigo }) => {
  const { data, error } = await supabase.rpc('salvar_pastor', {
    p_id: id, p_nome: nome, p_cpf: cpf || '', p_telefone: telefone || '', p_igreja_codigo: igrejaCodigo || '',
  });
  if (error) return { success: false, error: error.message || 'Erro ao salvar o pastor' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível salvar o pastor' };
  return { success: true, id: data.id, nome: data.nome, igreja: data.igreja };
};

// Nao apaga: fica no historico como removido.
export const removerPastor = async (id) => {
  const { data, error } = await supabase.rpc('remover_pastor', { p_id: id });
  if (error) return { success: false, error: error.message || 'Erro ao remover o pastor' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível remover o pastor' };
  return { success: true, nome: data.nome };
};
