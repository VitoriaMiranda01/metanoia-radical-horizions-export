import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import VerificacaoCPF from '@/components/common/VerificacaoCPF';
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { criarInscricao } from '@/services/inscricoesService';
import { fetchLimitesIgrejas, fetchOcupacaoIgrejasAcampantes } from '@/services/limitesIgrejasService';
import { fetchLimiteAcampantesPorIgrejaPadrao } from '@/services/organizerConfigService';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';

const AcampantePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { acampantesAbertos, loading: loadingStatus } = useInscricoesStatus();

  const [currentStep, setCurrentStep] = useState('welcome');
  const [inscricaoData, setInscricaoData] = useState(null);

  const [formData, setFormData] = useState({
    adminResponsavel: '',
    cpf: '', semCpf: false, nome: '', sexo: '',
    tamanho_camisa: '',
    whatsapp: '', telefoneResidencial: '', idade: '',
    email: '', profissao: '', estadoCivil: '',
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
    metodoPagamento: '',
  });

  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [igrejasEsgotadas, setIgrejasEsgotadas] = useState(new Set());

  // Desabilita, no seletor de "Igreja Responsável pela Inscrição", as
  // igrejas que ja bateram o limite de acampantes configurado em
  // Configuracoes (excecao especifica em limites_igrejas, ou o limite
  // padrao geral). Calculado uma vez ao carregar a pagina -- e so uma
  // cortesia de UX (evita a pessoa preencher tudo e so descobrir no envio);
  // a garantia de verdade contra ultrapassar o limite fica no banco (ver
  // migration schema-update-20260907-limite-acampantes-por-igreja.sql).
  useEffect(() => {
    const carregarLimitesIgrejas = async () => {
      try {
        const [excecoes, ocupacao, limitePadrao] = await Promise.all([
          fetchLimitesIgrejas(),
          fetchOcupacaoIgrejasAcampantes(),
          fetchLimiteAcampantesPorIgrejaPadrao()
        ]);

        const esgotadas = new Set();
        IGREJAS_PARCEIRAS.forEach(igreja => {
          const limite = excecoes[igreja] !== undefined ? excecoes[igreja] : limitePadrao;
          if (limite === null || limite === undefined) return;
          const ocupados = ocupacao[igreja] || 0;
          if (ocupados >= limite) esgotadas.add(igreja);
        });
        setIgrejasEsgotadas(esgotadas);
      } catch (error) {
        console.error('Erro ao calcular limites de igrejas por acampante:', error);
      }
    };
    carregarLimitesIgrejas();
  }, []);

  const handleVerificationComplete = (result) => {
    if (result.cpf) setFormData(prev => ({ ...prev, cpf: result.cpf }));
    if (result.nome) setFormData(prev => ({ ...prev, nome: result.nome }));
    if (result.semCpf) setFormData(prev => ({ ...prev, semCpf: true }));
    
    // Quem JA PAGOU nao recebe id nem nome do servidor (verificar_inscricao
    // devolve so "existe/pago", de proposito -- ninguem precisa conseguir
    // descobrir o nome de um inscrito digitando CPFs). Por isso este caso
    // vem primeiro e nao depende de "dados".
    //
    // Antes a condicao exigia "result.dados", que e nulo justamente para quem
    // pagou: a pessoa ja inscrita e paga caia no formulario de nova inscricao,
    // preenchia tudo de novo e so no envio recebia "Erro ao processar
    // inscricao" (o banco recusando o CPF repetido).
    if (result.existe && result.pagou) {
      setInscricaoData(result.dados);
      setCurrentStep('sucesso');
    } else if (result.existe && result.dados) {
      // Ja inscrito, mas ainda devendo: vai direto para o pagamento.
      setInscricaoData(result.dados);
      toast({ title: "Cadastro encontrado", description: "Redirecionando para o pagamento..." });
      navigate('/payment-method-selection', {
        state: {
          id: result.dados.id,
          tipo: 'acampante',
          nome: result.dados.nome,
          cpf: result.dados.cpf
        }
      });
    } else {
      setCurrentStep(acampantesAbertos ? 'formulario' : 'fechadas');
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };
  const handleSelectChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  const handleCheckboxChange = (name, checked) => setFormData(prev => ({ ...prev, [name]: checked }));

  // So valida e abre o dialogo de confirmacao -- o envio de verdade so
  // acontece se o usuario confirmar em confirmarEnvio, abaixo. Pedido
  // explicito da usuaria pra evitar envio acidental, ja que a inscricao
  // nao pode mais ser editada depois de enviada.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.termoAceito) {
      toast({ title: "Atenção", description: "Aceite os termos para continuar.", variant: "destructive" });
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmarEnvio = async () => {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      let submissionData = { ...formData };
      if (submissionData.estaAfastado === 'NÃO') {
        submissionData.igreja = 'NÃO SE APLICA (NÃO CONGREGA)';
        submissionData.pastor = 'NÃO SE APLICA';
      }
      const result = await criarInscricao(submissionData, 'acampante');
      if (result.success) {
        setInscricaoData(result.data);
        toast({ title: "Inscrição Realizada!", description: "Redirecionando para o pagamento...", className: "bg-green-600 text-white" });
        navigate('/payment-method-selection', {
          state: {
            id: result.data.id,
            tipo: 'acampante',
            nome: formData.nome,
            cpf: formData.cpf
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
            {/* Com as inscricoes fechadas a tela NAO some: quem se inscreveu
                e ainda nao pagou precisa entrar para pagar -- e isso costuma
                acontecer depois de as inscricoes fecharem. So o cadastro novo
                fica barrado. */}
            {!acampantesAbertos && (
              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-lg flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-200 text-sm">
                  As inscrições de acampante estão <strong>encerradas</strong>. Se você já se
                  inscreveu, informe seu CPF abaixo para ver a situação e concluir o pagamento.
                </p>
              </div>
            )}
            <VerificacaoCPF onVerificationComplete={handleVerificationComplete} tipo="acampante" />
          </div>
        )}

        {currentStep === 'fechadas' && (
          <div className="max-w-xl mx-auto bg-red-900/20 border border-red-500/30 rounded-lg p-12 text-center">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Inscrições Encerradas</h3>
            <p className="text-gray-300">
              Não encontramos inscrição com esses dados, e as inscrições de acampante já foram
              encerradas. Se você acha que se inscreveu, procure a organização.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>Voltar</Button>
          </div>
        )}

        {currentStep === 'formulario' && (
          <div className="space-y-6">
            <FormHeader userRole="acampante" inscricaoExistente={null} />
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <AdminResponsavel formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} igrejasEsgotadas={igrejasEsgotadas} />
                  <DadosPessoais formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} handleCheckboxChange={handleCheckboxChange} isEquipante={false} setFormData={setFormData} />
                  <Endereco formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} setFormData={setFormData} />
                  <InfoSaude formData={formData} handleChange={handleChange} isEquipante={false} />
                  <InfoEclesiasticas formData={formData} handleChange={handleChange} isEquipante={false} />
                  <ContatoEmergencia formData={formData} handleChange={handleChange} />
                  <QuemIndicou formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                  <TermosResponsabilidade formData={formData} handleChange={handleChange} handleCheckboxChange={handleCheckboxChange} />

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4" disabled={loading}>
                    {loading ? <RefreshCw className="animate-spin mr-2" /> : "Enviar Inscrição"}
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
            <p className="text-green-100 text-lg">Sua vaga está garantida.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Voltar para o Início</Button>
          </motion.div>
        )}

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Enviar inscrição</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Certeza que deseja enviar a inscrição?
                <br />
                Não haverá como editar as informações após o envio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-red-600 hover:bg-red-700 text-white border-none">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmarEnvio}
                className="bg-green-600 hover:bg-green-700 text-white border-none"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </motion.div>
    </Layout>
  );
};

export default AcampantePage;