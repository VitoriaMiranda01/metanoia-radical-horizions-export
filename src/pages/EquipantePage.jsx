import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import DadosPessoais from '@/components/inscricao/DadosPessoais';
import InfoEclesiasticas from '@/components/inscricao/InfoEclesiasticas';
import InfoSaude from '@/components/inscricao/InfoSaude';
import DadosComplementaresEquipante from '@/components/inscricao/DadosComplementaresEquipante';
import AreasDeTrabalho from '@/components/inscricao/AreasDeTrabalho';
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { criarInscricao } from '@/services/inscricoesService';
import VerificacaoCPF from '@/components/common/VerificacaoCPF';
import EquipanteWorkflowStatus from '@/components/equipante/EquipanteWorkflowStatus';

const mapDbToFormData = (dbData) => {
  if (!dbData) return {};

  return {
    // Dados pessoais
    id: dbData.id || '',
    cpf: dbData.cpf || '',
    nome: dbData.nome || '',
    sexo: dbData.sexo || '',
    whatsapp: dbData.whatsapp || '',
    telefoneResidencial: dbData.telefone_residencial || '',
    idade: dbData.idade || '',

    // Saúde
    temProblemaSaude: dbData.tem_problema_saude ?? '',
    condicoesMedicas: dbData.condicoes_medicas || '',
    temRestricaoAlimentar: dbData.tem_restricao_alimentar ?? '',
    restricoesAlimentares: dbData.restricoes_alimentares || '',

    // Igreja
    igreja: dbData.igreja || '',
    ePastor: dbData.e_pastor ?? '',
    ePastorOutro: dbData.e_pastor_outro || '',
    pastor: dbData.pastor_nome || '',
    estaAfastado: dbData.esta_afastado ?? '',
    cargoIgreja: dbData.cargo_igreja || '',
    cargoIgrejaOutro: dbData.cargo_igreja_outro || '',

    // Participação
    frequentaGrupoCuidado: dbData.frequenta_grupo_cuidado ?? '',

    // Habilidades
    voceCanta: dbData.voce_canta ?? '',
    tocaInstrumento: dbData.toca_instrumento ?? '',

    // Familiar
    familiarTrabalhando: dbData.familiar_trabalhando ?? '',
    familiarTrabalhandoOutro: dbData.familiar_trabalhando_outro || '',
    parentesco: dbData.parentesco || '',
    familiarNome: dbData.familiar_nome || '',

    // Acampante
    qualRadicalAcampante: dbData.qual_radical_acampante || '',
    qualRadicalAcampanteOutro: dbData.qual_radical_acampante_outro || '',

    // Experiência
    numeroEdicaoParticipou: dbData.numero_edicao_participou || '',
    jaTrabalhouEquipe: dbData.ja_trabalhou_equipe ?? '',
    edicaoTrabalhou: dbData.edicao_trabalhou || '',

    // Autorização
    autorizacaoImagemEquipante: dbData.autorizacao_imagem ?? false,
    autorizacaoImagem: dbData.autorizacao_imagem ?? false,

    // Emergência
    contatoEmergencia: dbData.contato_emergencia_nome || '',
    telefoneEmergencia: dbData.contato_emergencia_telefone || '',

    // Áreas de trabalho
    areaTrabalhoOpcao1: dbData.area_trabalho_opcao1 || '',
    areaTrabalhoOpcao2: dbData.area_trabalho_opcao2 || '',
    areaTrabalhoOpcao3: dbData.area_trabalho_opcao3 || '',
    areaTrabalhoExtra: dbData.area_trabalho_extra || '',
    areasTrabalhoExtra: dbData.area_trabalho_extra || [],

    // Outros
    metodoPagamento: dbData.metodo_pagamento || '',
  };
};

const EquipantePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { equipantesAbertos, loading: loadingStatus } = useInscricoesStatus();

  const [currentStep, setCurrentStep] = useState('verificacao');
  const [inscricaoData, setInscricaoData] = useState(null);

  const [formData, setFormData] = useState({
    cpf: '', semCpf: false, nome: '', dataNascimento: '', sexo: '',
    whatsapp: '', telefoneResidencial: '', idade: '',
    temProblemaSaude: '', condicoesMedicas: '',
    temRestricaoAlimentar: '', restricoesAlimentares: '',
    igreja: '', ePastor: '', ePastorOutro: '', pastor: '', estaAfastado: '',
    cargoIgreja: '', cargoIgrejaOutro: '',
    frequentaGrupoCuidado: '',
    voceCanta: '', tocaInstrumento: '',
    familiarTrabalhando: '', familiarTrabalhandoOutro: '',
    parentesco: '', familiarNome: '',
    qualRadicalAcampante: '', qualRadicalAcampanteOutro: '',
    numeroEdicaoParticipou: '', jaTrabalhouEquipe: '',
    edicaoTrabalhou: '',
    autorizacaoImagemEquipante: false,
    autorizacaoImagem: false,
    contatoEmergencia: '', telefoneEmergencia: '',
    areaTrabalhoOpcao1: '', areaTrabalhoOpcao2: '', areaTrabalhoOpcao3: '',
    areasTrabalhoExtra: [],
    metodoPagamento: '',
  });

  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleVerificationComplete = (result) => {
    if (result.semCpf) setFormData(prev => ({ ...prev, semCpf: true }));
    // Preenche o Nome/CPF já com o que foi digitado na tela de verificação
    // anterior, pra não pedir a mesma informação de novo — mesmo padrão já
    // usado em AcampantePage.jsx. Faltava o CPF aqui: pra quem digitou CPF
    // e não tinha cadastro ainda (cai direto no "else" abaixo, sem passar
    // por mapDbToFormData), o campo ficava em branco no formulário.
    if (result.nome) setFormData(prev => ({ ...prev, nome: result.nome }));
    if (result.cpf) setFormData(prev => ({ ...prev, cpf: result.cpf }));

    const isFound = result.found || result.existe;
    const isEnrolled = result.inscrito;
    const hasPaid = result.pagou;
    const loadedData = result.data || result.dados;

    // Quem JA PAGOU nao recebe id nem nome do servidor (verificar_inscricao
    // devolve so "existe/pago/inscrito", de proposito). Por isso este caso vem
    // primeiro e nao depende de "loadedData".
    //
    // Antes a condicao exigia loadedData, que e nulo justamente para quem
    // pagou: o equipante ja inscrito e pago caia no formulario de nova
    // inscricao, preenchia tudo de novo e so no envio recebia "Erro ao
    // processar inscricao" (o banco recusando o CPF repetido).
    if (isFound && hasPaid) {
      setCurrentStep('sucesso');
    } else if (isFound && loadedData) {
      setInscricaoData(loadedData);

      if (!isEnrolled) {
        setFormData(prev => ({
          ...prev,
          ...mapDbToFormData(loadedData)
        }));

        setCurrentStep(equipantesAbertos ? 'formulario' : 'fechadas');
      } else {
        if (hasPaid) {
          setCurrentStep('sucesso');
        } else {
          setCurrentStep('workflow');
        }
      }
    } else {
      setCurrentStep(equipantesAbertos ? 'formulario' : 'fechadas');
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

    // Perguntas de menu suspenso. O navegador so barra sozinho os campos de
    // digitar; estas quatro sao <Select>, e passavam em branco. Duas delas
    // fazem falta de verdade depois: o SEXO sustenta os limites de homens e
    // mulheres por area na escala, e "congrega em alguma igreja?" muda o que
    // a Direcao precisa olhar na aprovacao.
    const faltando = [];
    if (!formData.sexo) faltando.push('Sexo');
    if (!formData.estaAfastado) faltando.push('Congrega em alguma igreja?');
    if (!formData.familiarTrabalhando) faltando.push('Tem algum familiar que vai trabalhar no projeto?');
    if (!formData.parentesco) faltando.push('Tem algum conhecido / familiar que vai participar como ACAMPANTE?');

    if (faltando.length > 0) {
      toast({
        title: faltando.length === 1 ? 'Falta responder uma pergunta' : `Faltam ${faltando.length} perguntas`,
        description: faltando.join(' · '),
        variant: "destructive"
      });
      return;
    }

    // As 3 opções de área de trabalho agora são obrigatórias: sem isso, a
    // futura alocação automática (feita na aprovação, seguindo a ordem de
    // preferência) não teria o que processar pra essa pessoa.
    if (!formData.areaTrabalhoOpcao1 || !formData.areaTrabalhoOpcao2 || !formData.areaTrabalhoOpcao3) {
      toast({
        title: "Áreas de trabalho obrigatórias",
        description: "Selecione suas 3 opções de área de trabalho (1ª, 2ª e 3ª) antes de continuar.",
        variant: "destructive"
      });
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
      }
      
      const result = await criarInscricao(submissionData, 'equipante');
      
      if (result.success) {
        setInscricaoData(result.data);

        // A marca de "ja se inscreveu" NAO e mais gravada daqui: quem grava
        // e criar_inscricao, no servidor, junto com a propria inscricao.
        // Antes era um update direto na tabela -- e como quem se inscreve
        // nao esta logado, ele levava 401 em silencio. A marca nunca era
        // gravada, e ao voltar ao site a pessoa era mandada preencher o
        // formulario de novo, como se nunca tivesse se inscrito.
        toast({
          title: "Inscrição enviada!",
          description: "Acompanhe a situação dela por aqui."
        });

        setCurrentStep('workflow');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: "Erro ao salvar cadastro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const proceedToPayment = () => {
    navigate('/payment-method-selection', {
      state: {
        id: inscricaoData?.id,
        tipo: 'equipante',
        nome: inscricaoData?.nome || formData.nome,
        cpf: inscricaoData?.cpf || formData.cpf
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

  return (
    <Layout>
      <Helmet>
        <title>Inscrição Equipante - Metanoia Radical</title>
      </Helmet>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            Área do Equipante
          </h2>
        </div>

        {currentStep === 'verificacao' && (
          <>
            {/* Com as inscricoes fechadas a tela NAO some: quem ja se
                inscreveu precisa entrar para ver a situacao e, quando for
                escalado, pagar a taxa de alimentacao -- o que acontece
                justamente depois de as inscricoes fecharem. So o cadastro
                novo e que fica barrado. */}
            {!equipantesAbertos && (
              <div className="mb-6 bg-amber-500/10 border border-amber-500/25 p-4 rounded-lg flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-200 text-sm">
                  As inscrições de equipante estão <strong>encerradas</strong>. Se você já se
                  inscreveu, informe seu CPF abaixo para acompanhar a situação da sua inscrição.
                </p>
              </div>
            )}
            <VerificacaoCPF onVerificationComplete={handleVerificationComplete} tipo="equipante" />
          </>
        )}

        {currentStep === 'fechadas' && (
          <div className="max-w-xl mx-auto bg-red-900/20 border border-red-500/30 rounded-lg p-12 text-center">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Inscrições Encerradas</h3>
            <p className="text-gray-300">
              Não encontramos inscrição com esses dados, e as inscrições de equipante já foram
              encerradas. Se você acha que se inscreveu, procure a organização.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => navigate('/')}>Voltar</Button>
          </div>
        )}

        {currentStep === 'formulario' && (
          <Card className="glass-effect border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Novo Cadastro</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <DadosPessoais formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} handleCheckboxChange={handleCheckboxChange} isEquipante={true} setFormData={setFormData} />
                <InfoSaude formData={formData} handleChange={handleChange} isEquipante={true} />
                <InfoEclesiasticas formData={formData} handleChange={handleChange} isEquipante={true} />
                <DadosComplementaresEquipante formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} handleCheckboxChange={handleCheckboxChange} />
                <AreasDeTrabalho formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} />
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg" disabled={loading}>
                  {loading ? <RefreshCw className="animate-spin mr-2" /> : "Enviar Inscrição"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {currentStep === 'workflow' && inscricaoData && (
          <EquipanteWorkflowStatus
            equipanteId={inscricaoData.id}
            age={inscricaoData.idade ?? formData.idade}
            // Prova de dono: quem se inscreve nao esta logado, entao o
            // servidor confere o CPF (ou o nome de quem nao tem CPF) antes
            // de contar a situacao da inscricao.
            dono={{ cpf: inscricaoData?.cpf || formData.cpf, nome: inscricaoData?.nome || formData.nome }}
            onProceedToPayment={proceedToPayment}
          />
        )}

        {currentStep === 'sucesso' && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-green-600/20 border border-green-500/50 p-8 rounded-lg text-center space-y-4">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white">Inscrição Confirmada!</h2>
            <p className="text-green-100 text-lg">Parabéns, {inscricaoData?.nome?.split(' ')[0] || 'Equipante'}! Sua inscrição está confirmada.</p>
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

export default EquipantePage;