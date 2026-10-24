import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Tela da portaria (login de apoio, 24/10/2026).
 *
 * A conta da portaria nao le nenhuma tabela direto: o banco entrega, pela
 * funcao portaria_lista(), so nome, igreja, situacao do pagamento e a
 * observacao. A baixa (dinheiro/cartao), o desfazer e a observacao tambem sao
 * funcoes do banco, que conferem quem esta logado.
 */
export const fetchPortariaLista = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('portaria_lista'),
    { rotulo: 'lista da portaria' }
  );
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar a lista.');
  return data.pessoas || [];
};

// Valor sugerido para a baixa (lote do dia, com desconto automatico de
// pastor/infiltrado do equipante). A portaria confere e pode mudar.
export const fetchValorPrevisto = async (tipo, id) => {
  const { data, error } = await supabase.rpc('portaria_valor_previsto', { p_tipo: tipo, p_id: id });
  if (error || !data?.ok) return null;
  return data;
};

// Gravacoes: sem reenvio automatico.
const gravar = async (funcao, args, falha) => {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || falha);
  return data;
};

export const darBaixaPortaria = (tipo, id, meio, valor) =>
  gravar('portaria_dar_baixa', { p_tipo: tipo, p_id: id, p_meio: meio, p_valor: valor },
    'Não foi possível dar baixa.');

export const desfazerBaixaPortaria = (tipo, id) =>
  gravar('portaria_desfazer_baixa', { p_tipo: tipo, p_id: id },
    'Não foi possível desfazer a baixa.');

export const salvarObservacaoPortaria = (tipo, id, texto) =>
  gravar('portaria_salvar_observacao', { p_tipo: tipo, p_id: id, p_texto: texto },
    'Não foi possível salvar a observação.');
