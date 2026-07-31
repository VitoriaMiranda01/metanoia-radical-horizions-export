import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { verificarCPF } from '@/lib/api/inscricaoApi';
import { useToast } from '@/components/ui/use-toast';
import { validateCPF, formatCPF as formatCPFUtil } from '@/lib/utils';
const VerificacaoCPF = ({
  onVerificationComplete,
  tipo,
  edicaoAtual
}) => {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    toast
  } = useToast();
  const handleChange = e => {
    setCpf(formatCPFUtil(e.target.value));
  };
  const handleVerify = async e => {
    e.preventDefault();
    if (cpf.length < 14 || !validateCPF(cpf)) {
      toast({
        title: "CPF Inválido",
        description: "Por favor, digite um CPF válido.",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const result = await verificarCPF(cpf, tipo, edicaoAtual);
      if (onVerificationComplete) {
        onVerificationComplete({
          cpf,
          ...result
        });
      }
    } catch (error) {
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar seu CPF. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <Card className="max-w-md mx-auto glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="w-5 h-5" />
          Verificação de Inscrição
        </CardTitle>
        <CardDescription className="text-gray-400">
          Informe seu CPF para iniciar a inscrição ou verificar status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf-verify" className="text-white">CPF</Label>
            <Input id="cpf-verify" value={cpf} onChange={handleChange} placeholder="000.000.000-00" maxLength={14} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || cpf.length < 14}>
            {loading ? <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </> : 'Continuar'}
          </Button>

          <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-200 mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>Se você já se inscreveu nesta edição, verificaremos o status dela.</p>
          </div>
        </form>
      </CardContent>
    </Card>;
};
export default VerificacaoCPF;