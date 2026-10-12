import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Vinculos entre acampantes nos grupos de trilha (so organizador) --
 * migration 20261012a. As tabelas ficam fechadas; tudo passa pelas funcoes.
 */

const resposta = ({ data, error }, padrao) => {
  if (error) return { success: false, error: error.message || padrao };
  if (!data?.ok) return { success: false, error: data?.erro || padrao };
  return { success: true, ...data };
};

/** { vinculos: [{id, a, b, tipo, observacao, origem, criado_por, criado_em}], ignoradas: [ids] } */
export const fetchVinculosAcampantes = async () => {
  const { data, error } = await comReenvio(() => supabase.rpc('vinculos_acampantes'), { rotulo: 'vínculos dos acampantes' });
  if (error) return { success: false, error: error.message, vinculos: [], ignoradas: [] };
  return {
    success: true,
    vinculos: Array.isArray(data?.vinculos) ? data.vinculos : [],
    ignoradas: Array.isArray(data?.ignoradas) ? data.ignoradas : [],
  };
};

/** tipo: o que B e de A. origem: quem escreveu o "vai com" (ao confirmar sugestao). */
export const salvarVinculo = async ({ a, b, tipo, observacao = null, origem = null }) =>
  resposta(
    await supabase.rpc('salvar_vinculo_acampantes', {
      p_a: a, p_b: b, p_tipo: tipo, p_observacao: observacao, p_origem: origem,
    }),
    'Não foi possível salvar o vínculo.'
  );

export const excluirVinculo = async (id) =>
  resposta(await supabase.rpc('excluir_vinculo_acampantes', { p_id: id }), 'Não foi possível excluir o vínculo.');

export const ignorarSugestao = async (acampanteId, ignorar = true) =>
  resposta(
    await supabase.rpc('ignorar_sugestao_vinculo', { p_acampante: acampanteId, p_ignorar: ignorar }),
    'Não foi possível atualizar a sugestão.'
  );
