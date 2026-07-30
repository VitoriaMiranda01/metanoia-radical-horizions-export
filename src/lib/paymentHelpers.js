import { supabase } from '@/lib/supabase';

/**
 * Database Schema Reference (SQL):
 * 
 * create table payment_info (
 *   id uuid default uuid_generate_v4() primary key,
 *   user_id uuid references auth.users(id), -- optional, if user is logged in
 *   inscription_id uuid, -- reference to acampante or equipante id
 *   payment_method text not null, -- 'PIX', 'BOLETO', 'CREDIT_CARD'
 *   amount decimal(10,2) not null,
 *   status text not null, -- 'PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'
 *   transaction_id text, -- ID returned from SICOOB
 *   pix_copy_paste text,
 *   boleto_barcode text,
 *   boleto_url text,
 *   coupon_code text,
 *   created_at timestamp with time zone default now(),
 *   updated_at timestamp with time zone default now(),
 *   confirmed_at timestamp with time zone
 * );
 */

export const savePaymentInfo = async (paymentData) => {
  try {
    const { data, error } = await supabase
      .from('payment_info')
      .insert([{
        ...paymentData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
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
      updated_at: new Date().toISOString(),
      ...extraData
    };
    
    if (status === 'CONFIRMED') {
      updates.confirmed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('payment_info')
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
      .from('payment_info')
      .select('status, transaction_id, confirmed_at, coupon_code')
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

    // 1. Insert completed payment record
    const { error: paymentError } = await supabase
      .from('payment_info')
      .insert([{
        user_id: userId,
        inscription_id: inscriptionId,
        payment_method: 'CUPOM_INTEGRAL',
        amount: 0,
        status: 'completed',
        coupon_code: couponCode,
        confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (paymentError) throw paymentError;

    // 2. Update inscription table
    const table = inscriptionType === 'equipante' ? 'equipantes' : 'acampantes';
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status: 'completed',
        status_pagamento: 'completed',
        metodo_pagamento: 'CUPOM_INTEGRAL',
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