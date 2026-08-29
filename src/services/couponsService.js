import { supabase } from '@/services/supabaseClient';

export const fetchCoupons = async () => {
  return supabase.from('cupons').select('*').order('created_at', { ascending: false });
};

export const createCoupon = async ({ codigo, desconto_fixo, ativo }) => {
  return supabase.from('cupons').insert([{ codigo, desconto_fixo, ativo }]);
};

export const toggleCouponStatus = async (id, novoStatus) => {
  return supabase.from('cupons').update({ ativo: novoStatus }).eq('id', id);
};

export const deleteCoupon = async (id) => {
  return supabase.from('cupons').delete().eq('id', id);
};

export const findActiveCouponByCode = async (code) => {
  return supabase
    .from('cupons')
    .select('*')
    .eq('codigo', code)
    .eq('ativo', true)
    .single();
};
