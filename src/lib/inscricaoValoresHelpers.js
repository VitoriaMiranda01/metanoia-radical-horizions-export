import { supabase } from '@/lib/supabase';

const DEFAULT_VALOR_CENTAVOS = 15000; // R$ 150,00 default

/**
 * Recupera o valor da inscrição para uma edição e tipo específicos.
 * @param {string} numeroEdicao 
 * @param {string} tipo 'equipante' ou 'acampante'
 * @returns {Promise<number>} Valor em centavos
 */
export const getValorInscricao = async (numeroEdicao, tipo) => {
  try {
    const column = tipo === 'equipante' ? 'valor_equipante' : 'valor_acampante';
    const { data, error } = await supabase
      .from('configuracoes')
      .select(column)
      .eq('edicao_numero', numeroEdicao)
      .maybeSingle();

    if (error || !data || data[column] == null) return DEFAULT_VALOR_CENTAVOS;
    return data[column];
  } catch (error) {
    console.error("Erro ao obter valor inscrição:", error);
    return DEFAULT_VALOR_CENTAVOS;
  }
};

/**
 * Salva os valores de inscrição para uma edição.
 * @param {string} numeroEdicao 
 * @param {number} valorEquipante (em centavos)
 * @param {number} valorAcampante (em centavos)
 */
export const salvarValoresInscricao = async (numeroEdicao, valorEquipante, valorAcampante) => {
  try {
    const { data: existing } = await supabase
      .from('configuracoes')
      .select('id')
      .eq('edicao_numero', numeroEdicao)
      .maybeSingle();

    const payload = {
      edicao_numero: numeroEdicao,
      valor_equipante: valorEquipante,
      valor_acampante: valorAcampante,
      updated_at: new Date()
    };

    let error;
    if (existing?.id) {
      ({ error } = await supabase.from('configuracoes').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('configuracoes').insert(payload));
    }

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Erro ao salvar valores:", error);
    return { success: false, error: error.message };
  }
};

export const validarValor = (valorCentavos) => {
  return valorCentavos >= 1000 && valorCentavos <= 1000000; // Between R$ 10.00 and R$ 10,000.00
};