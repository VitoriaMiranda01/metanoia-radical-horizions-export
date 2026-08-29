import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { CreditCard, CheckCircle2, Info, ArrowLeft, ExternalLink, Tag, Loader2, AlertTriangle } from 'lucide-react';
import { useCurrentPrice } from '@/hooks/useCurrentPrice';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { finalizeZeroValuePayment } from '@/services/paymentService';
import { updateEquipantePaymentStatus, updateAcampantePaymentStatus } from '@/services/inscricoesService';

const formatCurrency = value => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const ManualPaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const nome = location.state?.nome || 'Participante';
  const tipo = location.state?.tipo || 'acampante';
  const edicao_numero = location.state?.numero_edicao || location.state?.edicao_numero;

  const { currentPrice: baseInscriptionValue, loading: loadingValue, error: priceError } = useCurrentPrice(tipo, edicao_numero);
  const [isFinalizingZero, setIsFinalizingZero] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [couponMessage, setCouponMessage] = useState({ type: '', text: '' });
  const { validateCoupon, loading: validatingCoupon } = useCouponValidation();
  
  // If accessed directly without state, redirect to home
  if (!location.state) {
    return <Navigate to="/" replace />;
  }

  const finalValue = Math.max(0, (baseInscriptionValue || 0) - discountValue);
  const isZeroValue = finalValue <= 0;

  const handleApplyCoupon = async () => {
    if (!couponInput) return;
    setCouponMessage({ type: '', text: '' });
    
    const { isValid, discount, error } = await validateCoupon(couponInput);
    if (isValid) {
      setAppliedCoupon(couponInput.trim().toUpperCase());
      setDiscountValue(discount);
      setCouponMessage({ type: 'success', text: 'Cupom aplicado com sucesso!' });
      toast({
        title: "Cupom Aplicado",
        description: "Desconto aplicado com sucesso.",
        className: "bg-emerald-600 text-white"
      });
    } else {
      setAppliedCoupon(null);
      setDiscountValue(0);
      setCouponMessage({ type: 'error', text: error || 'Cupom inválido ou expirado' });
    }
  };

  const handleFinalizeZeroValue = async () => {
    setIsFinalizingZero(true);
    
    const inscriptionId = location.state?.id;
    const userId = location.state?.user_id;

    if (!inscriptionId) {
      toast({
        title: "Erro ao finalizar",
        description: "A inscrição não pôde ser identificada corretamente.",
        variant: "destructive"
      });
      setIsFinalizingZero(false);
      return;
    }

    const response = await finalizeZeroValuePayment(tipo, inscriptionId, appliedCoupon, userId);
    
    if (response.success) {
      if (tipo === 'equipante') {
        await updateEquipantePaymentStatus(inscriptionId, 'confirmado');
      } else if (tipo === 'acampante') {
        await updateAcampantePaymentStatus(inscriptionId, 'confirmado');
      }
      
      toast({
        title: "Inscrição finalizada com sucesso!",
        description: "Sua inscrição gratuita foi confirmada.",
        className: "bg-emerald-600 text-white"
      });
      navigate('/');
    } else {
      toast({
        title: "Erro ao finalizar",
        description: response.error || "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    }
    setIsFinalizingZero(false);
  };

  const handleFinish = () => {
    navigate('/');
  };

  return (
    <Layout>
      <Helmet>
        <title>Pagamento Manual - Metanoia Radical</title>
      </Helmet>

      <div className="max-w-2xl mx-auto py-12 px-4 relative">
        <motion.button 
          initial={{ opacity: 0, x: -10 }} 
          animate={{ opacity: 1, x: 0 }} 
          onClick={() => navigate('/payment-method-selection', { state: location.state })} 
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group" 
          aria-label="Voltar para seleção de pagamento"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Voltar</span>
        </motion.button>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <CreditCard className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Pagamento Manual</h1>
          <p className="text-gray-400">Cartão de Crédito, Débito ou Dinheiro</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="glass-effect border-blue-500/30 bg-black/60 shadow-[0_0_30px_rgba(59,130,246,0.15)] overflow-hidden">
            <div className="bg-blue-600/20 p-4 border-b border-blue-500/30 flex items-center justify-center gap-2">
              <Info className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Instruções de Pagamento</h2>
            </div>

            <CardContent className="p-8 text-center space-y-8">
              
              {priceError && (
                <div className="bg-red-500/20 border border-red-500/50 text-white p-4 rounded-md flex items-center justify-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                  <p className="text-red-400 font-medium text-sm text-left">
                    Não foi possível carregar o valor da inscrição. Entre em contato com a organização.
                  </p>
                </div>
              )}

              {isZeroValue && !priceError && !loadingValue && (
                <div className="bg-emerald-500/20 border border-emerald-500/50 text-white p-4 rounded-md flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <p className="text-emerald-400 font-medium">
                    Sua inscrição é gratuita! O cupom aplicado cobre o valor total.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-gray-300 text-sm uppercase tracking-wider font-semibold">
                  Valor da Inscrição
                </p>
                {discountValue > 0 && (
                  <p className="text-lg text-gray-400 line-through">
                    {loadingValue ? "..." : formatCurrency(baseInscriptionValue)}
                  </p>
                )}
                <p className="text-4xl font-bold text-blue-400">
                  {loadingValue ? "Carregando..." : (isZeroValue ? "R$ 0,00" : formatCurrency(finalValue))}
                </p>
                <p className="text-gray-400 text-sm">Titular: {nome}</p>
              </div>

              {/* Coupon Section */}
              <div className="bg-white/5 p-5 rounded-xl border border-white/10 text-left space-y-4 max-w-sm mx-auto">
                <Label htmlFor="coupon" className="text-gray-300 flex items-center gap-2"><Tag className="w-4 h-4" /> Cupom de Desconto</Label>
                <div className="flex gap-2">
                  <Input 
                    id="coupon" 
                    placeholder="Digite seu cupom" 
                    value={couponInput} 
                    onChange={e => setCouponInput(e.target.value.toUpperCase())} 
                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-500 uppercase" 
                    disabled={appliedCoupon !== null || isFinalizingZero || loadingValue} 
                  />
                  {appliedCoupon ? (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setAppliedCoupon(null);
                        setDiscountValue(0);
                        setCouponInput('');
                        setCouponMessage({ type: '', text: '' });
                      }} 
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Remover
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleApplyCoupon} 
                      disabled={!couponInput || validatingCoupon || isFinalizingZero || loadingValue} 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                    </Button>
                  )}
                </div>
                
                {couponMessage.text && (
                  <p className={`text-sm font-medium ${couponMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {couponMessage.text}
                  </p>
                )}

                {discountValue > 0 && (
                  <p className="text-emerald-400 text-sm font-medium">
                    Desconto: -{formatCurrency(discountValue)}
                  </p>
                )}
              </div>

              {!isZeroValue && !loadingValue && !priceError && (
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 text-left space-y-4">
                  <p className="text-white text-lg">
                    Sua inscrição foi pré-aprovada, mas o pagamento precisa ser realizado <strong>presencialmente</strong> ou tratado via <strong>WhatsApp</strong>.
                  </p>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <span>Envie uma mensagem para a Raquel através do link:</span>
                        <a href="https://wa.me/5521976225702" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 transition-colors font-medium">
                          Falar com Raquel no WhatsApp <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Ou procure a equipe da secretaria na reunião de escalas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <span>Informe seu nome e CPF para que sua ficha seja localizada.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <span>O pagamento pode ser feito em Cartão (Crédito/Débito) ou Dinheiro.</span>
                    </li>
                  </ul>
                </div>
              )}

              <div className="pt-6 border-t border-white/10 space-y-4">
                {!isZeroValue && !loadingValue && !priceError && (
                  <p className="text-sm text-yellow-400 font-medium">
                    Sua vaga só estará garantida após a confirmação do pagamento pela equipe.
                  </p>
                )}
                
                {isZeroValue && !priceError && !loadingValue ? (
                  <Button 
                    onClick={handleFinalizeZeroValue} 
                    disabled={isFinalizingZero}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-lg font-semibold shadow-[0_0_15px_rgba(5,150,105,0.3)] flex items-center justify-center gap-2"
                  >
                    {isFinalizingZero ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        Finalizando...
                      </>
                    ) : "Finalizar inscrição"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleFinish} 
                    disabled={loadingValue || priceError !== null}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-semibold shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2"
                  >
                    <span>{loadingValue ? "Carregando..." : "Entendido"}</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ManualPaymentPage;