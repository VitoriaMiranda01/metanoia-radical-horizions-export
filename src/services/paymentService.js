import { supabase } from '@/services/supabaseClient';

export const savePaymentInfo = async (paymentData) => {
  try {
    const payload = {
      valor: paymentData.amount || paymentData.valor || 0,
      status: paymentData.status || 'pendente',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (paymentData.equipante_id) {
      payload.equipante_id = paymentData.equipante_id;
    }
    if (paymentData.acampante_id) {
      payload.acampante_id = paymentData.acampante_id;
    }
    
    // Fallback if data was constructed with generic inscription_id
    if (paymentData.inscription_id) {
      if (paymentData.inscription_type === 'equipante') {
        payload.equipante_id = paymentData.inscription_id;
      } else {
        payload.acampante_id = paymentData.inscription_id;
      }
    }

    if (payload.status === 'CONFIRMED' || payload.status === 'completed' || payload.status === 'pago') {
      payload.data_pagamento = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('pagamentos')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving payment info:', error);
    return { success: false, error: error.message };
  }
};

export const updatePaymentStatus = async (paymentId, status, extraData = {}) => {
  try {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'CONFIRMED' || status === 'completed' || status === 'pago') {
      updates.data_pagamento = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('pagamentos')
      .update(updates)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating payment status:', error);
    return { success: false, error: error.message };
  }
};

export const getPaymentStatus = async (paymentId) => {
  try {
    const { data, error } = await supabase
      .from('pagamentos')
      .select('status, data_pagamento')
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Handles 100% discount situations where the final value is zero.
 */
export const finalizeZeroValuePayment = async (inscriptionType, inscriptionId, couponCode, userId = null) => {
  try {
    if (!inscriptionId) {
      throw new Error("ID da inscrição não encontrado para finalizar o pagamento.");
    }

    const payload = {
      valor: 0,
      status: 'completed',
      data_pagamento: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (inscriptionType === 'equipante') {
      payload.equipante_id = inscriptionId;
    } else {
      payload.acampante_id = inscriptionId;
    }

    // 1. Insert completed payment record into pagamentos table
    const { error: paymentError } = await supabase
      .from('pagamentos')
      .insert([payload]);

    if (paymentError) throw paymentError;

    // 2. Update inscription table
    const table = inscriptionType === 'equipante' ? 'equipantes' : 'acampantes';
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status: 'completed',
        status_pagamento: 'completed',
        metodo_pagamento: 'isento',
        updated_at: new Date().toISOString()
      })
      .eq('id', inscriptionId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error finalizing zero value payment:', error);
    return { success: false, error: error.message };
  }
};

export const fetchAcampantesPendentesPagamento = async () => {
  return supabase
    .from('acampantes')
    .select('id, nome, cpf, status_pagamento, metodo_pagamento, status, telefone, cidade, igreja')
    .in('metodo_pagamento', ['manual', 'isento']);
};

export const fetchEquipantesPendentesPagamento = async () => {
  return supabase
    .from('equipantes')
    .select('id, nome, cpf, status_pagamento, metodo_pagamento, status, telefone, whatsapp, cidade, igreja')
    .in('metodo_pagamento', ['manual', 'isento']);
};

export const confirmarPagamentoManual = async (tipo, id) => {
  const table = tipo === 'acampante' ? 'acampantes' : 'equipantes';
  return supabase
    .from(table)
    .update({
      status_pagamento: 'confirmado',
      data_pagamento: new Date().toISOString()
    })
    .eq('id', id);
};
