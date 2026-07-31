import React from 'react';
import FormSection from './FormSection';
import PaymentSection from '@/components/payment/PaymentSection';

const Pagamento = ({ formData, handleChange, onPaymentSuccess }) => {
  const fixedAmount = import.meta.env.VITE_FIXED_PAYMENT_AMOUNT || "150.00";

  return (
    <FormSection title="Pagamento da Inscrição">
      <div className="space-y-6">
        <PaymentSection 
          fixedAmount={fixedAmount} 
          onPaymentConfirmed={(result) => {
            // Callback to parent to unlock submit
            if (onPaymentSuccess) onPaymentSuccess(result);
            
            // Also update form data for legacy support if needed
            handleChange({
              target: { name: 'paymentStatus', value: 'CONFIRMED' }
            });
            handleChange({
               target: { name: 'formaPagamento', value: 'SICOOB_INTEGRATION' }
            });
          }}
        />
      </div>
    </FormSection>
  );
};

export default Pagamento;