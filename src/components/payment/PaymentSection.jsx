import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const PaymentSection = () => {
  return (
    <Card>
      <CardContent className="p-6 text-center text-gray-400">
        Por favor, selecione PIX ou Pagamento Manual na tela de seleção.
      </CardContent>
    </Card>
  );
};

export default PaymentSection;