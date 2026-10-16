import { supabase } from '@/services/supabaseClient';
import { validarCupomInscricao } from '@/services/publicDataService';
import { comReenvio } from '@/services/serviceHelpers';

export const fetchCoupons = async () => comReenvio(
  () => supabase.from('cupons').select('*').order('created_at', { ascending: false }),
  { rotulo: 'cupons' }
);

// Cupom de valor fixo (desconto_fixo em R$) OU de porcentagem (percentual, 1 a 99,
// com desconto_fixo = 0). so_pastor: so vale para quem esta registrado como pastor.
export const createCoupon = async ({ codigo, desconto_fixo = 0, percentual = null, so_pastor = false, ativo }) => {
  return supabase.from('cupons').insert([{ codigo, desconto_fixo, percentual, so_pastor, ativo }]);
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
export const findActiveCouponByCode = async (code, dono = {}) => {
  try {
    const resultado = await validarCupomInscricao({
      tipo: dono.tipo, id: dono.id, codigo: code,
      cpf: dono.cpf || null, nome: dono.nome || null, nascimento: dono.nascimento || null
    });

    if (!resultado?.valido) {
      return { data: null, error: null, motivo: resultado?.motivo || 'inexistente' };
    }

    return { data: { codigo: code, desconto_fixo: resultado.desconto, percentual: resultado.percentual ?? null }, error: null };
  } catch (error) {
    console.error('couponsService - findActiveCouponByCode', error?.message || error);
    return { data: null, error };
  }
};
