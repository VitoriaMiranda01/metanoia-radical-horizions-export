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
    // Nota: acampantes/equipantes não têm coluna updated_at (só a tabela
    // pagamentos, usada acima, tem de verdade) — incluí-la aqui fazia esse
    // update falhar sempre, deixando o pagamento registrado mas o status do
    // acampante/equipante nunca virava 'completed'/'isento'.
    //
    // status_pagamento/metodo_pagamento existem nas duas tabelas, mas
    // status (aprovação pastoral) só existe em equipantes -- acampante não
    // passa por essa etapa (mesmo motivo do bug corrigido em
    // acampanteForm.js). Mandar status pra acampantes quebrava esse update
    // inteiro com PGRST204, mesmo já tendo inserido o pagamento no passo 1.
    const table = inscriptionType === 'equipante' ? 'equipantes' : 'acampantes';
    const updates = {
      status_pagamento: 'completed',
      metodo_pagamento: 'isento'
    };
    if (inscriptionType === 'equipante') {
      updates.status = 'completed';
    }
    const { error: updateError } = await supabase
      .from(table)
      .update(updates)
      .eq('id', inscriptionId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error finalizing zero value payment:', error);
    return { success: false, error: error.message };
  }
};

export const fetchAcampantesPendentesPagamento = async () => {
  // So busca o que a tela realmente usa (Nome, CPF, Tipo, status do
  // pagamento) -- metodo_pagamento so entra no filtro (.in), nao precisa
  // estar no select pra isso funcionar.
  return supabase
    .from('acampantes')
    .select('id, nome, cpf, status_pagamento')
    .in('metodo_pagamento', ['manual', 'isento']);
};

export const fetchEquipantesPendentesPagamento = async () => {
  // Mesma coisa do lado de equipante -- so o que a tela usa.
  return supabase
    .from('equipantes')
    .select('id, nome, cpf, status_pagamento')
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
