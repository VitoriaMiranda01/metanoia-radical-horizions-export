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
  return {
    success: true,
    digitadas: data.digitadas || [],
    extras: data.extras || [],
    novas: data.novas || [],
    proximoCodigo: data.proximo_codigo || '',
    permiteOutra: data.permite_outra !== false,
    permiteDiversos: data.permite_diversos !== false,
  };
};

/**
 * As fichas de quem escreveu `texto` em OUTRA (inteiras, so para organizador):
 * o organizador abre a ficha e ve o pastor antes de decidir a igreja.
 */
export const fetchPessoasEmOutra = async (texto) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('pessoas_em_outra', { p_texto: texto }),
    { rotulo: 'quem escreveu em OUTRA' }
  );
  if (error) return { success: false, error: error.message || 'Erro ao carregar', pessoas: [] };
  return { success: true, pessoas: Array.isArray(data) ? data : [] };
};

/**
 * Todo equipante que escreveu `texto` em OUTRA passa para a `igreja`
 * ("NNN - NOME"). Com `ids`, so essas pessoas (o mesmo texto pode ser de
 * igrejas diferentes).
 */
export const vincularOutraIgreja = async (texto, igreja, ids = null) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('vincular_outra_igreja', { p_texto: texto, p_igreja: igreja, p_ids: ids }),
    { rotulo: 'vincular igreja' }
  );
  if (error) return { success: false, error: error.message || 'Erro ao vincular' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível vincular' };
  return { success: true, vinculados: data.vinculados, igreja: data.igreja };
};

/**
 * Cria a igreja no proximo codigo (conta de parceiro trancada, como as outras)
 * e, se veio de um nome digitado em OUTRA, vincula quem escreveu esse nome.
 */
export const criarIgrejaParceira = async (nome, textoDigitado = null, ids = null) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('criar_igreja_parceira', { p_nome: nome, p_texto: textoDigitado, p_ids: ids }),
    { rotulo: 'criar igreja' }
  );
  if (error) return { success: false, error: error.message || 'Erro ao criar a igreja' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível criar a igreja' };
  return { success: true, codigo: data.codigo, nome: data.nome, igreja: data.igreja, vinculados: data.vinculados };
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

/**
 * Dados para a planilha "todas as igrejas cadastradas" (Configuracoes): as
 * igrejas adicionadas, quantos inscritos cada igreja tem e o que foi escrito
 * em OUTRA. So organizador recebe (relatorio_igrejas); a lista das 145 vem
 * da constante IGREJAS_PARCEIRAS, a mesma do formulario.
 */
export const fetchRelatorioIgrejas = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('relatorio_igrejas'),
    { rotulo: 'relatório de igrejas' }
  );
  if (error) throw new Error(error.message || 'Erro ao carregar as igrejas');
  if (!data) throw new Error('Só organizador pode exportar a lista de igrejas.');
  return data;
};
