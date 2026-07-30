import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, QrCode, Copy, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { gerarPixSicoob, consultarStatusPagamentoSicoob } from '@/lib/api/sicoobApi';
import { useCouponValidation } from '@/hooks/useCouponValidation';

const SicoobPaymentForm = ({ 
  inscriptionValue = 200.00,
  numeroEdicao, 
  tipo, 
  cpf, 
  nomePagador = 'Pagador', 
  inscricaoId, 
  onPaymentSuccess, 
  onPaymentError 
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [status, setStatus] = useState('idle');
  
  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [couponMessage, setCouponMessage] = useState({ type: '', text: '' });
  
  const { validateCoupon, loading: validatingCoupon } = useCouponValidation();
  const { toast } = useToast();

  const finalValue = Math.max(0, inscriptionValue - discountValue);
  const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalValue);
  const descontoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountValue);
  const valorCentavos = Math.round(finalValue * 100);

  useEffect(() => {
    let interval;
    if (status === 'processing' && paymentData?.id_transacao) {
      interval = setInterval(async () => {
        try {
          const result = await consultarStatusPagamentoSicoob(paymentData.id_transacao, 'pix');
          if (result.status === 'PAID') {
            handleSuccess(result.id_transacao);
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Erro ao verificar status Sicoob:", e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [status, paymentData]);

  const handleSuccess = (transactionId) => {
    setStatus('paid');
    toast({ title: "Pagamento Confirmado!", description: "Seu pagamento foi aprovado pelo Sicoob.", className: "bg-green-600 text-white" });
    if (onPaymentSuccess) {
      onPaymentSuccess({
        id: transactionId,
        method: 'pix',
        amount: valorCentavos,
        coupon_code: appliedCoupon
      });
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput) return;
    
    setCouponMessage({ type: '', text: '' });
    const { isValid, discount, error } = await validateCoupon(couponInput);
    
    if (isValid) {
      setAppliedCoupon(couponInput.trim().toUpperCase());
      setDiscountValue(discount);
      setCouponMessage({ type: 'success', text: 'Cupom aplicado com sucesso!' });
    } else {
      setAppliedCoupon(null);
      setDiscountValue(0);
      setCouponMessage({ type: 'error', text: error || 'Cupom inválido ou expirado' });
    }
  };

  const handleGeneratePix = async () => {
    setLoading(true);
    try {
      const descricao = `Inscrição Metanoia Radical - Edição ${numeroEdicao}`;
      const data = await gerarPixSicoob(valorCentavos, descricao, cpf, tipo, nomePagador, inscricaoId, appliedCoupon);
      setPaymentData(data);
      setStatus('processing');
    } catch (error) {
      toast({ title: "Erro ao gerar PIX", description: error.message, variant: "destructive" });
      if (onPaymentError) onPaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado com sucesso!" });
  };

  if (status === 'paid') {
    return (
      <Card className="bg-green-600/20 border-green-500/50">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Pagamento Confirmado!</h3>
          <p className="text-green-100">Transação Sicoob: {paymentData?.id_transacao || 'Confirmada'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-white flex justify-between items-center">
          Pagamento Sicoob
          <div className="flex flex-col items-end">
            {discountValue > 0 && (
              <span className="text-sm text-gray-400 line-through">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inscriptionValue)}
              </span>
            )}
            <span className="text-lg bg-emerald-600 px-3 py-1 rounded-full text-white text-sm">
              {valorFormatado}
            </span>
          </div>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Pagamentos processados via Sicoob PIX.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {!paymentData && (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
                <Label htmlFor="coupon" className="text-gray-300 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Cupom de Desconto (opcional)
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="coupon"
                    placeholder="Digite seu cupom" 
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="bg-black/50 border-white/10 text-white placeholder:text-gray-500 uppercase"
                    disabled={appliedCoupon !== null}
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
                      disabled={!couponInput || validatingCoupon}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                    </Button>
                  )}
                </div>
                
                {couponMessage.text && (
                  <p className={`text-sm ${couponMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {couponMessage.text}
                  </p>
                )}

                {discountValue > 0 && (
                  <p className="text-emerald-400 text-sm font-medium">
                    Desconto: -{descontoFormatado}
                  </p>
                )}
              </div>
            </div>
          )}

          {!paymentData ? (
            <div className="text-center py-4">
              <p className="text-gray-300 mb-4">Aprovação imediata via QR Code do Sicoob.</p>
              <Button onClick={handleGeneratePix} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 w-full md:w-auto text-white">
                {loading ? <Loader2 className="animate-spin mr-2" /> : "Gerar QR Code PIX"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6 animate-in fade-in">
              <div className="bg-white p-4 rounded-lg">
                {paymentData.qrcode?.startsWith('data:') ? (
                  <img src={paymentData.qrcode} alt="QR Code PIX" className="w-[200px] h-[200px] object-contain" />
                ) : (
                  <QRCodeSVG value={paymentData.pixCopiaECola || paymentData.qr_code} size={200} />
                )}
              </div>
              <div className="w-full space-y-2">
                <Label className="text-xs text-gray-400">Pix Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input readOnly value={paymentData.pixCopiaECola || paymentData.qr_code} className="bg-white/5 text-gray-300 border-white/10 font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(paymentData.pixCopiaECola || paymentData.qr_code)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-yellow-400 text-sm animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                Aguardando confirmação do Sicoob...
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SicoobPaymentForm;