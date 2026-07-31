import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Lock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import DadosPessoais from '@/components/inscricao/DadosPessoais';
import Endereco from '@/components/inscricao/Endereco';
import InfoEclesiasticas from '@/components/inscricao/InfoEclesiasticas';
import InfoSaude from '@/components/inscricao/InfoSaude';
import DadosComplementaresEquipante from '@/components/inscricao/DadosComplementaresEquipante';
import AreasDeTrabalho from '@/components/inscricao/AreasDeTrabalho';
import EdicaoDisplay from '@/components/EdicaoDisplay';
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { useEdicaoListener } from '@/hooks/useEdicaoListener';
import { criarInscricao } from '@/lib/api/inscricaoApi';
import { initEquipanteWorkflow } from '@/lib/api/equipanteApi';
import VerificacaoCPF from '@/components/VerificacaoCPF';
import { getValorInscricao } from '@/lib/inscricaoValoresHelpers';
import EquipanteWorkflowStatus from '@/components/equipante/EquipanteWorkflowStatus';

const Equipante = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { equipantesAbertos, loading: loadingStatus } = useInscricoesStatus();

  const [currentStep, setCurrentStep] = useState('verificacao');
  const [inscricaoData, setInscricaoData] = useState(null);
  const [valorInscricao, setValorInscricao] = useState(15000);

  const { edicaoAtual } = useEdicaoListener(() => {
    setCurrentStep('verificacao');
    setInscricaoData(null);
  });

  useEffect(() => {
    if (edicaoAtual) {
      getValorInscricao(edicaoAtual, 'equipante').then(setValorInscricao);
    }
  }, [edicaoAtual]);

  const [formData, setFormData] = useState({
    cpf: '', nome: '', dataNascimento: '', sexo: '',
    estadoCivil: '', profissao: '', tamanhoCamisa: '',
    email: '', whatsapp: '', telefoneResidencial: '', idade: '',
    cep: '', endereco: '', numero: '', complemento: '',
    bairro: '', cidade: '', estado: '',
    temProblemaSaude: '', condicoesMedicas: '',
    usaMedicamento: '', medicamentos: '',
    temRestricaoAlimentar: '', restricoesAlimentares: '',
    estaGravida: '',
    igreja: '', ePastor: '', ePastorOutro: '', pastor: '', estaAfastado: '',
    cargoIgreja: '', cargoIgrejaOutro: '', frequentaEBD: '',
    frequentaGrupoCuidado: '',
    voceCanta: '', tocaInstrumento: '',
    familiarTrabalhando: '', familiarTrabalhandoOutro: '',
    parentesco: '', familiarNome: '',
    qualRadicalAcampante: '', qualRadicalAcampanteOutro: '',
    numeroEdicaoParticipou: '', jaTrabalhouEquipe: '',
    edicaoTrabalhou: '', desejaTrabalharEdicao: '',
    autorizacaoImagemEquipante: false,
    autorizacaoImagem: false,
    contatoEmergencia: '', telefoneEmergencia: '',
    areaTrabalhoOpcao1: '', areaTrabalhoOpcao2: '', areaTrabalhoOpcao3: '',
    areasTrabalhoExtra: [],
    metodoPagamento: '', // Captured/persisted for database mapping
  });

  const [loading, setLoading] = useState(false);

  const handleVerificationComplete = (result) => {
    setFormData(prev => ({ ...prev, cpf: result.cpf }));
    if (result.existe) {
      if (result.pagou) {
        setCurrentStep('sucesso');
        setInscricaoData(result.dados);
      } else {
        setInscricaoData(result.dados);
        setCurrentStep('workflow');
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
    try {
      let submissionData = { ...formData };
      if (submissionData.estaAfastado === 'NÃO') {
        submissionData.igreja = 'NÃO SE APLICA (NÃO CONGREGA)';
      }
      const result = await criarInscricao(submissionData, 'equipante', edicaoAtual);
      if (result.success) {
        setInscricaoData(result.data);
        // Initialize workflow with age so minor/adult is set correctly
        try {
          await initEquipanteWorkflow(result.data.id, formData.idade);
        } catch (wfErr) {
          console.warn('Workflow init error:', wfErr.message);
        }
        setCurrentStep('workflow');
        toast({ title: "Cadastro salvo!", description: "Iniciando acompanhamento da inscrição..." });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const proceedToPayment = () => {
    navigate('/payment-method-selection', {
      state: {
        id: inscricaoData?.id,
        tipo: 'equipante',
        nome_completo: inscricaoData?.nome || inscricaoData?.nome_completo || formData.nome,
        cpf: inscricaoData?.cpf || formData.cpf,
        valor: "200.00"
      }
    });
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

  if (!equipantesAbertos) {
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
        <title>Inscrição Equipante - Metanoia Radical</title>
      </Helmet>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            Área do Equipante <span className="text-red-500">-</span> <EdicaoDisplay size="large" showFullText={false} />
          </h2>
        </div>

        {currentStep === 'verificacao' && (
          <VerificacaoCPF onVerificationComplete={handleVerificationComplete} tipo="equipante" edicaoAtual={edicaoAtual} />
        )}

        {currentStep === 'formulario' && (
          <Card className="glass-effect border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Novo Cadastro</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <DadosPessoais formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} isEquipante={true} setFormData={setFormData} />
                <Endereco formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                <InfoSaude formData={formData} handleChange={handleChange} />
                <InfoEclesiasticas formData={formData} handleChange={handleChange} isEquipante={true} />
                <DadosComplementaresEquipante formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} handleCheckboxChange={handleCheckboxChange} />
                <AreasDeTrabalho formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg" disabled={loading}>
                  {loading ? <RefreshCw className="animate-spin mr-2" /> : "Salvar e Continuar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {currentStep === 'workflow' && inscricaoData && (
          <EquipanteWorkflowStatus
            equipanteId={inscricaoData.id}
            age={inscricaoData.idade ?? formData.idade}
            onProceedToPayment={proceedToPayment}
          />
        )}

        {currentStep === 'sucesso' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-green-600/20 border border-green-500/50 p-8 rounded-lg text-center space-y-4">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white">Inscrição Confirmada!</h2>
            <p className="text-green-100 text-lg">Parabéns, {inscricaoData?.nome?.split(' ')[0]}! Sua inscrição está confirmada.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/'}>Voltar para o Início</Button>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default Equipante;