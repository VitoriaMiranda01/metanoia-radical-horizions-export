import { useState } from 'react';
import { findActiveCouponByCode } from '@/services/couponsService';

export const useCouponValidation = () => {
  const [loading, setLoading] = useState(false);

  const validateCoupon = async (code) => {
    if (!code || !code.trim()) {
      return { isValid: false, discount: 0, error: 'Por favor, insira um código de cupom.' };
    }

    setLoading(true);
    try {
      const { data, error } = await findActiveCouponByCode(code.trim().toUpperCase());

      if (error || !data) {
        return { isValid: false, discount: 0, error: 'Cupom inválido ou expirado' };
      }

      return { 
        isValid: true, 
        discount: Number(data.desconto_fixo), 
        error: null 
      };
    } catch (err) {
      console.error('Erro ao validar cupom:', err);
      return { isValid: false, discount: 0, error: 'Erro ao validar cupom. Tente novamente.' };
    } finally {
      setLoading(false);
    }
  };

  return { validateCoupon, loading };
};