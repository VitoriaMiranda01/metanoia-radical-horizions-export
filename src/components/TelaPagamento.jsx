import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

// Componente depreciado. Utilizar TelaPagamentoStripe.jsx
const TelaPagamento = () => {
  return (
    <Card className="bg-red-900/20 border-red-500/50">
      <CardContent className="p-6 text-center text-red-200">
        Componente de pagamento antigo desativado. Por favor, utilize a nova integração.
      </CardContent>
    </Card>
  );
};

export default TelaPagamento;