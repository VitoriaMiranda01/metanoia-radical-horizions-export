import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { criarInscricao, buscarFichaAnterior } from '@/services/inscricoesService';
import { calcularIdade } from '@/utils/formatters';
import { getEquipanteWorkflow } from '@/services/equipantesService';
import VerificacaoCPF from '@/components/common/VerificacaoCPF';
import EquipanteWorkflowStatus from '@/components/equipante/EquipanteWorkflowStatus';

// O banco guarda boolean; o formulario usa 'SIM'/'NAO'. Sem esta traducao a
// ficha voltava com os menus em branco -- e pior: "Congrega em alguma
// igreja?" em branco esconde o campo da igreja, entao a pessoa perdia a
// igreja dela sem perceber.
const simNao = (v) => (v === true ? 'SIM' : v === false ? 'NÃO' : '');

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
    dataNascimento: dbData.data_nascimento || '',

    // Saúde
    temProblemaSaude: simNao(dbData.tem_problema_saude),
    condicoesMedicas: dbData.condicoes_medicas || '',
    temRestricaoAlimentar: simNao(dbData.tem_restricao_alimentar),
    restricoesAlimentares: dbData.restricoes_alimentares || '',

    // Igreja
    igreja: dbData.igreja || '',
    // e_pastor e boolean no banco, mas o campo na tela e uma LISTA de cargos.
    // Do boolean nao da para saber qual cargo era, entao a pessoa responde de
    // novo em vez de a gente chutar. (O cargo em si vive em cargo_igreja, que
    // volta certo logo abaixo.)
    ePastor: '',
    ePastorOutro: dbData.e_pastor_outro || '',
    pastor: dbData.pastor_nome || '',
    estaAfastado: simNao(dbData.esta_afastado),
    cargoIgreja: dbData.cargo_igreja || '',
    cargoIgrejaOutro: dbData.cargo_igreja_outro || '',

    // Participação
    frequentaGrupoCuidado: simNao(dbData.frequenta_grupo_cuidado),

    // Habilidades
    voceCanta: simNao(dbData.voce_canta),
    // Idem e_pastor: a lista tem VIOLÃO, TECLADO etc, e o banco guarda so
    // "toca ou nao toca". "Nao toca" volta; "toca" a pessoa escolhe de novo.
    tocaInstrumento: dbData.toca_instrumento === false ? 'NÃO' : '',

    // Familiar
    // Mesma coisa: o banco guarda "tem familiar trabalhando (sim/nao)", nao
    // o parentesco. "Nao tenho" volta; o resto e perguntado de novo.
    familiarTrabalhando: dbData.familiar_trabalhando === false ? 'NÃO TENHO' : '',
    familiarTrabalhandoOutro: dbData.familiar_trabalhando_outro || '',
    parentesco: dbData.parentesco || '',
    familiarNome: dbData.familiar_nome || '',

    // Acampante
    qualRadicalAcampante: dbData.qual_radical_acampante || '',
    qualRadicalAcampanteOutro: dbData.qual_radical_acampante_outro || '',

    // Experiência
    numeroEdicaoParticipou: dbData.numero_edicao_participou || '',
    jaTrabalhouEquipe: simNao(dbData.ja_trabalhou_equipe),
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

  // Reinscricao: quem ja tem ficha de uma edicao anterior digita o nome
  // completo e o formulario vem preenchido, em vez de tudo de novo.
  const [nomeConfirmacao, setNomeConfirmacao] = useState('');

  // "Não tenho CPF": depois do nome vem uma tela pedindo a data de
  // nascimento. Sem ela bastaria saber o nome de alguém para abrir a
  // inscrição dessa pessoa -- e nome de gente não é segredo. A data fica
  // guardada porque o servidor a exige em TODA chamada seguinte: situação,
  // forma de pagamento, autorização dos pais.
  const [verificacao, setVerificacao] = useState(null);
  const [nascimentoConfirmado, setNascimentoConfirmado] = useState('');
  const [nascimentoDigitado, setNascimentoDigitado] = useState('');
  const [conferindoNascimento, setConferindoNascimento] = useState(false);
  const [erroNascimento, setErroNascimento] = useState('');
  const [buscandoFicha, setBuscandoFicha] = useState(false);
  const [erroFicha, setErroFicha] = useState('');

  const [formData, setFormData] = useState({
    cpf: '', semCpf: false, nome: '', dataNascimento: '', sexo: '',
    whatsapp: '', telefoneResidencial: '',
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
    // Entrou sem CPF e a ficha existe: antes de mostrar qualquer coisa,
    // confirma a data de nascimento. É ela que substitui o CPF como prova.
    if (isFound && result.semCpf && loadedData?.id) {
      setInscricaoData(loadedData);
      setVerificacao({ inscrito: isEnrolled });
      setCurrentStep('confirmar-nascimento');
      return;
    }

    if (isFound && hasPaid) {
      setCurrentStep('sucesso');
    } else if (isFound && loadedData) {
      setInscricaoData(loadedData);

      if (!isEnrolled) {
        setFormData(prev => ({
          ...prev,
          ...mapDbToFormData(loadedData)
        }));

        // Existe ficha de uma edicao anterior. Em vez de mandar a pessoa
        // preencher tudo de novo, oferecemos trazer os dados dela -- mas o
        // servidor so entrega mediante CPF **e** nome completo, entao o nome
        // e pedido no passo 'reinscricao'. Quem preferir segue com o
        // formulario limpo por la mesmo.
        setCurrentStep(equipantesAbertos ? 'reinscricao' : 'fechadas');
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

  // Traz a ficha da edicao passada. Se o nome nao bater, o servidor recusa
  // com a mesma mensagem que daria para um CPF inexistente -- de proposito,
  // para nao confirmar CPFs a quem esta chutando.
  const trazerDadosAnteriores = async () => {
    setErroFicha('');

    const nome = nomeConfirmacao.trim();
    if (nome.length < 5 || !nome.includes(' ')) {
      setErroFicha('Escreva seu nome completo (nome e sobrenome).');
      return;
    }

    setBuscandoFicha(true);
    try {
      const r = await buscarFichaAnterior(formData.cpf, nome);

      if (!r.ok) {
        setErroFicha(r.erro);
        return;
      }

      setFormData(prev => ({ ...prev, ...mapDbToFormData(r.ficha) }));
      toast({
        title: 'Dados recuperados',
        description: 'Confira o que mudou e escolha suas áreas de trabalho desta edição.'
      });
      setCurrentStep('formulario');
    } finally {
      setBuscandoFicha(false);
    }
  };

  // Confere a data contra o SERVIDOR antes de deixar entrar. Quem decide é
  // situacao_inscricao: com a data errada ela recusa, e é essa recusa que
  // vira a mensagem aqui. A tela não confere nada por conta própria -- se
  // conferisse, bastaria burlar o navegador.
  const confirmarNascimento = async () => {
    setErroNascimento('');

    if (!nascimentoDigitado) {
      setErroNascimento('Informe a sua data de nascimento.');
      return;
    }

    setConferindoNascimento(true);
    try {
      const situacao = await getEquipanteWorkflow(inscricaoData.id, {
        cpf: null,
        nome: inscricaoData?.nome || formData.nome,
        nascimento: nascimentoDigitado
      });

      setNascimentoConfirmado(nascimentoDigitado);
      setFormData(prev => ({ ...prev, dataNascimento: nascimentoDigitado }));

      if (situacao?.pago) {
        setCurrentStep('sucesso');
      } else if (verificacao?.inscrito) {
        setCurrentStep('workflow');
      } else {
        // Ficha de uma edição anterior. Sem CPF não dá para trazer a ficha
        // preenchida (ficha_para_reinscricao exige CPF **e** nome), então
        // segue para o formulário com o que já sabemos.
        setCurrentStep(equipantesAbertos ? 'formulario' : 'fechadas');
      }
    } catch (err) {
      // getEquipanteWorkflow levanta com a mensagem do servidor. Aqui a causa
      // é sempre a mesma: a data não bateu.
      console.error('confirmarNascimento', err?.message || err);
      setErroNascimento('A data de nascimento não confere com esta inscrição.');
    } finally {
      setConferindoNascimento(false);
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
    if (!formData.dataNascimento) faltando.push('Data de Nascimento');
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

    // A data de nascimento manda no "menor de 18" (autorizacao dos pais).
    // Uma data impossivel passaria batida ate a hora de escalar.
    const idade = calcularIdade(formData.dataNascimento);
    if (idade === null || idade < 10 || idade > 100) {
      toast({
        title: 'Confira a data de nascimento',
        description: 'A idade que essa data dá não parece certa.',
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
        cpf: inscricaoData?.cpf || formData.cpf,
        // Quem entrou sem CPF provou com nome + data de nascimento; a data
        // precisa seguir junto, senao o servidor recusa o pagamento.
        nascimento: nascimentoConfirmado || null
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

        {currentStep === 'confirmar-nascimento' && (
          <Card className="glass-effect border-white/10 bg-black/40 max-w-xl mx-auto">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-400" />
                Confirme que é você
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300 text-sm">
                Encontramos a inscrição de <strong className="text-white">{inscricaoData?.nome}</strong>.
                Como você entrou sem CPF, confirme a sua data de nascimento para abrir a inscrição.
              </p>

              <div className="space-y-2">
                <Label htmlFor="nascimentoConfirmacao" className="text-white">Data de nascimento</Label>
                <Input
                  id="nascimentoConfirmacao"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={nascimentoDigitado}
                  onChange={(e) => { setNascimentoDigitado(e.target.value); setErroNascimento(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarNascimento(); }}
                  className="bg-white/10 border-white/20 text-white [color-scheme:dark]"
                />
                {erroNascimento && <p className="text-red-300 text-sm">{erroNascimento}</p>}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={confirmarNascimento} disabled={conferindoNascimento} className="flex-1">
                  {conferindoNascimento ? 'Conferindo...' : 'Confirmar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep('verificacao');
                    setNascimentoDigitado('');
                    setErroNascimento('');
                  }}
                  className="flex-1 border-white/20 text-gray-300 hover:text-white"
                >
                  Voltar
                </Button>
              </div>

              <p className="text-[11px] text-gray-500">
                Sem CPF, é a data de nascimento que prova que a inscrição é sua.
              </p>
            </CardContent>
          </Card>
        )}

        {currentStep === 'reinscricao' && (
          <Card className="glass-effect border-white/10 bg-black/40 max-w-xl mx-auto">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                Você já participou antes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300 text-sm">
                Encontramos uma inscrição sua de uma edição anterior. Digite seu nome completo
                e trazemos seus dados preenchidos — aí você só confere o que mudou e escolhe
                as áreas de trabalho desta edição.
              </p>

              <div className="space-y-2">
                <Label htmlFor="nomeConfirmacao" className="text-white">Nome completo</Label>
                <Input
                  id="nomeConfirmacao"
                  value={nomeConfirmacao}
                  onChange={(e) => { setNomeConfirmacao(e.target.value); setErroFicha(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') trazerDadosAnteriores(); }}
                  placeholder="Como está na sua inscrição anterior"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                {erroFicha && <p className="text-red-300 text-sm">{erroFicha}</p>}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={trazerDadosAnteriores} disabled={buscandoFicha} className="flex-1">
                  {buscandoFicha ? 'Buscando...' : 'Trazer meus dados'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('formulario')}
                  className="flex-1 border-white/20 text-gray-300 hover:text-white"
                >
                  Preencher do zero
                </Button>
              </div>
            </CardContent>
          </Card>
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
            age={calcularIdade(formData.dataNascimento) ?? inscricaoData.idade}
            // Prova de dono: quem se inscreve nao esta logado, entao o
            // servidor confere o CPF (ou o nome de quem nao tem CPF) antes
            // de contar a situacao da inscricao.
            dono={{
              cpf: inscricaoData?.cpf || formData.cpf,
              nome: inscricaoData?.nome || formData.nome,
              nascimento: nascimentoConfirmado || null
            }}
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