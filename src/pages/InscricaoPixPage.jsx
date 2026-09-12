import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Loader2, Copy, QrCode, CheckCircle2, AlertCircle, ArrowLeft, Tag } from 'lucide-react';
import { gerarPixSicoob } from '@/services/sicoobService';
import { QRCodeSVG } from 'qrcode.react';
import { validateCPF } from '@/utils/validation';
import { formatCPF } from '@/utils/formatters';
import { useCurrentPrice } from '@/hooks/useCurrentPrice';
import { useCouponValidation } from '@/hooks/useCouponValidation';
import { finalizeZeroValuePayment } from '@/services/paymentService';
import { updateEquipantePaymentStatus, updateAcampantePaymentStatus } from '@/services/inscricoesService';
import { consultarStatusPix } from '@/services/publicDataService';
import { rotuloValor, rotuloValorEmFrase } from '@/utils/rotulosPagamento';

const formatCurrency = value => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const InscricaoPixPage = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isFinalizingZero, setIsFinalizingZero] = useState(false);

  const tipo = location.state?.tipo || 'acampante';
  const edicao_numero = location.state?.numero_edicao || location.state?.edicao_numero;
  const inscricaoId = location.state?.id;

  // Fetch dynamic inscription value from database based on type
  const { currentPrice: inscriptionValue, loading: loadingValue, error: valueError } = useCurrentPrice(tipo, edicao_numero);
  
  const [formData, setFormData] = useState({
    nome: location.state?.nome || '',
    cpf: location.state?.cpf ? formatCPF(location.state.cpf) : ''
  });
  const [pixData, setPixData] = useState(null);
  const [error, setError] = useState(null);
  // 'aguardando' | 'confirmado' | 'divergente' | 'expirado'
  const [statusPagamento, setStatusPagamento] = useState('aguardando');

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [couponMessage, setCouponMessage] = useState({ type: '', text: '' });
  const { validateCoupon, loading: validatingCoupon } = useCouponValidation();

  // Fica perguntando ao servidor se o pagamento caiu.
  //
  // Antes, esta tela nao tinha nenhuma confirmacao: gerava o QR Code e ficava
  // parada para sempre. A pessoa pagava, nada mudava, e ela nao tinha como
  // saber se deu certo -- so restava entrar em contato com a organizacao.
  //
  // Quem confirma de verdade e o webhook do Sicoob; aqui so consultamos o
  // resultado. Pergunta a cada 5 segundos e para assim que resolver.
  useEffect(() => {
    const txid = pixData?.txid;
    if (!txid || statusPagamento !== 'aguardando') return undefined;

    let ativo = true;

    const perguntar = async () => {
      try {
        const r = await consultarStatusPix(txid);
        if (!ativo || !r?.encontrado) return;

        if (r.pago || r.inscricao_liberada) {
          setStatusPagamento('confirmado');
          toast({
            title: 'Pagamento confirmado!',
            description: 'Sua inscrição está garantida.',
            className: 'bg-emerald-600 text-white'
          });
        } else if (r.status === 'divergente') {
          setStatusPagamento('divergente');
        } else if (r.expirado) {
          setStatusPagamento('expirado');
        }
      } catch (err) {
        // Falha de rede não deve derrubar a tela -- segue tentando.
        console.error('Erro ao consultar status do PIX:', err?.message || err);
      }
    };

    perguntar();
    const intervalo = setInterval(perguntar, 5000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [pixData?.txid, statusPagamento, toast]);

  // Show toast if there's an error loading the pricing configuration
  useEffect(() => {
    if (valueError) {
      toast({
        title: "Aviso",
        description: `Não foi possível carregar ${rotuloValorEmFrase(tipo)}. Usando valor padrão.`,
        variant: "default"
      });
    }
  }, [valueError, toast]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    if (name === 'cpf') {
      setFormData(prev => ({
        ...prev,
        [name]: formatCPF(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      toast({
        title: "Nome inválido",
        description: "Por favor, insira seu nome completo.",
        variant: "destructive"
      });
      return false;
    }
    if (formData.cpf.length !== 14 || !validateCPF(formData.cpf)) {
      toast({
        title: "CPF inválido",
        description: "Verifique os dígitos do CPF digitado.",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const finalValue = Math.max(0, (inscriptionValue || 0) - discountValue);
  const isZeroValue = finalValue <= 0;

  const handleApplyCoupon = async () => {
    if (!couponInput) return;
    setCouponMessage({ type: '', text: '' });
    
    const { isValid, discount, validationError } = await validateCoupon(couponInput);
    if (isValid) {
      setAppliedCoupon(couponInput.trim().toUpperCase());
      setDiscountValue(discount);
      setCouponMessage({ type: 'success', text: 'Cupom aplicado com sucesso!' });
      toast({
        title: "Cupom Aplicado",
        description: `Desconto aplicado com sucesso ${tipo === 'equipante' ? 'à taxa de alimentação' : 'ao valor da inscrição'}.`,
        className: "bg-emerald-600 text-white"
      });
    } else {
      setAppliedCoupon(null);
      setDiscountValue(0);
      setCouponMessage({ type: 'error', text: validationError || 'Cupom inválido ou expirado' });
      toast({
        title: "Erro ao aplicar cupom",
        description: validationError || 'Cupom inválido ou expirado',
        variant: "destructive"
      });
    }
  };

  const handleFinalizeZeroValue = async () => {
    if (!validateForm()) return;
    setIsFinalizingZero(true);
    
    const userId = location.state?.user_id;

    if (!inscricaoId) {
      toast({
        title: "Erro ao finalizar",
        description: "A inscrição não pôde ser identificada corretamente.",
        variant: "destructive"
      });
      setIsFinalizingZero(false);
      return;
    }

    const response = await finalizeZeroValuePayment(tipo, inscricaoId, appliedCoupon, userId,
      // Prova de dono: CPF, ou o nome de quem se inscreveu sem CPF.
      { cpf: location.state?.cpf, nome: location.state?.nome });
    
    if (response.success) {
      if (tipo === 'equipante') {
        await updateEquipantePaymentStatus(inscricaoId, 'confirmado');
      } else if (tipo === 'acampante') {
        await updateAcampantePaymentStatus(inscricaoId, 'confirmado');
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

  const handleSubmit = async e => {
    e.preventDefault();
    if (isZeroValue) {
      handleFinalizeZeroValue();
      return;
    }

    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const valorCentavos = Math.round(finalValue * 100);
      const descricao = `Inscrição Metanoia Radical - ${formData.nome}`;
      const data = await gerarPixSicoob(
        valorCentavos, 
        descricao, 
        formData.cpf.replace(/\D/g, ''), 
        tipo, 
        formData.nome, 
        inscricaoId, 
        appliedCoupon
      );
      
      const qrcode = data.qrcode;
      const pixCopiaECola = data.pixCopiaECola;
      
      if (pixCopiaECola) {
        setStatusPagamento('aguardando');
        // O identificador da cobranca vem como "sicoob_id" -- e ele que a
        // funcao status_pagamento_pix procura em pix_sicoob.sicoob_id.
        //
        // Aqui lia-se "data.txid", que a Edge Function nunca devolveu: o
        // valor ficava undefined, a consulta de status nem chegava a comecar
        // e a tela ficava parada para sempre, mesmo com o pagamento pago.
        // Era exatamente o sintoma relatado no teste de R$1.
        setPixData({ qrcode, pixCopiaECola, txid: data.sicoob_id ?? data.txid });
        toast({
          title: "PIX gerado com sucesso!",
          description: "Escaneie o QR Code ou copie o código para realizar o pagamento.",
          className: "bg-green-600 text-white"
        });
      } else {
        throw new Error('Dados do PIX incompletos retornados pelo servidor.');
      }
    } catch (err) {
      console.error("Erro ao gerar PIX:", err);
      const isOffline = err.message === 'Failed to fetch' || err.name === 'TypeError';
      const userMessage = isOffline ? 'Não foi possível conectar ao servidor de pagamentos. Verifique sua conexão ou tente novamente em alguns instantes.' : err.message;
      setError(userMessage);
      toast({
        title: "Erro ao gerar cobrança",
        description: userMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola);
      toast({
        title: "Copiado!",
        description: "Código PIX Copia e Cola copiado para a área de transferência.",
        className: "bg-emerald-600 text-white"
      });
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', cpf: '' });
    setPixData(null);
    setStatusPagamento('aguardando');
    setError(null);
    setAppliedCoupon(null);
    setDiscountValue(0);
    setCouponInput('');
    setCouponMessage({ type: '', text: '' });
  };

  return (
    <Layout>
      <Helmet>
        <title>Pagamento PIX - Metanoia Radical</title>
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
          <QrCode className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">PIX</h1>
          <p className="text-gray-400">Pague via QR Code ou Pix Copia e Cola.</p>
        </motion.div>

        {!pixData ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="glass-effect border-white/10 bg-black/60 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-xl border-b border-white/10 pb-4">
                  Dados para Cobrança
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-white p-4 rounded-md flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  {isZeroValue && !loadingValue && (
                    <div className="bg-emerald-500/20 border border-emerald-500/50 text-white p-4 rounded-md flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <p className="text-emerald-400 font-medium text-sm">
                        Sua inscrição é gratuita! O cupom aplicado cobre o valor total.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="nome" className="text-gray-300">Nome Completo</Label>
                    <Input 
                      id="nome" 
                      name="nome" 
                      placeholder="Ex: João da Silva" 
                      value={formData.nome} 
                      onChange={handleInputChange} 
                      disabled={loading || isFinalizingZero} 
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="text-gray-300">CPF</Label>
                    <Input 
                      id="cpf" 
                      name="cpf" 
                      placeholder="000.000.000-00" 
                      value={formData.cpf} 
                      onChange={handleInputChange} 
                      maxLength={14} 
                      disabled={loading || isFinalizingZero} 
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500" 
                    />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="coupon" className="text-gray-300 flex items-center gap-2"><Tag className="w-4 h-4" /> Cupom de Desconto</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="coupon" 
                          placeholder="Digite seu cupom" 
                          value={couponInput} 
                          onChange={e => setCouponInput(e.target.value.toUpperCase())} 
                          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 uppercase focus:border-emerald-500 focus:ring-emerald-500" 
                          disabled={appliedCoupon !== null || loading || isFinalizingZero} 
                        />
                        {appliedCoupon ? (
                          <Button 
                            type="button" 
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
                            type="button" 
                            onClick={handleApplyCoupon} 
                            disabled={!couponInput || validatingCoupon || loading || isFinalizingZero} 
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                          </Button>
                        )}
                      </div>
                      
                      {couponMessage.text && (
                        <p className={`text-sm font-medium ${couponMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {couponMessage.text}
                        </p>
                      )}
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-1">
                      <Label className="text-gray-400 text-sm">{rotuloValor(tipo)}</Label>
                      <div className="flex flex-col">
                        {discountValue > 0 && (
                          <span className="text-sm text-gray-500 line-through">
                            {loadingValue ? "..." : formatCurrency(inscriptionValue)}
                          </span>
                        )}
                        <span className="text-2xl font-bold text-emerald-400">
                          {loadingValue ? "Carregando..." : (isZeroValue ? "R$ 0,00" : formatCurrency(finalValue))}
                        </span>
                        {discountValue > 0 && (
                          <span className="text-emerald-500 text-sm font-medium mt-1">
                            Desconto: -{formatCurrency(discountValue)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isZeroValue && !loadingValue ? (
                    <Button 
                      type="button" 
                      onClick={handleFinalizeZeroValue}
                      disabled={isFinalizingZero} 
                      className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-300 shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_25px_rgba(5,150,105,0.5)] mt-4 flex items-center justify-center gap-2"
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
                      type="submit" 
                      disabled={loading || loadingValue} 
                      className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-300 shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_25px_rgba(5,150,105,0.5)] mt-4 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                          Gerando PIX...
                        </>
                      ) : "Gerar Pagamento PIX"}
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </motion.div>
        ) : statusPagamento === 'confirmado' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <Card className="glass-effect border-emerald-500/40 bg-black/60 shadow-[0_0_40px_rgba(5,150,105,0.25)] overflow-hidden">
              <CardContent className="p-10 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white">Pagamento confirmado!</h2>
                  <p className="text-gray-300">
                    Recebemos o seu PIX de <strong className="text-emerald-400">{formatCurrency(finalValue)}</strong>.
                  </p>
                  <p className="text-gray-400 text-sm">
                    Sua inscrição está garantida. Nos vemos no Metanoia! 🙌
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left space-y-1">
                  <p className="text-gray-400 text-sm">Inscrição de</p>
                  <p className="text-white font-medium">{formData.nome}</p>
                </div>

                <Button
                  onClick={() => navigate('/')}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Voltar para o início
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card className="glass-effect border-emerald-500/30 bg-black/60 shadow-[0_0_30px_rgba(5,150,105,0.15)] overflow-hidden">
              <div className="bg-emerald-600/20 p-4 border-b border-emerald-500/30 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">Cobrança Gerada</h2>
              </div>

              {statusPagamento === 'aguardando' && (
                <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  <p className="text-blue-300 text-sm font-medium">
                    Aguardando o pagamento — esta tela confirma sozinha
                  </p>
                </div>
              )}

              {statusPagamento === 'expirado' && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 text-center">
                  <p className="text-amber-300 text-sm font-medium">
                    Esta cobrança expirou. Se você já pagou, fale com a organização —
                    seu pagamento será localizado. Caso contrário, gere uma nova cobrança abaixo.
                  </p>
                </div>
              )}

              {statusPagamento === 'divergente' && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3 text-center">
                  <p className="text-amber-300 text-sm font-medium">
                    Recebemos um pagamento com valor diferente do cobrado. A organização vai
                    conferir e liberar sua inscrição — não é preciso pagar de novo.
                  </p>
                </div>
              )}

              <CardContent className="p-8 text-center space-y-8">
                <div className="space-y-2">
                  <p className="text-gray-300 text-sm uppercase tracking-wider font-semibold">
                    Valor a Pagar
                  </p>
                  <p className="text-4xl font-bold text-emerald-400">
                    {formatCurrency(finalValue)}
                  </p>
                  <p className="text-gray-400 text-sm">Titular: {formData.nome}</p>
                </div>

                <div className="flex flex-col items-center bg-white p-6 rounded-xl max-w-[280px] mx-auto shadow-inner">
                  {pixData.qrcode?.startsWith('data:') ? (
                    <img src={pixData.qrcode} alt="QR Code PIX" className="w-full h-auto object-contain" />
                  ) : (
                    <QRCodeSVG value={pixData.pixCopiaECola} size={220} />
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-gray-300 font-medium">
                    Ou utilize a opção Pix Copia e Cola:
                  </p>

                  <div className="flex flex-col gap-2 max-w-md mx-auto">
                    <textarea readOnly value={pixData.pixCopiaECola} rows={3} onClick={e => e.target.select()} className="w-full bg-black/50 border border-white/20 text-emerald-300 font-mono text-xs p-3 rounded-lg resize-none break-all" />
                    <Button onClick={handleCopyPix} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar código completo
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <Button variant="ghost" onClick={resetForm} className="text-gray-400 hover:text-white hover:bg-white/5">
                    Gerar nova cobrança
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default InscricaoPixPage;