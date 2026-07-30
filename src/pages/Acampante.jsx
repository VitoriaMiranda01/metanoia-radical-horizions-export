
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Lock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import FormHeader from '@/components/inscricao/FormHeader';
import AdminResponsavel from '@/components/inscricao/AdminResponsavel';
import DadosPessoais from '@/components/inscricao/DadosPessoais';
import Endereco from '@/components/inscricao/Endereco';
import InfoEclesiasticas from '@/components/inscricao/InfoEclesiasticas';
import InfoSaude from '@/components/inscricao/InfoSaude';
import ContatoEmergencia from '@/components/inscricao/ContatoEmergencia';
import QuemIndicou from '@/components/inscricao/QuemIndicou';
import TermosResponsabilidade from '@/components/inscricao/TermosResponsabilidade';
import WelcomeScreen from '@/components/inscricao/WelcomeScreen';
import VerificacaoCPF from '@/components/VerificacaoCPF';
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { useEdicaoListener } from '@/hooks/useEdicaoListener';
import { criarInscricao } from '@/lib/api/inscricaoApi';
import { getValorInscricao } from '@/lib/inscricaoValoresHelpers';

const Acampante = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { acampantesAbertos, loading: loadingStatus } = useInscricoesStatus();

  const [currentStep, setCurrentStep] = useState('welcome');
  const [inscricaoData, setInscricaoData] = useState(null);
  const [valorInscricao, setValorInscricao] = useState(15000);

  const { edicaoAtual } = useEdicaoListener(() => {
    setCurrentStep('welcome');
    setInscricaoData(null);
  });

  useEffect(() => {
    if (edicaoAtual) {
      getValorInscricao(edicaoAtual, 'acampante').then(setValorInscricao);
    }
  }, [edicaoAtual]);

  const [formData, setFormData] = useState({
    adminResponsavel: '',
    cpf: '', nome: '', sexo: '',
    estadoCivil: '', profissao: '', tamanho_camisa: '',
    whatsapp: '', telefoneResidencial: '', idade: '',
    autorizacaoImagem: false,
    cep: '', endereco: '', numero: '', complemento: '',
    bairro: '', cidade: '', estado: '',
    temProblemaSaude: '', condicoesMedicas: '',
    usaMedicamento: '', medicamentos: '',
    temRestricaoAlimentar: '', restricoesAlimentares: '',
    estaGravida: '',
    igreja: '', ePastor: '', ePastorOutro: '', pastor: '', estaAfastado: '',
    contatoEmergencia: '', telefoneEmergencia: '',
    nomeQuemIndicou: '', telefoneQuemIndicou: '',
    conhecidoNoProjeto: '', nomeFamiliarConhecido: '',
    termoAceito: false, dataAceite: '',
    metodoPagamento: '', // Captured/persisted for database mapping
  });

  const [loading, setLoading] = useState(false);

  const handleVerificationComplete = (result) => {
    setFormData(prev => ({ ...prev, cpf: result.cpf }));
    if (result.existe) {
      if (result.pagou) {
        setInscricaoData(result.dados);
        setCurrentStep('sucesso');
      } else {
        setInscricaoData(result.dados);
        toast({ title: "Cadastro encontrado", description: "Redirecionando para o pagamento..." });
        navigate('/payment-method-selection', {
          state: {
            id: result.dados.id,
            tipo: 'acampante',
            nome_completo: result.dados.nome || result.dados.nome_completo,
            cpf: result.dados.cpf,
            valor: "200.00"
          }
        });
      }
    } else {
      setCurrentStep('formulario');
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };
  const handleSelectChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  const handleCheckboxChange = (name, checked) => setFormData(prev => ({ ...prev, [name]: checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.termoAceito) {
      toast({ title: "Atenção", description: "Aceite os termos para continuar.", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      let submissionData = { ...formData };
      if (submissionData.estaAfastado === 'NÃO') {
        submissionData.igreja = 'NÃO SE APLICA (NÃO CONGREGA)';
        submissionData.pastor = 'NÃO SE APLICA';
      }
      const result = await criarInscricao(submissionData, 'acampante', edicaoAtual);
      if (result.success) {
        setInscricaoData(result.data);
        toast({ title: "Inscrição Realizada!", description: "Redirecionando para o pagamento...", className: "bg-green-600 text-white" });
        navigate('/payment-method-selection', {
          state: {
            id: result.data.id,
            tipo: 'acampante',
            nome_completo: formData.nome,
            cpf: formData.cpf,
            valor: "200.00"
          }
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loadingStatus) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-[50vh]">
          <RefreshCw className="w-8 h-8 text-white animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!acampantesAbertos) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto mt-20 bg-red-900/20 border border-red-500/30 rounded-lg p-12 text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white">Inscrições Encerradas</h3>
          <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/'}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Inscrição Acampante - Metanoia Radical</title>
      </Helmet>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto pb-20">

        {currentStep === 'welcome' && (
          <WelcomeScreen onProceed={() => setCurrentStep('verificacao')} />
        )}

        {currentStep === 'verificacao' && (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setCurrentStep('welcome')} className="text-white hover:bg-white/10">Voltar</Button>
            <VerificacaoCPF onVerificationComplete={handleVerificationComplete} tipo="acampante" edicaoAtual={edicaoAtual} />
          </div>
        )}

        {currentStep === 'formulario' && (
          <div className="space-y-6">
            <FormHeader userRole="acampante" inscricaoExistente={null} />
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <AdminResponsavel formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                  <DadosPessoais formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} handleCheckboxChange={handleCheckboxChange} isEquipante={false} setFormData={setFormData} />
                  <Endereco formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                  <InfoSaude formData={formData} handleChange={handleChange} />
                  <InfoEclesiasticas formData={formData} handleChange={handleChange} isEquipante={false} />
                  <ContatoEmergencia formData={formData} handleChange={handleChange} />
                  <QuemIndicou formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                  <TermosResponsabilidade formData={formData} handleChange={handleChange} handleCheckboxChange={handleCheckboxChange} />

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4" disabled={loading}>
                    {loading ? <RefreshCw className="animate-spin mr-2" /> : "Prosseguir para Pagamento"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'sucesso' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-green-600/20 border border-green-500/50 p-8 rounded-lg text-center space-y-4 mt-10">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white">Tudo Pronto!</h2>
            <p className="text-green-100 text-lg">Sua vaga está garantida para esta edição.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/'}>Ir para Home</Button>
          </motion.div>
        )}

      </motion.div>
    </Layout>
  );
};

export default Acampante;
