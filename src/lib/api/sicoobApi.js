import { supabase } from '@/lib/supabase';

export const gerarPixSicoob = async (valor, descricao, cpf, tipoInscricao, nome_pagador = 'Pagador', inscricao_id = null, coupon_code = null) => {
  const { data, error } = await supabase.functions.invoke('sicoob-pix-create', {
    body: { valor, descricao, cpf, nome_pagador, minutos_expiracao: 30, inscricao_tipo: tipoInscricao, inscricao_id, coupon_code }
  });

  console.log('[sicoobApi] gerarPixSicoob raw response:', JSON.stringify(data));

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || "Erro ao gerar PIX");
  }

  return {
    qrcode: data.qrcode || data.qr_code_image || null,       
    pixCopiaECola: data.pixCopiaECola || data.pix_copia_cola || data.qr_code, 
    id_transacao: data.sicoob_id,
    txid: data.sicoob_id,
    coupon_code: coupon_code
  };
};

export const consultarStatusPagamentoSicoob = async (idTransacao, tipo) => {
  const functionName = 'sicoob-pix-consulta';
  
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { sicoob_id: idTransacao }
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || "Erro ao consultar status");
  }

  return {
    status: data.status === 'pago' ? 'PAID' : 'PENDING',
    id_transacao: idTransacao
  };
};