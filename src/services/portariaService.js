import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Tela da portaria (login de apoio, 24/10/2026): entrada dos EQUIPANTES.
 *
 * A conta da portaria nao le nenhuma tabela direto: o banco entrega, pela
 * funcao portaria_lista(), so nome, igreja, area, situacao do pagamento, a
 * entrada e a observacao. Pagar agora, liberar a entrada, os desfazer e a
 * observacao tambem sao funcoes do banco, que conferem quem esta logado.
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

// "Assinatura" curta do que a lista mostra (escala, pagamentos, entradas,
// observacoes). A tela confere a cada poucos segundos e so baixa a lista
// inteira (~400 KB) quando ela muda. null = sem acesso.
export const fetchPortariaVersao = async () => {
  const { data, error } = await supabase.rpc('portaria_versao');
  if (error) throw error;
  return data ?? null;
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
  if (!data?.ok) {
    // Recusa do banco (ja esta paga, fora da escala...): a tela fecha a janela
    // e recarrega. Erro de conexao (acima) deixa a janela aberta para tentar.
    const recusa = new Error(data?.erro || falha);
    recusa.recusadoPeloBanco = true;
    throw recusa;
  }
  return data;
};

// "Pagar agora": so equipante. liberarEntrada = ja entrega a pulseira no mesmo passo.
// observacao: obrigatoria no Pix externo (o banco confere); nos outros meios e opcional.
export const darBaixaPortaria = (tipo, id, meio, valor, liberarEntrada = false, observacao = null) =>
  gravar('portaria_dar_baixa', {
    p_tipo: tipo, p_id: id, p_meio: meio, p_valor: valor, p_liberar_entrada: liberarEntrada,
    p_observacao: observacao,
  }, 'Não foi possível registrar o pagamento.');

// Entrada (pulseira entregue): so quem ja pagou ou e isento.
export const liberarEntradaPortaria = (id) =>
  gravar('portaria_liberar_entrada', { p_id: id }, 'Não foi possível liberar a entrada.');

export const desfazerEntradaPortaria = (id) =>
  gravar('portaria_desfazer_entrada', { p_id: id }, 'Não foi possível desfazer a entrada.');

export const desfazerBaixaPortaria = (tipo, id) =>
  gravar('portaria_desfazer_baixa', { p_tipo: tipo, p_id: id },
    'Não foi possível desfazer a baixa.');

export const salvarObservacaoPortaria = (tipo, id, texto) =>
  gravar('portaria_salvar_observacao', { p_tipo: tipo, p_id: id, p_texto: texto },
    'Não foi possível salvar a observação.');

// Só Domingo sem aprovação: a portaria registra o recebimento da carta pastoral
// (observação opcional) antes de poder cobrar ou liberar a entrada.
export const receberCartaPortaria = (id, texto) =>
  gravar('portaria_receber_carta', { p_id: id, p_texto: texto || null },
    'Não foi possível registrar a carta.');

export const desfazerCartaPortaria = (id) =>
  gravar('portaria_desfazer_carta', { p_id: id }, 'Não foi possível desfazer a carta.');
