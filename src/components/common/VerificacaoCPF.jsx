import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { verificarCPF, verificarNome } from '@/services/inscricoesService';
import { useToast } from '@/components/ui/use-toast';
import { validateCPF } from '@/utils/validation';
import { formatCPF as formatCPFUtil } from '@/utils/formatters';
const VerificacaoCPF = ({
  onVerificationComplete,
  tipo,
}) => {
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [useNameSearch, setUseNameSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    toast
  } = useToast();
  const handleCpfChange = e => {
    setCpf(formatCPFUtil(e.target.value));
  };
  const handleNomeChange = e => {
    setNome(e.target.value);
  };
  const handleVerify = async e => {
    e.preventDefault();
    if (useNameSearch) {
      if (nome.trim().length < 3) {
        toast({
          title: "Nome muito curto",
          description: "Por favor, digite um nome válido para buscar.",
          variant: "destructive"
        });
        return;
      }
    } else {
      if (cpf.length < 14 || !validateCPF(cpf)) {
        toast({
          title: "CPF Inválido",
          description: "Por favor, digite um CPF válido.",
          variant: "destructive"
        });
        return;
      }
    }
    setLoading(true);
    try {
      let result;
      if (useNameSearch) {
        result = await verificarNome(nome, tipo);
        if (!result.existe) {
          toast({
            title: "Cadastro não encontrado",
            description: "Nenhum cadastro encontrado com este nome. Por favor, preencha o formulário para se inscrever."
          });
        } else {
          toast({
            title: "Inscrição Encontrada!",
            description: "Recuperando seus dados..."
          });
        }
        if (onVerificationComplete) {
          onVerificationComplete({
            nome,
            ...result
          });
        }
      } else {
        result = await verificarCPF(cpf, tipo);
        if (!result.existe) {
          toast({
            title: "Cadastro não encontrado",
            description: "Nenhum cadastro encontrado com este CPF. Por favor, preencha o formulário para se inscrever."
          });
        } else {
          toast({
            title: "Inscrição Encontrada!",
            description: "Recuperando seus dados..."
          });
        }
        if (onVerificationComplete) {
          onVerificationComplete({
            cpf,
            ...result
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar. Tente novamente.",
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
          Informe seu {useNameSearch ? 'nome' : 'CPF'} para iniciar a inscrição ou verificar status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-6">
          <Switch id="search-mode" checked={useNameSearch} onCheckedChange={checked => {
          setUseNameSearch(checked);
          setCpf('');
          setNome('');
        }} />
          <Label htmlFor="search-mode" className="text-white cursor-pointer select-none">Não tenho CPF</Label>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-input" className="text-white">
              {useNameSearch ? 'Nome Completo' : 'CPF'}
            </Label>
            {useNameSearch ? <Input id="search-input" value={nome} onChange={handleNomeChange} placeholder="Digite seu nome completo" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" /> : <Input id="search-input" value={cpf} onChange={handleCpfChange} placeholder="000.000.000-00" maxLength={14} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />}
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading || (useNameSearch ? nome.trim().length < 3 : cpf.length < 14)}>
            {loading ? <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </> : 'Continuar'}
          </Button>

          <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-200 mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>Se você já se inscreveu nesta edição, verificaremos o status dela. Caso contrário, você será redirecionado para o formulário de cadastro.</p>
          </div>
        </form>
      </CardContent>
    </Card>;
};
export default VerificacaoCPF;