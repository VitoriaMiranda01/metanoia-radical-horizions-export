import { supabase } from '@/services/supabaseClient';

export const gerarPixSicoob = async (valor, descricao, cpf, tipoInscricao, nome_pagador = 'Pagador', inscricao_id = null, coupon_code = null) => {
  try {
    const { data, error } = await supabase.functions.invoke('sicoob-pix-create', {
      body: { valor, descricao, cpf, nome_pagador, minutos_expiracao: 30, inscricao_tipo: tipoInscricao, inscricao_id, coupon_code }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Erro ao gerar PIX Sicoob");
    }

    return {
      qrcode: data.qrcode || data.qr_code_image || null,       
      pixCopiaECola: data.pixCopiaECola || data.pix_copia_cola || data.qr_code, 
      id_transacao: data.sicoob_id,
      txid: data.sicoob_id,
      coupon_code: coupon_code
    };
  } catch (err) {
    console.error('sicoobApi - gerarPixSicoob', err, { cpf, tipoInscricao, inscricao_id });
    throw new Error(err.message || 'Falha de conexão com gateway Sicoob. Tente novamente.');
  }
};

export const consultarStatusPagamentoSicoob = async (idTransacao, tipo) => {
  try {
    if (!idTransacao) throw new Error('ID de Transação inválido ou ausente');
    
    const functionName = 'sicoob-pix-consulta';
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { sicoob_id: idTransacao }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Erro ao consultar status PIX Sicoob");
    }

    return {
      status: data.status === 'pago' ? 'PAID' : 'PENDING',
      id_transacao: idTransacao
    };
  } catch (err) {
    console.error('sicoobApi - consultarStatusPagamentoSicoob', err, { idTransacao });
    throw new Error(err.message || 'Falha de conexão ao consultar gateway.');
  }
};