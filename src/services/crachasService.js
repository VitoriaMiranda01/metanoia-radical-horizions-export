import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Crachas dos acampantes (26/10/2026, migration 20261026c). So organizador.
 * A lista e a mesma da recepcao e dos onibus; o banco guarda so o que saiu no
 * ultimo cracha impresso de cada um (nome, cor, numero), para a tela saber
 * quem falta imprimir e quem mudou depois de impresso.
 */
export const fetchCrachas = async () => {
  const { data, error } = await comReenvio(() => supabase.rpc('crachas_lista'), { rotulo: 'crachás' });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar os crachás.');
  return data.pessoas || [];
};

const gravar = async (funcao, args, falha) => {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || falha);
  return data;
};

// itens: [{ tipo, id, nome, grupo, numero }] -- exatamente o que foi impresso.
export const marcarCrachasImpressos = (itens) =>
  gravar('crachas_marcar_impressos', { p_itens: itens }, 'Não foi possível marcar os crachás como impressos.');

export const desmarcarCrachaImpresso = (tipo, id) =>
  gravar('crachas_desmarcar_impresso', { p_tipo: tipo, p_id: id }, 'Não foi possível desmarcar o crachá.');
