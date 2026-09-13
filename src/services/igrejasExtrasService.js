import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * As igrejas "OUTRA": o que as pessoas digitaram, e o que já virou opção
 * do formulário.
 *
 * Quem congrega numa igreja fora das 145 escolhe OUTRA e escreve o nome. Esses
 * nomes ficam numa relação à parte, só para os organizadores, que decidem quais
 * merecem entrar na lista de verdade. Promovida, a igreja passa a aparecer no
 * formulário na hora — sem publicar o site de novo, e sem mexer na lista
 * original.
 *
 * Igreja promovida NÃO vira conta de parceiro: não tem código nem login. Quem
 * aprova essas inscrições continua sendo a organização.
 */

export const fetchOutrasIgrejas = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('outras_igrejas'),
    { rotulo: 'igrejas OUTRA' }
  );
  if (error) {
    console.error('igrejasExtras - listar', error?.message || error);
    return { success: false, error: error.message || 'Erro ao carregar', digitadas: [], extras: [] };
  }
  if (!data?.ok) {
    return { success: false, error: data?.erro || 'Não foi possível carregar', digitadas: [], extras: [] };
  }
  return { success: true, digitadas: data.digitadas || [], extras: data.extras || [] };
};

export const adicionarIgrejaExtra = async (nome) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('adicionar_igreja_extra', { p_nome: nome }),
    { rotulo: 'adicionar igreja' }
  );
  if (error) return { success: false, error: error.message || 'Erro ao adicionar' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível adicionar' };
  return { success: true, nome: data.nome };
};

export const removerIgrejaExtra = async (id) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('remover_igreja_extra', { p_id: id }),
    { rotulo: 'remover igreja' }
  );
  if (error) return { success: false, error: error.message || 'Erro ao remover' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível remover' };
  return { success: true };
};
