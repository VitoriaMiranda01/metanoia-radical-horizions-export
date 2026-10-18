import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Excluir cadastro (18/10/2026, Patrick): cadastros duplicados que nao saiam
 * por lugar nenhum. Buscar, ver tudo da pessoa e excluir com confirmacao.
 * Quem decide tudo e o banco (migration 20261018a): so Desenvolvedores, Raquel
 * e Dudu excluem; quem ja pagou nao sai; a ficha inteira fica guardada em
 * exclusoes_cadastro antes de apagar.
 */
const chamar = async (funcao, params, rotulo) => {
  const { data, error } = await comReenvio(() => supabase.rpc(funcao, params), { rotulo });
  if (error) return { ok: false, erro: error.message || 'Sem conexão com o servidor agora.' };
  return data || { ok: false, erro: 'Resposta vazia do servidor.' };
};

export const buscarCadastrosParaExcluir = (termo) =>
  chamar('buscar_cadastros_exclusao', { p_termo: termo }, 'busca de cadastros');

export const fichaParaExclusao = (tipo, id) =>
  chamar('ficha_para_exclusao', { p_tipo: tipo, p_id: id }, 'ficha do cadastro');

export const excluirCadastro = (tipo, id, confirmacao, motivo) =>
  chamar('excluir_cadastro', { p_tipo: tipo, p_id: id, p_confirmacao: confirmacao, p_motivo: motivo }, 'exclusão do cadastro');
