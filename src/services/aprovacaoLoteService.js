import { supabase } from '@/services/supabaseClient';

/**
 * Aprovacao de equipantes em lote (so organizador) -- migration 20261007a.
 *
 * A senha vai para o servidor, que a confere contra a do organizador logado
 * (e conta as tentativas erradas junto com as do login). Nada de senha fica
 * guardado aqui.
 */

const resposta = ({ data, error }, padrao) => {
  if (error) return { success: false, error: error.message || padrao };
  if (!data?.ok) return { success: false, error: data?.erro || padrao };
  return { success: true, ...data };
};

/** ids: as inscricoes pendentes que o organizador viu e confirmou. */
export const aprovarEmLote = async (ids, senha, descricao) =>
  resposta(
    await supabase.rpc('aprovar_em_lote', { p_ids: ids, p_senha: senha, p_descricao: descricao }),
    'Não foi possível aprovar o lote.'
  );

export const desfazerLoteAprovacao = async (idDoLote) =>
  resposta(
    await supabase.rpc('desfazer_lote_aprovacao', { p_lote: idDoLote }),
    'Não foi possível desfazer o lote.'
  );

export const listarLotesAprovacao = async () => {
  const { data, error } = await supabase.rpc('listar_lotes_aprovacao');
  if (error) return { success: false, error: error.message, lotes: [] };
  return { success: true, lotes: Array.isArray(data) ? data : [] };
};
