import React, { useState } from 'react';
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
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { criarInscricao } from '@/services/inscricoesService';
import { updateEquipanteInscrito } from '@/services/equipantesService';
import VerificacaoCPF from '@/components/common/VerificacaoCPF';
import EquipanteWorkflowStatus from '@/components/equipante/EquipanteWorkflowStatus';

const mapDbToFormData = (dbData) => {
  if (!dbData) return {};

  return {
    // Dados pessoais
    id: dbData.id || '',
    cpf: dbData.cpf || '',
    nome: dbData.nome || '',
    email: dbData.email || '',
    sexo: dbData.sexo || '',
    whatsapp: dbData.whatsapp || '',
    telefoneResidencial: dbData.telefone_residencial || '',
    idade: dbData.idade || '',

    // Endereço
    cep: dbData.cep || '',
    endereco: dbData.endereco || '',
    numero: dbData.numero || '',
    complemento: dbData.complemento || '',
    bairro: dbData.bairro || '',
    cidade: dbData.cidade || '',
    estado: dbData.estado || '',

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
    frequentaEBD: dbData.frequenta_ebd ?? '',
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
    desejaTrabalharEdicao: dbData.deseja_trabalhar_edicao || '',

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
    tamanhoCamisa: dbData.tamanho_camisa || dbData.tamanho_camiseta || '',
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
    tamanhoCamisa: '',
    email: '', whatsapp: '', telefoneResidencial: '', idade: '',
    cep: '', endereco: '', numero: '', complemento: '',
    bairro: '', cidade: '', estado: '',
    temProblemaSaude: '', condicoesMedicas: '',
    temRestricaoAlimentar: '', restricoesAlimentares: '',
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
    metodoPagamento: '',
  });

  const [loading, setLoading] = useState(false);

  const handleVerificationComplete = (result) => {
    if (result.semCpf) setFormData(prev => ({ ...prev, semCpf: true }));
    // Preenche o Nome já com o que foi digitado na busca por nome (tela
    // anterior), pra não pedir a mesma informação de novo — mesmo padrão já
    // usado em AcampantePage.jsx.
    if (result.nome) setFormData(prev => ({ ...prev, nome: result.nome }));

    const isFound = result.found || result.existe;
    const isEnrolled = result.inscrito;
    const hasPaid = result.pagou;
    const loadedData = result.data || result.dados;

    if (isFound && loadedData) {
      setInscricaoData(loadedData);

      if (!isEnrolled) {
        setFormData(prev => ({
          ...prev,
          ...mapDbToFormData(loadedData)
        }));

        setCurrentStep('formulario');
      } else {
        if (hasPaid) {
          setCurrentStep('sucesso');
        } else {
          setCurrentStep('workflow');
        }
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

    // As 3 opções de área de trabalho agora são obrigatórias: sem isso, a
    // futura alocação automática (feita na aprovação, seguindo a ordem de
    // preferência) não teria o que processar pra essa pessoa.
    if (!formData.areaTrabalhoOpcao1 || !formData.areaTrabalhoOpcao2 || !formData.areaTrabalhoOpcao3) {
      toast({
        title: "Áreas de trabalho obrigatórias",
        description: "Selecione suas 3 opções de área de trabalho (1ª, 2ª e 3ª) antes de continuar.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    try {
      let submissionData = { ...formData };
      if (submissionData.estaAfastado === 'NÃO') {
        submissionData.igreja = 'NÃO SE APLICA (NÃO CONGREGA)';
      }
      
      const result = await criarInscricao(submissionData, 'equipante');
      
      if (result.success) {
        setInscricaoData(result.data);
        const equipanteId = result.data.id;
        
        try {
          await updateEquipanteInscrito(equipanteId);
          
          toast({ 
            title: "Cadastro salvo com sucesso!", 
            description: "Iniciando acompanhamento da inscrição e status atualizado." 
          });
        } catch (wfErr) {
          console.warn('[Equipante Form] Inscrito update error:', wfErr.message);
          toast({ 
            title: "Aviso", 
            description: "A inscrição foi salva, mas ocorreu um erro ao atualizar algumas etapas adicionais. O suporte pode verificar isso mais tarde.", 
            variant: "destructive" 
          });
        }
        
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

  if (!equipantesAbertos) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto mt-20 bg-red-900/20 border border-red-500/30 rounded-lg p-12 text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white">Inscrições Encerradas</h3>
          <Button 
            variant="outline" 
            className="mt-4" 
            onClick={() => navigate('/')}
          >
            Voltar
          </Button>
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
          <VerificacaoCPF onVerificationComplete={handleVerificationComplete} tipo="equipante" />
        )}

        {currentStep === 'formulario' && (
          <Card className="glass-effect border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Novo Cadastro</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <DadosPessoais formData={formData} handleChange={handleChange} handleSelectChange={handleSelectChange} handleCheckboxChange={handleCheckboxChange} isEquipante={true} setFormData={setFormData} />
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
            <p className="text-green-100 text-lg">Parabéns, {inscricaoData?.nome?.split(' ')[0] || 'Equipante'}! Sua inscrição está confirmada.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Voltar para o Início</Button>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default EquipantePage;