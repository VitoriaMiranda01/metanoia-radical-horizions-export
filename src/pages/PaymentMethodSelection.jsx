
import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { QrCode, CreditCard, ArrowRight, Zap } from 'lucide-react';
import { atualizarStatusPagamento } from '@/lib/api/inscricaoApi';

const PaymentMethodSelection = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // If accessed directly without state, redirect to home
  if (!location.state) {
    return <Navigate to="/" replace />;
  }

  const handleSelect = async (path, method) => {
    // Update the method in database before proceeding
    if (location.state?.id && location.state?.tipo) {
      try {
        await atualizarStatusPagamento(
          location.state.id, 
          location.state.tipo, 
          'pendente', 
          method, 
          null
        );
      } catch (error) {
        console.error("Failed to update payment method:", error);
      }
    }

    navigate(path, {
      state: { ...location.state, metodo_pagamento: method }
    });
  };

  return (
    <Layout>
      <Helmet>
        <title>Forma de Pagamento - Metanoia Radical</title>
      </Helmet>

      <div className="max-w-4xl mx-auto py-12 px-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold text-white mb-4">Forma de Pagamento</h1>
          <p className="text-gray-400 text-lg">Escolha como deseja realizar o pagamento da sua inscrição.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PIX Option */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-effect border-emerald-500/30 bg-black/60 h-full hover:bg-black/80 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                < Zap className="w-3 h-3" /> Recomendado
              </div>
              <CardContent className="p-8 flex flex-col h-full">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                  <QrCode className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">PIX</h3>
                <p className="text-gray-400 mb-8 flex-grow">
                  Pagamento instantâneo. Sua inscrição será confirmada na mesma hora. Rápido, fácil e seguro.
                </p>
                <Button 
                  onClick={() => handleSelect('/inscricao-pix', 'pix')} 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg font-semibold"
                >
                  Pagar com PIX
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Manual Option */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-effect border-white/10 bg-black/60 h-full hover:bg-black/80 transition-all duration-300 group">
              <CardContent className="p-8 flex flex-col h-full">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform duration-300">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Cartão / Dinheiro</h3>
                <p className="text-gray-400 mb-8 flex-grow">
                  Pagamento manual com a equipe da secretaria. Aceitamos Cartão de Crédito, Débito e Dinheiro em espécie.
                </p>
                <Button 
                  onClick={() => handleSelect('/manual-payment', 'manual')} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-semibold"
                >
                  Pagamento Manual
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentMethodSelection;
