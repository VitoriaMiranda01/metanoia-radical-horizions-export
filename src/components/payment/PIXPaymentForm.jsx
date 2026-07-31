import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, CheckCircle, Clock, QrCode, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { consultarStatusPagamentoSicoob, gerarPixSicoob } from '@/lib/api/sicoobApi';
import { QRCodeSVG } from 'qrcode.react';

const PIXPaymentForm = ({ 
  paymentData: initialPaymentData, 
  onPaymentConfirmed,
  inscriptionValue = 200.00,
  cpf,
  nomePagador = 'Pagador',
  tipoInscricao = 'acampante',
  inscricaoId
}) => {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
  const [isChecking, setIsChecking] = useState(false);
  const [paymentData, setPaymentData] = useState(initialPaymentData);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-generate PIX if no payment data is provided
  useEffect(() => {
    const generatePix = async () => {
      if (!initialPaymentData && inscriptionValue && cpf && !paymentData && !isGenerating) {
        setIsGenerating(true);
        try {
          const valorCentavos = Math.round(inscriptionValue * 100);
          const descricao = `Inscrição Metanoia Radical - ${nomePagador}`;
          const data = await gerarPixSicoob(valorCentavos, descricao, cpf.replace(/\D/g, ''), tipoInscricao, nomePagador, inscricaoId);
          setPaymentData(data);
        } catch (error) {
          console.error('[PIXPaymentForm] Error auto-generating PIX:', error);
          toast({
            title: "Erro ao gerar PIX",
            description: error.message,
            variant: "destructive"
          });
        } finally {
          setIsGenerating(false);
        }
      }
    };

    generatePix();
  }, [initialPaymentData, inscriptionValue, cpf, nomePagador, tipoInscricao, inscricaoId, paymentData, isGenerating, toast]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    // Poll for status every 10 seconds using the new Sicoob API utility
    const statusPoller = setInterval(async () => {
      if (paymentData?.transactionId || paymentData?.id_transacao) {
        await handleCheckStatus();
      }
    }, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(statusPoller);
    };
  }, [paymentData]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyKey = () => {
    const key = paymentData?.pixCopiaECola || paymentData?.copyPasteKey;
    if (key) {
      navigator.clipboard.writeText(key);
      toast({
        title: "Copiado!",
        description: "Código PIX Copia e Cola copiado com sucesso.",
        className: "bg-emerald-600 text-white"
      });
    }
  };

  const handleCheckStatus = async () => {
    const txId = paymentData?.id_transacao || paymentData?.transactionId;
    if (isChecking || !txId) return;
    
    setIsChecking(true);
    try {
      const result = await consultarStatusPagamentoSicoob(txId, 'pix');
      if (result.status === 'PAID') {
        onPaymentConfirmed(result);
        toast({
          title: "Pagamento Confirmado!",
          description: "Recebemos seu pagamento com sucesso.",
          className: "bg-green-600 text-white"
        });
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // Manual confirmation for testing/demo (Mock Mode)
  const handleManualConfirm = () => {
    const txId = paymentData?.id_transacao || paymentData?.transactionId;
    onPaymentConfirmed({ status: 'PAID', id_transacao: txId });
    toast({
      title: "Pagamento Confirmado (Simulado)",
      description: "Confirmação manual para ambiente de desenvolvimento.",
      className: "bg-blue-600 text-white"
    });
  };

  const qrcodeSrc = paymentData?.qrcode || paymentData?.qr_code;
  const pixCode = paymentData?.pixCopiaECola || paymentData?.copyPasteKey;

  // Show loading state while generating PIX
  if (isGenerating) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center space-y-2">
          <Loader2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-bold text-white">Gerando cobrança PIX...</h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            Aguarde enquanto preparamos seu pagamento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <QrCode className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-white">Pagamento Instantâneo</h3>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          Abra o aplicativo do seu banco e escaneie o código abaixo para concluir sua inscrição.
        </p>
      </div>

      <Card className="bg-white p-4 max-w-[240px] mx-auto shadow-2xl border-none">
        <CardContent className="p-0 flex items-center justify-center relative overflow-hidden aspect-square">
          {qrcodeSrc ? (
            <img 
              src={qrcodeSrc} 
              alt="QR Code PIX"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "";
                console.error("Falha ao carregar imagem do QR Code");
              }}
            />
          ) : pixCode ? (
            <QRCodeSVG value={pixCode} size={220} />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 text-center p-4">
              <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
              <p className="text-xs">QR Code não disponível</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="bg-white/5 p-4 rounded-xl border border-white/10 group hover:border-emerald-500/30 transition-colors">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pix Copia e Cola</label>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Seguro</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-black/40 p-3 rounded-lg border border-white/5 overflow-hidden">
              <code className="block text-xs text-emerald-300 font-mono truncate select-all">
                {pixCode || "Código não disponível"}
              </code>
            </div>
            <Button 
              size="icon" 
              variant="secondary" 
              onClick={handleCopyKey}
              className="h-auto px-4 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-lg"
              title="Copiar código"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
          <span className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4 text-emerald-500" /> Expira em:
          </span>
          <span className="font-mono text-white font-bold bg-black/40 px-3 py-1 rounded border border-white/10">
            {formatTime(timeLeft)}
          </span>
        </div>

        <div className="pt-2 space-y-3">
          <Button 
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            onClick={handleCheckStatus}
            disabled={isChecking || !qrcodeSrc}
          >
            {isChecking ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              "Já realizei o pagamento"
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full text-xs text-gray-500 hover:text-white hover:bg-white/5"
            onClick={handleManualConfirm}
          >
            Ambiente de Teste: Confirmar Manualmente
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PIXPaymentForm;