import { useState } from 'react';
import { findActiveCouponByCode } from '@/services/couponsService';

export const useCouponValidation = () => {
  const [loading, setLoading] = useState(false);

  // dono: { tipo, id, cpf, nome, nascimento } -- o cupom vale conforme quem e a
  // pessoa (porcentagem e o cupom "so para pastores", 16/10/2026).
  const validateCoupon = async (code, dono = {}) => {
    if (!code || !code.trim()) {
      return { isValid: false, discount: 0, error: 'Por favor, insira um código de cupom.' };
    }

    setLoading(true);
    try {
      const { data, error, motivo } = await findActiveCouponByCode(code.trim().toUpperCase(), dono);

      if (error || !data) {
        const mensagem = motivo === 'so_pastor'
          ? 'Este cupom é exclusivo para pastores registrados como pastor no sistema. O cadastro desta inscrição não está como pastor.'
          : motivo === 'identidade'
            ? 'Não foi possível confirmar a sua inscrição para usar o cupom. Volte e entre novamente com o seu CPF.'
            : 'Cupom inválido ou expirado';
        return { isValid: false, discount: 0, error: mensagem };
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