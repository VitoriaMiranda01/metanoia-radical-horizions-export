import { supabase } from '@/services/supabaseClient';

/**
 * Limite de inscricoes de acampantes por igreja (excecoes ao limite padrao
 * geral, guardado em configuracoes.limite_acampantes_por_igreja). Mesmo
 * padrao de limiteAreasService.js: uma linha por item que precisa de um
 * valor diferente do padrao.
 *
 * A garantia de verdade contra o limite ser ultrapassado (inclusive em
 * cadastros simultaneos da mesma igreja) fica no banco, num trigger em
 * "acampantes" (ver database/migrations/schema-update-20260907-limite-
 * acampantes-por-igreja.sql). As funcoes deste arquivo sao usadas so pra:
 * (a) a tela de Configuracoes gerenciar as excecoes, e (b) o formulario de
 * inscricao desabilitar, por cortesia, as igrejas que ja bateram o limite
 * -- sem isso, o cadastro so falharia com o erro do banco depois de enviar.
 */

export const fetchLimitesIgrejas = async () => {
  try {
    const { data, error } = await supabase
      .from('limites_igrejas')
      .select('igreja, limite_maximo, updated_at');

    if (error) {
      if (error.code === '42P01') {
        console.warn("Tabela 'limites_igrejas' não existe. Retornando lista vazia.");
        return {};
      }
      throw error;
    }

    const limitsMap = {};
    (data || []).forEach(item => {
      limitsMap[item.igreja] = item.limite_maximo;
    });
    return limitsMap;
  } catch (error) {
    console.error('Erro ao buscar limites de igrejas:', error);
    return {};
  }
};

export const saveLimiteIgreja = async (igreja, limiteMaximo) => {
  if (!igreja) throw new Error('Selecione uma igreja.');

  const max = parseInt(limiteMaximo, 10);
  if (isNaN(max) || max < 1) {
    throw new Error('Informe um limite válido (mínimo 1).');
  }

  const { data, error } = await supabase
    .from('limites_igrejas')
    .upsert(
      { igreja, limite_maximo: max, updated_at: new Date().toISOString() },
      { onConflict: 'igreja' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteLimiteIgreja = async (igreja) => {
  const { error } = await supabase
    .from('limites_igrejas')
    .delete()
    .eq('igreja', igreja);

  if (error) throw error;
};

// Conta quantos acampantes ja estao inscritos por igreja (campo
// admin_responsavel = "Igreja Responsavel pela Inscricao"), pra saber se
// uma igreja ja bateu o limite. Conta TODAS as inscricoes, independente de
// status de pagamento (regra combinada com a usuaria em 2026-09-07: toda
// inscricao enviada ja ocupa a vaga da igreja).
export const fetchOcupacaoIgrejasAcampantes = async () => {
  try {
    const { data, error } = await supabase
      .from('acampantes')
      .select('admin_responsavel');

    if (error) throw error;

    const counts = {};
    (data || []).forEach(row => {
      const igreja = row.admin_responsavel;
      if (!igreja) return;
      counts[igreja] = (counts[igreja] || 0) + 1;
    });
    return counts;
  } catch (error) {
    console.error('Erro ao buscar ocupação de igrejas:', error);
    return {};
  }
};
