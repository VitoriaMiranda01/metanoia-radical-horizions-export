import { supabase } from '@/services/supabaseClient';
import { validarCupomPublico } from '@/services/publicDataService';
import { comReenvio } from '@/services/serviceHelpers';

export const fetchCoupons = async () => comReenvio(
  () => supabase.from('cupons').select('*').order('created_at', { ascending: false }),
  { rotulo: 'cupons' }
);

export const createCoupon = async ({ codigo, desconto_fixo, ativo }) => {
  return supabase.from('cupons').insert([{ codigo, desconto_fixo, ativo }]);
};

export const toggleCouponStatus = async (id, novoStatus) => {
  return supabase.from('cupons').update({ ativo: novoStatus }).eq('id', id);
};

export const deleteCoupon = async (id) => {
  return supabase.from('cupons').delete().eq('id', id);
};

/**
 * Validacao de cupom para o visitante (nao logado).
 *
 * Antes isto fazia select('*') na tabela "cupons". Como a tabela e legivel
 * pela chave publica, dava pra LISTAR todos os cupons e usar o de maior
 * desconto -- e foi assim que se descobriu que existiam cupons de isencao
 * total com nome adivinhavel. Agora quem responde e o servidor, e so sobre o
 * codigo perguntado.
 *
 * O retorno mantem o formato { data, error } que a tela ja esperava.
 */
export const findActiveCouponByCode = async (code) => {
  try {
    const resultado = await validarCupomPublico(code);

    if (!resultado?.valido) {
      return { data: null, error: null };
    }

    return { data: { codigo: code, desconto_fixo: resultado.desconto }, error: null };
  } catch (error) {
    console.error('couponsService - findActiveCouponByCode', error?.message || error);
    return { data: null, error };
  }
};
