import { pessoaTemChave } from '@/utils/preCadastro';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { WORK_AREAS, AREAS_ESPECIAIS, AREAS_ESPECIAIS_TRANSFERIVEIS, AREAS_RECEPCAO_IGREJA, AREAS_COM_PRE_CADASTRO, DEFAULT_AREA_CAPACITY, CORES_GRUPO, areaTemCor, AREA_DISPONIVEL_QUALQUER, AREAS_SO_PREFERENCIA, ordenarComComplementares, AREA_GUIA, GUIA_TAMBEM_EM } from '@/constants/workAreas';
import { fetchApprovedEquipantes, saveScales, fetchAllAllocations, detectAllocationChanges, fetchAtuacoesPorArea, definirAtuacao, definirAtuacaoNaArea,
  definirCor, contarAguardandoAprovacao, fetchSituacaoEscala, lancarEscala, desfazerLancamentoEscala,
  alocarFilaAutomaticamente, fetchEscalaOrdem, lancarEscalaOficial, desfazerEscalaOficial,
  fetchSituacaoAlocacaoAutomatica, desfazerAlocacaoAutomatica, distribuirCoresArea } from '@/services/scalesService';
import { fetchLimitesAreas, saveLimiteAreaComGenero, getLimiteAreaComGenero } from '@/services/limiteAreasService';
import { verifyDatabaseSchema } from '@/services/databaseVerification';
import { exportEquipantesByArea, exportAllEquipantes } from '@/utils/excelExport';
import { batchUpdateWorkScheduleStatus } from '@/services/workScheduleService';
import { alocarEquipanteManualmente, realocarAlocacao, removerAlocacao, alocarAreasEspeciaisPorCpf, fetchAreasFixas, limparArea, marcarAreaFixa } from '@/services/equipanteAllocationService';
import { fetchConfiguracoes, updateCpfsAreaEspecial } from '@/services/organizerConfigService';
import { fetchEquipantesParaSelecao } from '@/services/equipantesService';
import { Grid, Loader2, AlertTriangle, CheckCircle, Download, AlertCircle, Search, Send, Undo2, X, Truck, Sparkles, Wand2, ChevronRight, ClipboardCheck, Repeat, BadgeCheck, UserPlus, ChevronDown, ChevronUp, Pin, ArrowUpDown, Plus, Church, UserCog } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import AreaLimitHeader from '@/components/scales/AreaLimitHeader';
import AlocarEmLoteDialog from '@/components/scales/AlocarEmLoteDialog';
import FixarAreaDialog from '@/components/scales/FixarAreaDialog';
import EquipantesGridDisplay from '@/components/scales/EquipantesGridDisplay';
import CartaoFila from '@/components/scales/CartaoFila';
import AreasExtraDialog from '@/components/scales/AreasExtraDialog';
import ResponsaveisReuniaoDialog from '@/components/scales/ResponsaveisReuniaoDialog';
import AreasEspeciaisDialog from '@/components/scales/AreasEspeciaisDialog';
import PreEscalaDialog from '@/components/scales/PreEscalaDialog';
import TrocarAreaDialog from '@/components/scales/TrocarAreaDialog';
import ChamadaQuadro from '@/components/scales/ChamadaQuadro';
import InscricaoManualDialog from '@/components/gerenciar/InscricaoManualDialog';
import CpfsAreaEspecialManager from '@/components/organizer/CpfsAreaEspecialManager';
import SeloPastor from '@/components/common/SeloPastor';
import QuandoVisivel from '@/components/common/QuandoVisivel';
import CampoBusca from '@/components/common/CampoBusca';
import { tituloPastor } from '@/utils/pastor';
import { seloOrganizacao } from '@/services/selosOrganizacao';
import { configurarChamada, carregarChamada, aoMudarChamada } from '@/services/chamadaStore';
import { nomeDaIgreja } from '@/constants/igrejas';
import { casaBusca, casaNomeParecido, filtrarBusca } from '@/utils/busca';
import { emTeste } from '@/services/ambiente';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatNomeExibicao } from '@/utils/formatters';

// Os tres numeros do caminho de um equipante ate a escala. As cores foram
// pedidas pelo Patrick: amarelo = ainda depende do parceiro, vermelho =
// depende de voce, verde = pronto.
const CORES_CONTADOR = {
  amarelo: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200',
  vermelho: 'border-red-500/40 bg-red-500/10 text-red-200',
  verde: 'border-green-500/40 bg-green-500/10 text-green-200'
};

const ContadorEtapa = ({ cor, numero, rotulo, onClick }) => {
  const Elemento = onClick ? 'button' : 'div';
  return (
    <Elemento
      onClick={onClick}
      className={cn(
        'inline-flex items-baseline gap-2 px-3 py-1.5 rounded-full border text-xs',
        CORES_CONTADOR[cor],
        onClick && 'hover:brightness-125 transition cursor-pointer'
      )}
    >
      <span className="text-base font-bold leading-none">{numero}</span>
      <span className="opacity-90">{rotulo}</span>
    </Elemento>
  );
};

// Quantos blocos da fila a tela desenha de uma vez. Com ~900 aprovados,
// montar 900 blocos (cada um com um menu de 40 areas) trava o navegador
// sem servir para nada -- quem procura alguem usa a busca.
const LIMITE_FILA_VISIVEL = 100;

// Quantas areas da para escolher de uma vez na fila. Nas escalas oficiais o
// comum sao 3, mas ha quem acumule mais -- o organizador decide.
const MAX_AREAS_DE_UMA_VEZ = 5;

// Guia, Inimigo e Espirito Santo sairam do corpo da pagina: sao papeis fixos,
// mudam pouco de uma edicao para a outra, e ficavam no meio das ~30 areas
// disputando atencao com o que realmente muda. Agora tem botao e modulo
// proprios. Continuam sendo areas normais em todo o resto -- aparecem no
// menu da fila, recebem Realocar, contam nos totais.
const NOMES_ESPECIAIS = AREAS_ESPECIAIS.map(a => a.label);
// A equipe da igreja (14/10/2026) tambem tem modulo proprio -- ver
// AREAS_RECEPCAO_IGREJA em constants/workAreas.js.
const NOMES_RECEPCAO_IGREJA = AREAS_RECEPCAO_IGREJA.map(a => a.label);
// Alfabetica, com as complementares logo abaixo da sua (Perseguidos depois da Selva).
const AREAS_NO_CORPO = ordenarComComplementares(WORK_AREAS.filter(area =>
  !NOMES_ESPECIAIS.includes(area) && !NOMES_RECEPCAO_IGREJA.includes(area)));
// Areas comuns que da para acrescentar a alguem ("Não será escalado" nao e area de trabalho).
const AREAS_COMUNS = AREAS_NO_CORPO.filter(area => area !== 'Não será escalado');
// Lista vazia com identidade fixa (para o React.memo da tabela nao achar que
// "[]" novo e mudanca).
const VAZIO = [];
const VAZIO_OBJ = {};

const OrganizerScalesPage = () => {
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [mostrarNaoViram, setMostrarNaoViram] = useState(false);
  const [limitsMap, setLimitsMap] = useState({});
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [dbVerification, setDbVerification] = useState({
    checked: false,
    valid: true
  });
  const [saveStatus, setSaveStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Lista de espera "de verdade": aprovados que ainda nao tem linha em
  // escalas, recalculada a cada fetchBackgroundData (nao depende de clicar
  // em "Gerar escalas"). Substitui o antigo `unallocated`, que so existia
  // depois de um clique manual e se perdia ao recarregar a pagina.
  const [waitlist, setWaitlist] = useState([]);
  const [manualAreaChoice, setManualAreaChoice] = useState({});
  const [manualAllocating, setManualAllocating] = useState({});

  // Todos os aprovados (escalados ou nao) -- fetchApprovedEquipantes ja
  // busca isso, mas so era usado para calcular a waitlist e descartado.
  // Guardado aqui para o "Aplicar CPFs cadastrados" achar a pessoa pelo
  // CPF mesmo quando ela ja esta em outra area (ver
  // alocarAreasEspeciaisPorCpf, em equipanteAllocationService.js).
  const [equipantesAprovados, setEquipantesAprovados] = useState([]);

  // Atuacoes possiveis de cada area (a coluna ATUAÇÃO da escala oficial),
  // vindas do banco: { "Segurança": [{atuacao, ehPadrao, ehLider}, ...] }.
  // Buscadas uma vez no load -- e uma lista fixa por edicao, nao muda no
  // meio do trabalho como as alocacoes mudam.
  const [atuacoesPorArea, setAtuacoesPorArea] = useState({});
  const [salvandoAtuacao, setSalvandoAtuacao] = useState({});
  const [salvandoCor, setSalvandoCor] = useState({});

  // Quantos ainda esperam o parceiro aprovar. Os outros dois numeros do
  // painel saem das listas que a tela ja tem. null = ainda carregando (ou
  // a consulta falhou) -- ai o selo nao aparece, em vez de mostrar zero e
  // dar a impressao errada de que nao ha ninguem esperando.
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(null);

  // Busca da fila "A escalar". Com ~900 pessoas, rolar a lista atras de um
  // nome nao e opcao.
  const [buscaFila, setBuscaFila] = useState('');

  // Areas escolhidas para cada pessoa da fila. E uma LISTA porque da para
  // ja escalar em duas ou tres de uma vez -- senao o organizador teria de
  // alocar, depois procurar em qual tabela a pessoa caiu, e so entao
  // acrescentar a segunda area.
  const [areasDaFila, setAreasDaFila] = useState({});

  // Busca de quem JA esta escalado: responde "onde o fulano esta?" sem
  // precisar varrer as 40 tabelas.
  const [buscaEscalados, setBuscaEscalados] = useState('');
  const filaRef = useRef(null);

  // Lancamento da escala. Ate ser lancada, NENHUM equipante ve a etapa
  // "Escala de trabalho" concluida nem consegue pagar -- mesmo ja tendo
  // area. Quem divulga a escala e a reuniao; o site so acompanha.
  const [escala, setEscala] = useState(null);

  // Chamada da reuniao de escala na tabela (16/10/2026): o icone ao lado de
  // cada nome so existe depois da provisoria. A chamada dos lideres chega a
  // cada 30 s; marcou aqui (ou na janela da area), o quadro acompanha.
  useEffect(() => {
    const ativa = !!escala?.lancada_em;
    configurarChamada({ ativa, podeMarcar: ativa && !!escala?.pode_gerir });
    if (!ativa) return undefined;
    carregarChamada();
    const t = setInterval(() => { if (!document.hidden) carregarChamada(); }, 30000);
    const sair = aoMudarChamada(async () => { const s = await fetchSituacaoEscala(); if (s) setEscala(s); });
    return () => { clearInterval(t); sair(); };
  }, [escala?.lancada_em, escala?.pode_gerir]);
  const [confirmandoLancamento, setConfirmandoLancamento] = useState(false);

  // SO NO AMBIENTE DE TESTE (Patrick, 07/10/2026): la a escala pode ser lancada
  // mesmo com gente na fila "A escalar" (o banco de teste tambem libera -- ver
  // database/ambiente-teste/liberar-lancamento-com-fila.sql). No oficial a regra
  // segue valendo: emTeste() e falso.
  const liberaComFila = emTeste();
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState(false);
  const [lancando, setLancando] = useState(false);

  // Escala OFICIAL (05/10/2026): a de cima (lancar_escala) virou a
  // PROVISORIA -- mostra a area, abre o pagamento e a relacao dos lideres
  // para a chamada da reuniao de escala. A oficial e a escala final, que o
  // Dudu refaz depois da chamada. Lancar, trocar de area e decidir os
  // ausentes e so para Desenvolvedores, Raquel e Dudu (escala.pode_gerir,
  // conferido de novo no banco).
  const [confirmandoOficial, setConfirmandoOficial] = useState(false);
  const [confirmandoDesfazerOficial, setConfirmandoDesfazerOficial] = useState(false);
  const [trocaAberta, setTrocaAberta] = useState(null); // null | { inicial }
  // Quem chega na reuniao de escala sem ter se inscrito: o Dudu cadastra
  // aqui mesmo e a pessoa cai na fila "A escalar" para ser alocada na hora.
  const [manualAberta, setManualAberta] = useState(false);

  // Areas de Trabalho Extra: painel a parte, so de leitura + resposta.
  // Nao mexe em escalas nem no lancamento -- ver AreasExtraDialog.jsx.
  const [verAreasExtra, setVerAreasExtra] = useState(false);
  const [verResponsaveis, setVerResponsaveis] = useState(false);
  const [verAreasEspeciais, setVerAreasEspeciais] = useState(false);
  const [verRecepcaoIgreja, setVerRecepcaoIgreja] = useState(false);

  // Pre-escala: so leitura, ve-se a demanda por area entre TODO MUNDO ja
  // inscrito (qualquer status). Nao mexe em nada -- ver PreEscalaDialog.jsx.
  const [verPreEscala, setVerPreEscala] = useState(false);

  // Alocacao automatica pelas 3 preferencias -- ver o comentario grande
  // em scalesService.alocarFilaAutomaticamente.
  const [confirmandoAuto, setConfirmandoAuto] = useState(false);
  const [alocandoAuto, setAlocandoAuto] = useState(false);
  // Desfazer a alocacao automatica (12/10/2026): enquanto houver alocacao
  // automatica ativa (e a provisoria nao foi lancada), o botao vira
  // "Desfazer alocação automática".
  const [autoSituacao, setAutoSituacao] = useState({ ativo: false });
  const [confirmandoDesfazerAuto, setConfirmandoDesfazerAuto] = useState(false);
  // "Alocar em lote" de uma area (12/10/2026): o nome da area aberta.
  const [loteArea, setLoteArea] = useState(null);
  // Area cujas cores estao sendo distribuidas (botao "Distribuir cores").
  const [distribuindoCores, setDistribuindoCores] = useState(null);
  // Fixos na area 📌 (13/10/2026, migration 20261013b): o "core" de cada area.
  const [fixas, setFixas] = useState([]);
  const [fixarAberto, setFixarAberto] = useState(null); // null | { eq, area }
  const [limparAreaAberta, setLimparAreaAberta] = useState(null); // nome da area
  const [limpandoArea, setLimpandoArea] = useState(false);
  // Tirar de uma area: { escalaId, nome, area, outras: [{escalaId, area}], fixas }
  const [remocao, setRemocao] = useState(null);
  // Fila: mostrar so quem ficou sem vaga em todas as sugestoes.
  const [soSugestoesCheias, setSoSugestoesCheias] = useState(false);
  // Ordenar a fila (13/10/2026): 'padrao' | 'nome' | 'igreja' | 'area' | 'pastor',
  // crescente ou decrescente. Lembrado neste navegador.
  const [ordemFila, setOrdemFila] = useState(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem('escala_fila_ordem'));
      // Opcao que saiu do menu (ex.: 'sexo') volta para o padrao.
      return salvo && ['padrao', 'nome', 'igreja', 'area', 'pastor'].includes(salvo.campo)
        ? salvo : { campo: 'padrao', desc: false };
    } catch { return { campo: 'padrao', desc: false }; }
  });
  const mudarOrdemFila = (nova) => setOrdemFila(atual => {
    const prox = { ...atual, ...nova };
    try { localStorage.setItem('escala_fila_ordem', JSON.stringify(prox)); } catch { /* sem storage */ }
    return prox;
  });
  const [removendo, setRemovendo] = useState(false);
  // "Escalar tambem em outra area" a partir da busca (13/10/2026): area
  // escolhida e "salvando", por equipante.
  const [tambemArea, setTambemArea] = useState({});
  const [tambemSalvando, setTambemSalvando] = useState({});
  // Atuacao escolhida na busca ao mover (chave escalaId) ou escalar tambem (chave id da pessoa).
  const [atuacaoEscolhida, setAtuacaoEscolhida] = useState({});
  // Na fila: alocar ja marcando como fixo 📌 (por pessoa).
  const [fixarNaFila, setFixarNaFila] = useState({});
  // Fila "A escalar" minimizada: fica so a linha do titulo, para ver a
  // escala enquanto monta. Lembrado neste navegador.
  const [filaMinimizada, setFilaMinimizada] = useState(() => {
    try { return localStorage.getItem('escala_fila_minimizada') === '1'; } catch { return false; }
  });
  const alternarFilaMinimizada = () => setFilaMinimizada(v => {
    try { localStorage.setItem('escala_fila_minimizada', v ? '0' : '1'); } catch { /* sem storage */ }
    return !v;
  });
  // Filtro das areas (13/10/2026): mostrar uma area so e/ou buscar quem esta
  // escalado (nome, CPF, igreja).
  const [areaFiltro, setAreaFiltro] = useState('todas');
  const [buscaNasAreas, setBuscaNasAreas] = useState('');
  const filtroAreasRef = useRef(null);
  const [desfazendoAuto, setDesfazendoAuto] = useState(false);
  const [escalaOrdem, setEscalaOrdem] = useState('aprovacao');

  // Aplicacao das listas de CPF pre-cadastradas -- ver handleAlocarPorCpf,
  // abaixo.
  const [alocandoPorCpf, setAlocandoPorCpf] = useState(false);

  // O cadastro por CPF (um por area em AREAS_ESPECIAIS) morava em
  // Configuracoes -> Areas de Trabalho Especiais e mudou pra ca a pedido:
  // so faz sentido cadastrar perto de quem aplica (handleAlocarPorCpf).
  // Mesmo padrao de estado que o CpfsAreaEspecialManager usava la --
  // carregado uma vez e mantido em sincronia pelos onSave dos gerenciadores
  // (ver handleSaveCpfsAreaEspecial). Comeca vazio -- loadCpfsAreaEspecial
  // preenche uma chave por area assim que a configuracao carrega.
  const [cpfsAreaEspecial, setCpfsAreaEspecial] = useState({});
  // "Pré-cadastro sem CPF" (Configuracoes, 14/10/2026): ligado, quem nao tem
  // CPF pode ser escolhido pelo nome nas Areas Especiais e na Recepção Igreja.
  const [preCadastroSemCpf, setPreCadastroSemCpf] = useState(false);
  const [equipantesParaSelecao, setEquipantesParaSelecao] = useState([]);
  const [carregandoEquipantesParaSelecao, setCarregandoEquipantesParaSelecao] = useState(true);

  const semAcento = (texto) => (texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Ocupacao de cada area (total e por sexo), para saber se as sugestoes de
  // quem esta na fila ainda tem vaga.
  const ocupacaoPorArea = {};
  allocations.forEach(a => {
    const o = (ocupacaoPorArea[a.allocatedArea] ||= { total: 0, Feminino: 0, Masculino: 0 });
    o.total += 1;
    if (a.sexo in o) o[a.sexo] += 1;
  });

  // Inscricao manual que nao completou o cadastro: sem nenhuma das 3 opcoes.
  // Vai sempre a mao e fica no fim da fila (13/10/2026).
  const ehManualSemOpcao = (eq) => !!eq.inscricao_manual_em &&
    ![eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3].some(a => (a || '').trim());

  // Por que cada sugestao nao serve hoje -- mesma regra do Alocar automatico
  // (vaga total, limite por sexo, areas so da diretoria, opcoes que sao so
  // preferencia). Devolve a lista de motivos SO quando nenhuma sugestao serve;
  // se alguma ainda tem vaga (ou a pessoa topa qualquer area), null.
  // Por que esta area nao recebe esta pessoa no automatico (null = recebe).
  // Espelha _equipante_area_tem_vaga: com limite so de um sexo, o outro nao
  // entra.
  const motivoSemVaga = (area, sexo) => {
    const lim = limitsMap[area];
    if (!lim) return AREAS_SO_PREFERENCIA.includes(area) ? 'só preferência, não é área' : 'não é área da escala';
    if (lim.somenteOrganizador) return 'só a diretoria preenche';
    const o = ocupacaoPorArea[area] || { total: 0, Feminino: 0, Masculino: 0 };
    if (o.total >= lim.limiteMaximo) return `cheia (${o.total}/${lim.limiteMaximo})`;
    const mulher = sexo === 'Feminino';
    const limSexo = mulher
      ? (lim.limiteMulheres == null && lim.limiteHomens != null ? 0 : lim.limiteMulheres)
      : (lim.limiteHomens == null && lim.limiteMulheres != null ? 0 : lim.limiteHomens);
    if (limSexo != null && (o[sexo] || 0) >= limSexo) return `sem vaga para ${mulher ? 'mulheres' : 'homens'}`;
    return null;
  };
  const sugestoesSemVaga = (eq) => {
    const opcoes = [eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3]
      .map(a => (a || '').trim()).filter((a, i, t) => a && t.indexOf(a) === i);
    if (opcoes.length === 0) return null;
    const motivos = [];
    for (const area of opcoes) {
      if (area === AREA_DISPONIVEL_QUALQUER) {
        // O coringa manda para qualquer area (fora as da diretoria) com vaga.
        if (Object.keys(limitsMap).some(a => !motivoSemVaga(a, eq.sexo))) return null;
        motivos.push({ area, motivo: 'todas as áreas estão sem vaga' });
        continue;
      }
      const motivo = motivoSemVaga(area, eq.sexo);
      if (!motivo) return null; // esta sugestao ainda tem vaga
      motivos.push({ area, motivo });
    }
    return motivos;
  };
  const semVagaPorPessoa = {};
  waitlist.forEach(eq => { const m = sugestoesSemVaga(eq); if (m) semVagaPorPessoa[eq.id] = m; });
  const totalSugestoesCheias = Object.keys(semVagaPorPessoa).length;
  // O filtro so vale enquanto houver alguem nessa situacao: senao, quando a
  // ultima pessoa marcada fosse alocada, o botao sumiria com o filtro ligado
  // e a fila ficaria vazia sem jeito de desligar.
  const filtroSugestoesCheias = soSugestoesCheias && totalSugestoesCheias > 0;

  // Ordem da fila: primeiro quem ficou sem vaga nas sugestoes (precisa de
  // decisao), depois as inscricoes normais, e no fim as manuais sem opcao.
  // Com outro ordenador escolhido, as manuais sem opcao continuam no fim
  // (a prioridade de visualizacao e de quem se inscreveu normalmente); o resto
  // segue o campo escolhido. Vazio sempre vai para o fim do seu grupo.
  const pesoNaFila = (eq) => (semVagaPorPessoa[eq.id] ? 0 : ehManualSemOpcao(eq) ? 2 : 1);
  const chaveDaFila = {
    nome: (eq) => eq.nome,
    igreja: (eq) => nomeDaIgreja(eq),
    area: (eq) => eq.area_trabalho_opcao1,
  };
  const compararFila = (a, b) => {
    // 'sexo' saiu do menu (13/10/2026, virou "Pastores"): quem tinha ele
    // guardado no navegador cai no padrao.
    const campo = ordemFila.campo === 'pastor' || chaveDaFila[ordemFila.campo] ? ordemFila.campo : 'padrao';
    if (campo === 'padrao') {
      const d = pesoNaFila(a.eq) - pesoNaFila(b.eq);
      return (ordemFila.desc ? -d : d) || a.i - b.i;
    }
    const manual = Number(ehManualSemOpcao(a.eq)) - Number(ehManualSemOpcao(b.eq));
    if (manual) return manual;
    // Pastores (e auxiliares) primeiro; Z→A inverte (pastores por ultimo).
    if (campo === 'pastor') {
      const d = Number(!!tituloPastor(b.eq)) - Number(!!tituloPastor(a.eq));
      return (ordemFila.desc ? -d : d) || (a.eq.nome || '').localeCompare(b.eq.nome || '', 'pt-BR');
    }
    const pega = chaveDaFila[campo];
    const va = (pega(a.eq) || '').trim();
    const vb = (pega(b.eq) || '').trim();
    if (!va !== !vb) return va ? -1 : 1;
    const d = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
    return (ordemFila.desc ? -d : d) || (a.eq.nome || '').localeCompare(b.eq.nome || '', 'pt-BR');
  };
  const filaOrdenada = waitlist
    .map((eq, i) => ({ eq, i }))
    .sort(compararFila)
    .map(x => x.eq)
    .filter(eq => !filtroSugestoesCheias || semVagaPorPessoa[eq.id]);

  const termoBusca = semAcento(buscaFila.trim());
  const digitosBusca = termoBusca.replace(/\D/g, '');
  // Exato primeiro (nome, igreja, CPF, sugestoes); parecido pelo nome so se
  // nada bater exato -- nem na fila, nem entre os ja escalados.
  // casaBusca (utils/busca.js): trecho seguido OU todas as palavras, em qualquer
  // ordem ("Lucio Simas" acha "Lúcio da Costa Simas").
  const casaFilaExato = (eq) => casaBusca(buscaFila, [
    eq.nome, nomeDaIgreja(eq), eq.cpf,
    eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3
  ]);

  // As 3 preferencias da pessoa, sem repeticao e so as que existem hoje
  // como area de verdade (uma preferencia antiga pode ter sido renomeada).
  const preferenciasValidas = (eq) => [
    eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3
  ].filter((a, i, todas) => a && WORK_AREAS.includes(a) && todas.indexOf(a) === i);


  // Quantas areas cada pessoa tem. Uma pessoa pode aparecer em varias
  // tabelas -- nas escalas oficiais ~55 por edicao trabalham em duas areas
  // e algumas em tres.
  // (useMemo: mesma identidade enquanto os dados nao mudam -- a tabela de cada
  // area so se redesenha quando algo dela muda; ver "Desempenho" abaixo.)
  // Desempenho (14/10/2026): estes mapas so mudam quando muda QUEM esta ONDE.
  // Trocar cor ou atuacao nao muda a assinatura, entao as tabelas das outras
  // areas nao se redesenham.
  const assinaturaAreas = allocations.map(a => `${a.id}|${a.allocatedArea}`).join(',');
  const areasPorEquipante = useMemo(() => allocations.reduce((acc, a) => {
    acc[a.id] = (acc[a.id] || 0) + 1;
    return acc;
  }, {}), [assinaturaAreas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nomes das areas de cada pessoa (para a dica do "+1").
  const nomesAreasPorEquipante = useMemo(() => allocations.reduce((acc, a) => {
    (acc[a.id] ||= []).push(a.allocatedArea);
    return acc;
  }, {}), [assinaturaAreas]); // eslint-disable-line react-hooks/exhaustive-deps

  // { equipanteId: [areas fixas] } e { area: [fixos] }.
  const { fixasPorEquipante, fixosPorArea } = useMemo(() => {
    const porEquipante = {};
    const porArea = {};
    fixas.forEach(f => {
      (porEquipante[f.equipante_id] ||= []).push(f.area);
      (porArea[f.area] ||= []).push(f);
    });
    return { fixasPorEquipante: porEquipante, fixosPorArea: porArea };
  }, [fixas]);
  const ehFixoEm = (equipanteId, area) => (fixasPorEquipante[equipanteId] || []).includes(area);

  // Contagem de PESSOAS, nao de participacoes: quem esta em duas areas tem
  // duas linhas em `allocations`, mas e uma pessoa so.
  const pessoasEscaladas = new Set(allocations.map(a => a.id)).size;

  // Depois do lancamento: quem ja abriu "Ver qual área fui escalado" no
  // acompanhamento (area_vista_em, gravado pelo servidor na revelacao).
  // Uma entrada por PESSOA -- quem esta em duas areas conta uma vez.
  const escaladosReais = [...new Map(allocations
    .filter(a => a.allocatedArea !== 'Não será escalado')
    .map(a => [a.id, a])).values()];
  const naoViramArea = escaladosReais.filter(a => !a.area_vista_em);

  // Quantos estao nos tres papeis especiais -- o numero no botao que abre o
  // modulo. E por PARTICIPACAO, mas como ninguem pode ter dois dos tres, da
  // no mesmo que contar pessoas.
  const totalEspeciais = allocations.filter(a => NOMES_ESPECIAIS.includes(a.allocatedArea)).length;
  const totalRecepcaoIgreja = allocations.filter(a => NOMES_RECEPCAO_IGREJA.includes(a.allocatedArea)).length;

  // Resultado da busca "onde o fulano esta?". Agrupa as participacoes por
  // pessoa, para responder numa linha so em vez de obrigar o organizador a
  // varrer as 40 tabelas.
  // Quem esta escalado: uma entrada por pessoa, com todas as areas dela.
  const escaladosPorPessoa = useMemo(() => Object.values(
    allocations.reduce((acc, a) => {
      (acc[a.id] = acc[a.id] || { id: a.id, nome: a.nome, igreja: nomeDaIgreja(a), cpf: a.cpf, areas: [] })
        .areas.push({ area: a.allocatedArea, atuacao: a.atuacao, escalaId: a.escalaId });
      return acc;
    }, {})
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [allocations]);

  // Fila + "ja escalados" da busca da fila (a fila so lista quem nao tem
  // area: quem ja esta escalado aparece embaixo, com onde esta e o "escalar
  // tambem").
  const casaEscaladoDaFila = (x) => casaBusca(buscaFila, [x.nome, x.cpf]);
  let filaFiltrada = filaOrdenada;
  let jaEscaladosDaBuscaFila = [];
  let filaPorParecido = false;
  if (termoBusca) {
    filaFiltrada = filaOrdenada.filter(casaFilaExato);
    jaEscaladosDaBuscaFila = escaladosPorPessoa.filter(casaEscaladoDaFila);
    if (!filaFiltrada.length && !jaEscaladosDaBuscaFila.length) {
      filaFiltrada = filaOrdenada.filter(eq => casaNomeParecido(buscaFila, eq.nome));
      jaEscaladosDaBuscaFila = escaladosPorPessoa.filter(x => casaNomeParecido(buscaFila, x.nome));
      filaPorParecido = filaFiltrada.length + jaEscaladosDaBuscaFila.length > 0;
    }
    jaEscaladosDaBuscaFila = jaEscaladosDaBuscaFila.slice(0, 5);
  }

  const termoEscalados = semAcento(buscaEscalados.trim());
  const { itens: escaladosEncontrados, parecidos: escaladosPorParecido } = !termoEscalados
    ? { itens: [], parecidos: false }
    : filtrarBusca(escaladosPorPessoa, buscaEscalados,
        p => [p.nome, p.igreja, p.cpf, ...p.areas.map(x => x.area)], p => p.nome);

  const previousAllocationsRef = useRef([]);
  const saveTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  // Pedido de recarga que chegou com outra em andamento (13/10/2026). Antes
  // ele era descartado: se a atualizacao automatica de 30s ja tinha lido a
  // escala e o organizador alocava alguem nesse meio-tempo, a tela ficava
  // com o retrato velho por ate 30s -- e o segundo clique dava "já está em".
  // Agora a recarga roda de novo assim que a atual termina.
  const recargaPendenteRef = useRef(false);

  const { toast } = useToast();

  const fetchBackgroundData = async (showLoading = false) => {
    if (isFetchingRef.current) { recargaPendenteRef.current = true; return; }
    isFetchingRef.current = true;
    if (showLoading) setLoadingLimits(true);

    try {
      const [limitsData, existingAllocations, equipantes] = await Promise.all([
        fetchLimitesAreas(),
        fetchAllAllocations(),
        fetchApprovedEquipantes()
      ]);

      setLimitsMap(limitsData);
      setEquipantesAprovados(equipantes || []);

      // Fila e tabelas das areas mudam juntas (antes a fila mudava e as
      // tabelas so depois de mais 4 consultas). Compara com o ref, e nao com
      // `allocations`: esta funcao roda tambem pelo intervalo de 30s, criado
      // no primeiro desenho, e la `allocations` e a lista daquele momento.
      const idsAlocados = new Set((existingAllocations || []).map(a => a.id));
      setWaitlist((equipantes || []).filter(eq => !idsAlocados.has(eq.id)));
      if (existingAllocations) {
        const changed = detectAllocationChanges(existingAllocations, previousAllocationsRef.current);
        if (changed.length > 0 || previousAllocationsRef.current.length !== existingAllocations.length) {
          setAllocations(existingAllocations);
          previousAllocationsRef.current = [...existingAllocations];
        }
      }

      setAguardandoAprovacao(await contarAguardandoAprovacao());
      setEscala(await fetchSituacaoEscala());
      setAutoSituacao(await fetchSituacaoAlocacaoAutomatica());
      setFixas(await fetchAreasFixas());
    } catch (error) {
      console.error("Background fetch error:", error);
    } finally {
      isFetchingRef.current = false;
      if (showLoading) setLoadingLimits(false);
      if (recargaPendenteRef.current) {
        recargaPendenteRef.current = false;
        fetchBackgroundData(false);
      }
    }
  };

  const loadInitialData = async () => {
    setLoadingLimits(true);
    const schemaCheck = await verifyDatabaseSchema();
    setDbVerification({
      checked: true,
      valid: schemaCheck.valid
    });
    if (!schemaCheck.valid) {
      toast({
        title: "Problema no Banco de Dados",
        description: "Algumas tabelas não foram encontradas.",
        variant: "destructive"
      });
    }
    setAtuacoesPorArea(await fetchAtuacoesPorArea());
    await fetchBackgroundData(false);
    setLoadingLimits(false);
  };

  // Troca a atuação de uma pessoa dentro da área (Líder, Traficante,
  // Fila / Confronto...). Atualiza a tela na hora e só depois confirma com
  // o banco -- se o banco recusar, volta ao que era e avisa.
  const handleDefinirAtuacao = async (escalaId, novaAtuacao) => {
    const anterior = allocations.find(a => a.escalaId === escalaId)?.atuacao ?? null;
    const corAnterior = allocations.find(a => a.escalaId === escalaId)?.cor ?? null;
    if (anterior === novaAtuacao) return;

    setSalvandoAtuacao(prev => ({ ...prev, [escalaId]: true }));
    const areaDaLinha = allocations.find(a => a.escalaId === escalaId)?.allocatedArea;
    const apagaCor = (atuacoesPorArea[areaDaLinha] || []).some(x => x.atuacao === novaAtuacao && x.semCor);
    setAllocations(prev => prev.map(a => (a.escalaId === escalaId ? { ...a, atuacao: novaAtuacao, ...(apagaCor ? { cor: null } : {}) } : a)));
    // Mantém o "antes" alinhado com o "agora": sem isso o efeito de
    // auto-save enxergaria uma diferença e tentaria regravar a escala.
    previousAllocationsRef.current = previousAllocationsRef.current.map(
      a => (a.escalaId === escalaId ? { ...a, atuacao: novaAtuacao } : a)
    );

    const resultado = await definirAtuacao(escalaId, novaAtuacao);

    if (!resultado.success) {
      setAllocations(prev => prev.map(a => (a.escalaId === escalaId ? { ...a, atuacao: anterior, cor: corAnterior } : a)));
      previousAllocationsRef.current = previousAllocationsRef.current.map(
        a => (a.escalaId === escalaId ? { ...a, atuacao: anterior } : a)
      );
      toast({
        title: "Não foi possível salvar a atuação",
        description: resultado.error,
        variant: "destructive"
      });
    } else if (areaDaLinha === GUIA_TAMBEM_EM) {
      // Regra dos Guias: voltando para uma atuacao com cor, a Recepção
      // herda a cor do Guia (o banco faz; a tela busca de novo).
      fetchBackgroundData(false);
    }

    setSalvandoAtuacao(prev => ({ ...prev, [escalaId]: false }));
  };

  // Cor do grupo de trilha. Vale so nas nove areas que trabalham divididas
  // por cor, e e opcional -- "Sem cor" e uma resposta legitima.
  // A cor aparece na hora (14/10/2026, como a atuacao) e so depois confirma
  // com o banco; se o banco recusar, volta ao que era e avisa.
  const handleDefinirCor = async (escalaId, novaCor) => {
    // Regra dos Guias: o banco muda a cor do outro lado (Guia <-> Recepção
    // Sítio); a tela acompanha.
    const linha = allocations.find(a => a.escalaId === escalaId);
    if (!linha || (linha.cor || null) === (novaCor || null)) return;
    const semCorNaRecepcao = (a) => (atuacoesPorArea[GUIA_TAMBEM_EM] || []).some(x => x.atuacao === a.atuacao && x.semCor);
    const ehPar = (a) => a.id === linha.id && a.escalaId !== escalaId && (
      (linha.allocatedArea === AREA_GUIA && a.allocatedArea === GUIA_TAMBEM_EM && !semCorNaRecepcao(a)) ||
      (linha.allocatedArea === GUIA_TAMBEM_EM && a.allocatedArea === AREA_GUIA && !semCorNaRecepcao(linha)));
    const antes = Object.fromEntries(allocations
      .filter(a => a.escalaId === escalaId || ehPar(a)).map(a => [a.escalaId, a.cor ?? null]));
    setAllocations(prev => prev.map(a => (a.escalaId in antes ? { ...a, cor: novaCor || null } : a)));
    const desfazer = () => setAllocations(prev => prev.map(a => (a.escalaId in antes ? { ...a, cor: antes[a.escalaId] } : a)));

    setSalvandoCor(prev => ({ ...prev, [escalaId]: true }));
    try {
      const r = await definirCor(escalaId, novaCor);
      if (!r?.ok) {
        desfazer();
        toast({ title: 'Não deu certo', description: r?.erro, variant: 'destructive' });
      }
    } catch (error) {
      desfazer();
      toast({
        title: 'Erro ao definir a cor',
        description: error.message || 'Tente de novo.',
        variant: 'destructive'
      });
    } finally {
      setSalvandoCor(prev => ({ ...prev, [escalaId]: false }));
    }
  };

  // Regra de ordem da alocacao automatica (so para o aviso do dialogo).
  useEffect(() => {
    if (confirmandoAuto) fetchEscalaOrdem().then(setEscalaOrdem).catch(() => {});
  }, [confirmandoAuto]);

  useEffect(() => {
    loadInitialData();
    loadCpfsAreaEspecial();
    loadEquipantesParaSelecao();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => fetchBackgroundData(false), 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (allocations.length === 0) return;
    const changes = detectAllocationChanges(allocations, previousAllocationsRef.current);
    if (changes.length > 0) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => handleAutoSave(changes), 800);
    }
  }, [allocations]);

  const attemptSaveWithRetry = async (changesToSave, retries = 2, delay = 2000) => {
    try {
      const response = await saveScales(changesToSave);
      if (!response.success) throw new Error(response.error);
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptSaveWithRetry(changesToSave, retries - 1, delay);
      }
      throw error;
    }
  };

  const updateWorkScheduleForAllocations = async savedAllocations => {
    try {
      const cpfsToUpdate = [...new Set(savedAllocations.filter(allocation => allocation.cpf && allocation.allocatedArea && allocation.allocatedArea !== 'Pendente de Alocação Manual').map(allocation => allocation.cpf))];
      if (cpfsToUpdate.length === 0) {
        return {
          success: true,
          message: 'Nenhum CPF para atualizar'
        };
      }

      const result = await batchUpdateWorkScheduleStatus(cpfsToUpdate);
      if (result.success) {
        const totalProcessed = result.updated + result.alreadyUpdated;
        if (totalProcessed > 0) {
          if (result.updated > 0) {
            toast({
              title: "Status de Escala Atualizado",
              description: `${result.updated} equipante(s) com status de escala confirmado.`,
              className: "bg-green-600 text-white"
            });
          }
        }
        if (result.failed > 0) {
          console.error(`[updateWorkScheduleForAllocations] ${result.failed} failed updates:`, result.errors);
          toast({
            title: "Aviso",
            description: `${result.failed} equipante(s) não puderam ter o status de escala atualizado.`,
            variant: "destructive"
          });
        }
      } else {
        console.error('[updateWorkScheduleForAllocations] Batch update failed:', result.error);
      }
      return result;
    } catch (error) {
      console.error('[updateWorkScheduleForAllocations] Unexpected error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  const handleAutoSave = async changesToSave => {
    if (changesToSave.length === 0) return;
    setSaveStatus('saving');
    try {
      await attemptSaveWithRetry(changesToSave);
      previousAllocationsRef.current = [...allocations];
      setSaveStatus('success');

      await updateWorkScheduleForAllocations(changesToSave);
      fetchBackgroundData(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error.message || 'Erro de conexão');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  const handleUpdateLimit = async (areaName, newLimit, limitMulheres, limitHomens) => {
    try {
      await saveLimiteAreaComGenero(areaName, newLimit, limitMulheres, limitHomens);
      setLimitsMap(prev => ({
        ...prev,
        [areaName]: {
          limiteMaximo: parseInt(newLimit),
          limiteMulheres: limitMulheres !== null ? parseInt(limitMulheres) : null,
          limiteHomens: limitHomens !== null ? parseInt(limitHomens) : null
        }
      }));
      fetchBackgroundData(false);
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Alocacao manual de quem esta na lista de espera. A funcao do banco
  // confere a vaga de novo, na hora (mesma trava de concorrencia da
  // automatica) — por isso "sucesso: false" pode acontecer mesmo que a tela
  // achasse que havia vaga (ex: outro organizador ocupou um instante antes).
  const handleManualAllocate = async (equipanteId, nomeEquipante) => {
    const areas = areasDaFila[equipanteId] || [];
    if (areas.length === 0) {
      toast({ title: "Escolha ao menos uma área", variant: "destructive" });
      return;
    }
    setManualAllocating(prev => ({ ...prev, [equipanteId]: true }));
    try {
      // Uma chamada por area, em sequencia. Cada uma passa pela checagem de
      // vaga e de limite por sexo -- pode ser que a primeira caiba e a
      // segunda nao, e nesse caso a pessoa fica com a que coube.
      const feitas = [];
      const falhas = [];
      for (const area of areas) {
        const r = await comAvisoDeLimite((forcar) => alocarEquipanteManualmente(equipanteId, area, forcar), area, nomeEquipante);
        if (r.success) feitas.push(area); else if (!r.cancelado) falhas.push(`${area}: ${r.error}`);
      }

      // "Alocar como fixo 📌": a pessoa ja esta na area, entao so marca.
      const fixou = [];
      if (fixarNaFila[equipanteId]) {
        for (const area of feitas.filter(a => a !== 'Não será escalado')) {
          const r = await marcarAreaFixa(equipanteId, area, true);
          if (r.success) fixou.push(area); else falhas.push(`fixo em ${area}: ${r.error}`);
        }
        setFixarNaFila(prev => { const n = { ...prev }; delete n[equipanteId]; return n; });
      }

      if (feitas.length > 0) {
        toast({
          title: feitas.length === 1 ? "Alocado" : `Alocado em ${feitas.length} áreas`,
          description: `${nomeEquipante} → ${feitas.join(' + ')}.` +
            (fixou.length ? ` 📌 Fixo em ${fixou.join(', ')}.` : '') +
            (falhas.length ? ` Não coube em: ${falhas.join(' · ')}` : ''),
          className: falhas.length ? undefined : "bg-green-600 text-white",
          variant: falhas.length ? "destructive" : undefined
        });
        setAreasDaFila(prev => { const n = { ...prev }; delete n[equipanteId]; return n; });
        fetchBackgroundData(false);
      } else if (falhas.length > 0) {
        toast({
          title: "Não foi possível alocar",
          description: falhas.join(' · '),
          variant: "destructive"
        });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [equipanteId]: false }));
    }
  };

  // Alocacao manual com area cheia (13/10/2026): o limite so avisa. tentar(forcar)
  // faz a chamada; sem vaga, pergunta e repete com forcar = true.
  const comAvisoDeLimite = async (tentar, area, nome) => {
    const r = await tentar(false);
    if (r.success || !r.semVaga) return r;
    const ok = window.confirm(
      `${area}: ${r.error}.\n\nAlocar ${nome} mesmo assim? Na alocação manual o limite é só aviso.`
    );
    return ok ? tentar(true) : { ...r, cancelado: true };
  };

  // Acrescenta uma area sem tirar das atuais. Usado pela busca e pelo chip
  // do pre-cadastro das Areas Especiais.
  const acrescentarArea = async (equipanteId, nomeBruto, area, areasAtuais, atuacao = null) => {
    const nome = formatNomeExibicao(nomeBruto);
    const r = await comAvisoDeLimite((forcar) => alocarEquipanteManualmente(equipanteId, area, forcar), area, nome);
    if (r.success) {
      const aviso = await gravarAtuacaoEscolhida(equipanteId, area, atuacao);
      toast({
        title: `Escalado também em ${area}`,
        description: `${nome} agora está em ${[...areasAtuais, area].join(' + ')}${atuacao && !aviso ? ` (${atuacao})` : ''}.${aviso ? ` ${aviso}` : ''}`,
        className: aviso ? undefined : 'bg-green-600 text-white',
        variant: aviso ? 'destructive' : undefined
      });
      await fetchBackgroundData(false);
    } else if (!r.cancelado) {
      toast({ title: 'Não foi possível escalar', description: r.error, variant: 'destructive' });
    }
    return r.success;
  };

  // Atuacao escolhida na busca: depois de mover/acrescentar, grava a atuacao
  // (a area ja nasce com a padrao). Devolve uma mensagem se nao conseguiu.
  const gravarAtuacaoEscolhida = async (equipanteId, area, atuacao) => {
    if (!atuacao) return null;
    const r = await definirAtuacaoNaArea(equipanteId, area, atuacao);
    return r.success ? null : `Mas não deu para definir a atuação “${atuacao}”: ${r.error}`;
  };

  const handleEscalarTambem = async (pessoa) => {
    const area = tambemArea[pessoa.id];
    if (!area) {
      toast({ title: 'Escolha a área', variant: 'destructive' });
      return;
    }
    setTambemSalvando(prev => ({ ...prev, [pessoa.id]: true }));
    try {
      if (await acrescentarArea(pessoa.id, pessoa.nome, area, pessoa.areas.map(x => x.area), atuacaoEscolhida[pessoa.id] || null)) {
        setTambemArea(prev => { const n = { ...prev }; delete n[pessoa.id]; return n; });
        setAtuacaoEscolhida(prev => { const n = { ...prev }; delete n[pessoa.id]; return n; });
      }
    } finally {
      setTambemSalvando(prev => ({ ...prev, [pessoa.id]: false }));
    }
  };

  // Chip do pre-cadastro (Areas Especiais): areas comuns da pessoa e o acrescimo.
  const areasComunsDoCpf = (cpf) => allocations
    .filter(a => pessoaTemChave(a, cpf) && !NOMES_ESPECIAIS.includes(a.allocatedArea) && a.allocatedArea !== 'Não será escalado')
    .map(a => a.allocatedArea);
  // No modulo Recepção Igreja (sem exclusividade): todas as outras areas da pessoa.
  const outrasAreasDoCpf = (label) => (cpf) => allocations
    .filter(a => pessoaTemChave(a, cpf) && a.allocatedArea !== label && a.allocatedArea !== 'Não será escalado')
    .map(a => a.allocatedArea);
  const handleEscalarTambemPorCpf = async (cpf, area) => {
    const eq = (equipantesAprovados || []).find(e => pessoaTemChave(e, cpf));
    if (!eq) { toast({ title: 'Equipante não encontrado', variant: 'destructive' }); return; }
    await acrescentarArea(eq.id, eq.nome, area, allocations.filter(a => a.id === eq.id).map(a => a.allocatedArea));
  };

  // A linha "onde esta + escalar tambem em outra area". Usada na busca "Onde
  // alguem esta escalado" e no aviso da fila quando a pessoa ja tem area.
  // Mudou (ou limpou) a busca: o que ficou escolhido mas nao confirmado --
  // "mover para", "escalar tambem em" e a atuacao -- volta ao "Escolher a
  // area..." (17/10/2026). Mexe so nas pessoas que estavam na tela.
  const mudarBuscaEscalados = (valor) => {
    const some = (prev, chaves) => {
      if (!chaves.some(k => k in prev)) return prev;
      const n = { ...prev };
      chaves.forEach(k => { delete n[k]; });
      return n;
    };
    const idsEscala = escaladosEncontrados.flatMap(p => p.areas.map(x => x.escalaId));
    const idsPessoa = escaladosEncontrados.map(p => p.id);
    setManualAreaChoice(prev => some(prev, idsEscala));
    setTambemArea(prev => some(prev, idsPessoa));
    setAtuacaoEscolhida(prev => some(prev, [...idsEscala, ...idsPessoa]));
    setBuscaEscalados(valor);
  };

  // Atuacao na area de destino (17/10/2026): so aparece quando a area tem mais
  // de uma. Sem escolher, fica a padrao (a primeira da lista).
  const seletorDeAtuacao = (areaDestino, valor, aoEscolher) => {
    const lista = areaDestino ? (atuacoesPorArea[areaDestino] || []) : [];
    if (lista.length < 2) return null;
    const padrao = lista.find(a => a.ehPadrao)?.atuacao || lista[0].atuacao;
    return (
      <Select value={valor || padrao} onValueChange={aoEscolher}>
        <SelectTrigger className="h-8 w-[170px] bg-black/40 border-white/20 text-white text-xs"
          data-dica={`Atuação em ${areaDestino}. Sem escolher, fica a padrão (${padrao}).`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {lista.map(a => <SelectItem key={a.atuacao} value={a.atuacao}>{a.ehLider ? `★ ${a.atuacao}` : a.atuacao}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  };

  const renderEscaladoComAcao = (pessoa) => {
    const jaEspecial = pessoa.areas.some(x => NOMES_ESPECIAIS.includes(x.area));
    const estaEmNaoSera = pessoa.areas.some(x => x.area === 'Não será escalado');
    const opcoes = WORK_AREAS.filter(a =>
      a !== 'Não será escalado' && !pessoa.areas.some(x => x.area === a) && !(jaEspecial && NOMES_ESPECIAIS.includes(a)));
    return (
      <div key={pessoa.id} className="bg-white/5 border border-white/10 rounded-md p-3 flex flex-col gap-2">
        {/* As areas ficam coladas ao lado do nome (17/10/2026), nao la na ponta. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2">
          <div className="min-w-0 sm:max-w-[60%]">
            <p className="text-white text-sm font-medium truncate flex items-center gap-1.5">
              <span className="truncate">{pessoa.nome}</span>
              {pessoa.areas.length > 1 && (
                <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {pessoa.areas.length} áreas
                </span>
              )}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{pessoa.igreja || '—'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pessoa.areas.map(x => (
              <span key={x.escalaId} className="text-[11px] px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-200">
                {x.area}
                {x.atuacao && <span className="text-green-400/70"> · {x.atuacao}</span>}
              </span>
            ))}
          </div>
        </div>
        {/* Gerenciar cada participacao (17/10/2026, pedido da direcao): mover
            para outra area ou tirar da area, sem sair da busca. */}
        {podeGerir && pessoa.areas.map(x => (
          <div key={x.escalaId} className="flex items-center gap-2 flex-wrap border-t border-white/10 pt-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 shrink-0">
              Mover de <strong className="text-gray-300">{x.area}</strong> para
            </span>
            <Select value={manualAreaChoice[x.escalaId] || ''} onValueChange={(v) => { setManualAreaChoice(prev => ({ ...prev, [x.escalaId]: v })); setAtuacaoEscolhida(prev => { const n = { ...prev }; delete n[x.escalaId]; return n; }); }}>
              <SelectTrigger className="h-8 w-[210px] bg-black/40 border-white/20 text-white text-xs">
                <SelectValue placeholder="Escolher a área..." />
              </SelectTrigger>
              <SelectContent>
                {WORK_AREAS.filter(a => a !== x.area).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {seletorDeAtuacao(manualAreaChoice[x.escalaId], atuacaoEscolhida[x.escalaId], (v) => setAtuacaoEscolhida(prev => ({ ...prev, [x.escalaId]: v })))}
            <Button size="sm" onClick={() => handleRealocar(x.escalaId, formatNomeExibicao(pessoa.nome), x.area, atuacaoEscolhida[x.escalaId] || null)}
              disabled={!manualAreaChoice[x.escalaId] || manualAllocating[x.escalaId]}
              data-dica={`Tirar ${formatNomeExibicao(pessoa.nome)} de ${x.area} e colocar na área escolhida.`}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs disabled:bg-white/5 disabled:text-white/40 disabled:border disabled:border-white/20">
              {manualAllocating[x.escalaId] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mover'}
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => handleRemover(x.escalaId, pessoa.nome, x.area, true)}
              disabled={manualAllocating[x.escalaId]}
              data-dica={`Tirar ${formatNomeExibicao(pessoa.nome)} só de ${x.area}. Tira direto; só pede confirmação se for fixo 📌 nesta área.`}
              className="h-8 px-2 ml-auto text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <X className="h-4 w-4 mr-1" />Remover de {x.area}
            </Button>
          </div>
        ))}
        {podeGerir && !estaEmNaoSera && (
          <div className="flex items-center gap-2 flex-wrap border-t border-white/10 pt-2">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 shrink-0">Escalar também em</span>
            <Select value={tambemArea[pessoa.id] || ''} onValueChange={(v) => { setTambemArea(prev => ({ ...prev, [pessoa.id]: v })); setAtuacaoEscolhida(prev => { const n = { ...prev }; delete n[pessoa.id]; return n; }); }}>
              <SelectTrigger className="h-8 w-[210px] bg-black/40 border-white/20 text-white text-xs">
                <SelectValue placeholder="Escolher a outra área..." />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {seletorDeAtuacao(tambemArea[pessoa.id], atuacaoEscolhida[pessoa.id], (v) => setAtuacaoEscolhida(prev => ({ ...prev, [pessoa.id]: v })))}
            <Button size="sm" onClick={() => handleEscalarTambem(pessoa)}
              disabled={!tambemArea[pessoa.id] || tambemSalvando[pessoa.id]}
              data-dica={`Acrescentar a área escolhida sem tirar ${formatNomeExibicao(pessoa.nome)} de ${pessoa.areas.map(x => x.area).join(' e ')}.`}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs">
              {tambemSalvando[pessoa.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Escalar também</>}
            </Button>
            {jaEspecial && <span className="text-[11px] text-gray-500">Já está numa área especial: só áreas comuns aqui.</span>}
          </div>
        )}
      </div>
    );
  };

  const alternarAreaDaFila = (equipanteId, area) => {
    setAreasDaFila(prev => {
      const atuais = prev[equipanteId] || [];
      if (atuais.includes(area)) {
        return { ...prev, [equipanteId]: atuais.filter(a => a !== area) };
      }
      if (atuais.length >= MAX_AREAS_DE_UMA_VEZ) {
        toast({
          title: `No máximo ${MAX_AREAS_DE_UMA_VEZ} áreas de uma vez`,
          description: 'Tire uma das escolhidas para trocar.',
          variant: "destructive"
        });
        return prev;
      }
      return { ...prev, [equipanteId]: [...atuais, area] };
    });
  };

  // Realocacao de quem JA esta alocado (diferente de handleManualAllocate,
  // que so serve pra lista de espera). Reaproveita os mesmos states
  // manualAreaChoice/manualAllocating (chaveados por escalaId nas areas e
  // por equipanteId na fila) -- nao ha
  // colisao possivel entre um id da lista de espera e um id ja alocado, e
  // assim evita duplicar state so pra isso.
  // Move UMA participacao de area. Endereçada pelo id da linha em escalas
  // (escalaId): como a mesma pessoa pode estar em mais de uma area,
  // "realocar o fulano" deixou de ser sem ambiguidade.
  const handleRealocar = async (escalaId, nomeEquipante, areaAtual, atuacao = null) => {
    const novaArea = manualAreaChoice[escalaId];
    if (!novaArea) {
      toast({ title: "Escolha a área de destino", variant: "destructive" });
      return;
    }
    const idDaPessoa = allocations.find(a => a.escalaId === escalaId)?.id;
    if (ehFixoEm(idDaPessoa, areaAtual) && !window.confirm(
      `${nomeEquipante} é fixo(a) 📌 em ${areaAtual}.\n\nMover para ${novaArea} mesmo assim? ` +
      'A marca de fixo continua (dá para mudar no alfinete).'
    )) return;
    setManualAllocating(prev => ({ ...prev, [escalaId]: true }));
    try {
      const resultado = await comAvisoDeLimite((forcar) => realocarAlocacao(escalaId, novaArea, forcar), novaArea, nomeEquipante);
      if (resultado.success) {
        const aviso = await gravarAtuacaoEscolhida(idDaPessoa, novaArea, atuacao);
        toast({
          title: "Movido",
          description: `${nomeEquipante}: ${areaAtual} → ${novaArea}${atuacao && !aviso ? ` (${atuacao})` : ''}.${aviso ? ` ${aviso}` : ''}`,
          className: aviso ? undefined : "bg-green-600 text-white",
          variant: aviso ? "destructive" : undefined
        });
        setManualAreaChoice(prev => { const n = { ...prev }; delete n[escalaId]; return n; });
        setAtuacaoEscolhida(prev => { const n = { ...prev }; delete n[escalaId]; return n; });
        fetchBackgroundData(false);
      } else if (!resultado.cancelado) {
        toast({ title: "Não foi possível mover", description: resultado.error, variant: "destructive" });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [escalaId]: false }));
    }
  };

  // Escala a pessoa TAMBEM em outra area, sem tirar da atual. Nas escalas
  // oficiais ~55 pessoas por edicao trabalham em duas.
  const handleAdicionarArea = async (equipanteId, escalaId, nomeEquipante) => {
    const novaArea = manualAreaChoice[escalaId];
    if (!novaArea) {
      toast({ title: "Escolha a área", variant: "destructive" });
      return;
    }
    setManualAllocating(prev => ({ ...prev, [escalaId]: true }));
    try {
      const resultado = await comAvisoDeLimite((forcar) => alocarEquipanteManualmente(equipanteId, novaArea, forcar), novaArea, nomeEquipante);
      if (resultado.success) {
        toast({
          title: `Escalado também em ${novaArea}`,
          description: `${nomeEquipante} agora trabalha em mais de uma área.`,
          className: "bg-green-600 text-white"
        });
        setManualAreaChoice(prev => { const n = { ...prev }; delete n[escalaId]; return n; });
        fetchBackgroundData(false);
      } else if (!resultado.cancelado) {
        toast({ title: "Não foi possível escalar", description: resultado.error, variant: "destructive" });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [escalaId]: false }));
    }
  };

  // Tirar de uma area SEMPRE pergunta (13/10/2026): antes, quem estava em
  // duas areas saia com um clique so, sem confirmacao -- e o X aparece nas
  // duas tabelas. Agora a janela diz em que outras areas a pessoa esta e
  // pergunta se tira de la tambem (Sim / Não).
  // daBusca (17/10/2026): no quadro "Onde alguem esta escalado" cada area tem o
  // seu proprio "Remover de ...", entao nao pergunta das outras areas. So
  // abre a janela de aviso se a pessoa e fixa (📌) nesta area (ou se tirar
  // daqui quebra a regra dos Guias); fora isso, tira direto.
  const handleRemover = (escalaId, nomeEquipante, areaAtual, daBusca = false) => {
    const idDaPessoa = allocations.find(a => a.escalaId === escalaId)?.id;
    const todasOutras = allocations
      .filter(a => a.id === idDaPessoa && a.escalaId !== escalaId)
      .map(a => ({ escalaId: a.escalaId, area: a.allocatedArea, regraGuia: !!a.regraGuia }));
    // Regra dos Guias: saindo do Guia, a Recepção Sítio que a regra criou
    // sai junto (o banco faz) -- nao entra na pergunta "tirar de la tambem?".
    const juntoRegra = areaAtual === AREA_GUIA ? todasOutras.filter(o => o.regraGuia).map(o => o.area) : [];
    const outras = todasOutras.filter(o => !juntoRegra.includes(o.area));
    const avisoGuia = areaAtual === GUIA_TAMBEM_EM && outras.some(o => o.area === AREA_GUIA);
    if (daBusca) {
      const pedido = {
        escalaId, nome: formatNomeExibicao(nomeEquipante), area: areaAtual, outras: [], juntoRegra,
        ficamEm: outras.map(o => o.area), soEstaArea: true, avisoGuia,
        fixas: (fixasPorEquipante[idDaPessoa] || []).filter(a => a === areaAtual)
      };
      if (pedido.fixas.length === 0 && !avisoGuia) executarRemocao(false, pedido);
      else setRemocao(pedido);
      return;
    }
    setRemocao({
      escalaId, nome: formatNomeExibicao(nomeEquipante), area: areaAtual, outras, juntoRegra,
      avisoGuia,
      fixas: (fixasPorEquipante[idDaPessoa] || []).filter(a => a === areaAtual || outras.some(o => o.area === a))
    });
  };

  const executarRemocao = async (tambemOutras, pedido = null) => {
    const r0 = pedido || remocao;
    if (!r0) return;
    const alvos = [{ escalaId: r0.escalaId, area: r0.area }, ...(tambemOutras ? r0.outras : [])];
    setRemovendo(true);
    const saiu = [];
    const falhas = [];
    let restam = r0.outras.length;
    for (const alvo of alvos) {
      const r = await removerAlocacao(alvo.escalaId);
      if (r.success) {
        saiu.push(alvo.area);
        if (alvo.area === AREA_GUIA) saiu.push(...(r0.juntoRegra || []));
        restam = r.restam;
      } else falhas.push(`${alvo.area}: ${r.error}`);
    }
    setRemovendo(false);
    setRemocao(null);
    if (saiu.length > 0) {
      toast({
        title: `Removido de ${saiu.join(', ')}`,
        description: (restam > 0
          ? `${r0.nome} continua em ${(r0.ficamEm || r0.outras.map(o => o.area)).filter(a => !saiu.includes(a)).join(', ')}.`
          : `${r0.nome} voltou para a fila "A escalar".`) +
          (falhas.length ? ` Não saiu de: ${falhas.join(' · ')}` : ''),
        variant: falhas.length ? 'destructive' : undefined
      });
      fetchBackgroundData(false);
    } else {
      toast({ title: "Não foi possível remover", description: falhas.join(' · '), variant: "destructive" });
    }
  };

  // Distribui a fila inteira pelas 3 preferencias. Quem decide e o banco
  // (alocar_fila_automaticamente); aqui so contamos a historia de volta.
  const handleAlocarAutomatico = async () => {
    setAlocandoAuto(true);
    const r = await alocarFilaAutomaticamente();
    setAlocandoAuto(false);
    setConfirmandoAuto(false);

    if (!r.success) {
      toast({ title: 'Não foi possível alocar', description: r.error, variant: 'destructive' });
      return;
    }

    const detalhe = [
      r.fixos > 0 && `📌 ${r.fixos} ${r.fixos === 1 ? 'fixo' : 'fixos'} nas suas áreas`,
      r.opcao1 > 0 && `${r.opcao1} na 1ª opção`,
      r.opcao2 > 0 && `${r.opcao2} na 2ª`,
      r.opcao3 > 0 && `${r.opcao3} na 3ª`,
      r.pastores > 0 && `${r.pastores} no Pastor Invisível`,
      r.coringa > 0 && `${r.coringa} de "qualquer área"`,
      r.semOpcaoAlocados > 0 && `${r.semOpcaoAlocados} sem opção (inscrição manual) numa área com vaga`,
      r.foraDasOpcoes > 0 && `${r.foraDasOpcoes} fora das opções (as 3 estavam cheias)`
    ].filter(Boolean).join(', ');

    toast({
      title: r.alocados === 0 ? 'Ninguém foi alocado' : `${r.alocados} alocado(s)`,
      description: [
        detalhe,
        r.opcoesCheias > 0 && `⚠ ${r.opcoesCheias} ${r.opcoesCheias === 1 ? 'pessoa não foi escalada' : 'pessoas não foram escaladas'}: todas as áreas que ${r.opcoesCheias === 1 ? 'pediu' : 'pediram'} já estavam cheias. ${r.opcoesCheias === 1 ? 'Está marcada' : 'Estão marcadas'} em "A escalar" — coloque à mão`,
        r.semOpcao > 0 && `${r.semOpcao} ${r.semOpcao === 1 ? 'inscrição manual sem as opções de área fica' : 'inscrições manuais sem as opções de área ficam'} para colocar à mão`,
        r.acimaDoLimite?.length > 0 && `Passaram do limite por causa dos fixos: ${r.acimaDoLimite.join(', ')}`
      ].filter(Boolean).join('. ') || 'A fila já estava vazia.',
      className: r.alocados > 0 && !r.opcoesCheias ? 'bg-green-600 text-white' : undefined,
      duration: r.opcoesCheias > 0 ? 15000 : undefined
    });

    if (r.opcoesCheias > 0) setSoSugestoesCheias(true);
    fetchBackgroundData(false);
  };

  // Distribuir cores (14/10/2026): quem esta na area sem cor ganha a cor com
  // menos gente (e, no empate, menos gente do mesmo sexo). Quem ja tem cor fica.
  // So nestas: em Guia/Recepção Sítio a cor e o grupo do Guia (sincronizada
  // entre as duas), escolhida a dedo.
  const AREAS_DISTRIBUIR_CORES = ['Invisível', 'Marcador', 'Pastor Invisível'];
  const handleDistribuirCores = async (area) => {
    setDistribuindoCores(area);
    const r = await distribuirCoresArea(area);
    setDistribuindoCores(null);
    if (!r.success) {
      toast({ title: 'Não foi possível distribuir as cores', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: r.coloridos > 0 ? `${r.coloridos} pessoa(s) ganharam cor em ${area}` : 'Ninguém sem cor',
      description: 'Equilibrado por quantidade e por homens/mulheres em cada cor.',
      className: 'bg-green-600 text-white'
    });
    fetchBackgroundData(false);
  };

  // Pastor Invisível ainda com vaga: o Alocar automático completa com pastores
  // mesmo com a fila vazia (14/10/2026).
  const faltaPastorInvisivel = Math.max(0,
    getLimiteAreaComGenero('Pastor Invisível', limitsMap, 0).limiteMaximo
    - allocations.filter(a => a.allocatedArea === 'Pastor Invisível').length);

  // So quando ainda ha alguem para desfazer: se todos foram mexidos a mao (ou
  // a area foi limpa), o botao nao faria nada.
  // (17/10/2026: desfaz UMA rodada por vez, a ultima; se a ultima ja foi toda mexida
  // a mao, ainda da para desfaze-la para chegar na anterior.)
  const autoAtivo = !!(autoSituacao?.ativo && autoSituacao?.pode_desfazer
    && (autoSituacao?.no_lugar > 0 || autoSituacao?.lotes > 1));

  const handleLimparArea = async () => {
    const area = limparAreaAberta;
    setLimpandoArea(true);
    const r = await limparArea(area);
    setLimpandoArea(false);
    setLimparAreaAberta(null);
    if (!r.success) {
      toast({ title: 'Não foi possível limpar a área', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: `${area} limpa`,
      description: `${r.removidos} ${r.removidos === 1 ? 'pessoa saiu' : 'pessoas saíram'}` +
        (r.voltaramFila > 0 ? `; ${r.voltaramFila} ${r.voltaramFila === 1 ? 'voltou' : 'voltaram'} para a fila "A escalar".` : '.') +
        (r.guiasMantidos > 0 ? ` ${r.guiasMantidos} ${r.guiasMantidos === 1 ? 'Guia continua' : 'Guias continuam'} (regra).` : '')
    });
    fetchBackgroundData(false);
  };

  const handleDesfazerAutomatico = async () => {
    setDesfazendoAuto(true);
    const r = await desfazerAlocacaoAutomatica();
    setDesfazendoAuto(false);
    setConfirmandoDesfazerAuto(false);
    if (!r.success) {
      toast({ title: 'Não foi possível desfazer', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: r.restantes > 0 ? 'Última alocação automática desfeita' : 'Alocação automática desfeita',
      description: [
        `${r.desfeitos} ${r.desfeitos === 1 ? 'voltou' : 'voltaram'} para a fila "A escalar"`,
        r.mantidos > 0 && `${r.mantidos} ${r.mantidos === 1 ? 'ficou onde está (foi mexido' : 'ficaram onde estão (foram mexidos'} à mão depois)`,
        r.restantes > 0 && `Ainda ${r.restantes === 1 ? 'há 1 rodada anterior' : `há ${r.restantes} rodadas anteriores`}: clique de novo para desfazer a anterior`,
      ].filter(Boolean).join('. ') + '.',
    });
    fetchBackgroundData(false);
  };

  // As listas de CPF (uma por area em AREAS_ESPECIAIS) moraram em
  // Configuracoes ate aqui. Carregada uma vez so no mount -- ver o comentario
  // no estado cpfsAreaEspecial. Generico de proposito: se uma setima area
  // especial entrar, so precisa de uma coluna cpfs_area_<key> nova (ver
  // CPFS_AREA_COLUMN_MAP em organizerConfigService.js) -- nada aqui muda.
  const loadCpfsAreaEspecial = async () => {
    try {
      const configAtual = await fetchConfiguracoes();
      const novasListas = {};
      AREAS_COM_PRE_CADASTRO.forEach(({ key }) => {
        novasListas[key] = configAtual[`cpfs_area_${key}`] || [];
      });
      setCpfsAreaEspecial(novasListas);
      setPreCadastroSemCpf(!!configAtual.pre_cadastro_sem_cpf);
    } catch (error) {
      console.error('[OrganizerScalesPage] Error loading CPFs das areas especiais:', error);
    }
  };

  // Para o organizador ESCOLHER pelo nome, nos gerenciadores de CPF (ver
  // CpfsAreaEspecialManager.jsx) -- carregada uma vez so e compartilhada
  // por todas as instancias do componente.
  const loadEquipantesParaSelecao = async () => {
    setCarregandoEquipantesParaSelecao(true);
    try {
      const { data, error } = await fetchEquipantesParaSelecao();
      if (error) throw error;
      setEquipantesParaSelecao(data || []);
    } catch (error) {
      console.error('[OrganizerScalesPage] Error loading equipantes para selecao:', error);
    } finally {
      setCarregandoEquipantesParaSelecao(false);
    }
  };

  // Quem ja esta em uma das OUTRAS areas especiais, para o
  // CpfsAreaEspecialManager da area `areaKeyAtual` nem oferecer -- ver o
  // comentario sobre exclusividade no proprio componente.
  const cpfsDosOutrosPapeis = (areaKeyAtual) => {
    const mapa = {};
    AREAS_ESPECIAIS.forEach(({ key, label }) => {
      if (key === areaKeyAtual) return;
      (cpfsAreaEspecial[key] || []).forEach((cpf) => { mapa[cpf] = label; });
    });
    return mapa;
  };

  // Alocar com um clique, no pre-cadastro de cada area especial (13/10/2026).
  // `cpf` aqui e a chave da lista: o CPF ou 'id:<uuid>' de quem nao tem CPF
  // (utils/preCadastro.js).
  const situacaoDoCpfNaArea = (label) => (cpf) => {
    if (allocations.some(a => a.allocatedArea === label && pessoaTemChave(a, cpf))) return 'na_area';
    if ((equipantesAprovados || []).some(eq => pessoaTemChave(eq, cpf))) return 'pode';
    if ((equipantesParaSelecao || []).some(eq => pessoaTemChave(eq, cpf))) return 'nao_aprovado';
    return 'sem_inscricao';
  };

  const handleAlocarUmPorCpf = async (key, label, cpf, grupo = AREAS_ESPECIAIS) => {
    const nome = (equipantesAprovados || []).find(eq => pessoaTemChave(eq, cpf))?.nome || cpf;
    let r = await alocarAreasEspeciaisPorCpf({ [key]: [cpf] }, equipantesAprovados, allocations, false, grupo);
    // Area cheia: na alocacao manual o limite e so aviso.
    if (r.erros[0]?.semVaga && window.confirm(
      `${label}: ${r.erros[0].erro}.\n\nAlocar ${nome} mesmo assim? Na alocação manual o limite é só aviso.`
    )) {
      r = await alocarAreasEspeciaisPorCpf({ [key]: [cpf] }, equipantesAprovados, allocations, true, grupo);
    } else if (r.erros[0]?.semVaga) {
      return;
    }
    if (r.alocados + r.realocados > 0) {
      toast({
        title: 'Alocado',
        description: `${nome} → ${label}${r.realocados && r.saiuDe ? ` (saiu de ${r.saiuDe})` : ''}.`,
        className: 'bg-green-600 text-white'
      });
      // Espera a tela atualizar: o botao do chip so volta a ficar ativo
      // depois, e assim nao da para clicar de novo e levar "já está em".
      await fetchBackgroundData(false);
    } else if (r.erros.length) {
      toast({ title: 'Não foi possível alocar', description: `${nome}: ${r.erros[0].erro}`, variant: 'destructive' });
      // "Já está em ..." quer dizer que a tela estava atrasada: recarrega.
      fetchBackgroundData(false);
    } else {
      toast({ title: 'Nada a fazer', description: `${nome} já está em ${label}.` });
    }
  };

  // Transferencia entre areas especiais (14/10/2026): a pessoa sai do
  // pre-cadastro de uma e entra no da outra, e, se ja estava escalada, a escala
  // acompanha (realocar_alocacao: mesma regra de vaga e de uma especial por
  // pessoa). Ordem pensada para nunca perder ninguem: primeiro a escala (se
  // falhar, nada mudou), depois entra na lista nova, por ultimo sai da antiga.
  const handleTransferirPorCpf = async (de, cpf, para) => {
    const nome = formatNomeExibicao(
      (equipantesParaSelecao || []).find(e => pessoaTemChave(e, cpf))?.nome || cpf);
    const escalado = allocations.find(a => a.allocatedArea === de.label && pessoaTemChave(a, cpf));
    try {
      if (escalado) {
        const r = await comAvisoDeLimite((forcar) => realocarAlocacao(escalado.escalaId, para.label, forcar), para.label, nome);
        if (!r.success) {
          if (!r.cancelado) toast({ title: 'Não foi possível transferir', description: `${nome}: ${r.error}`, variant: 'destructive' });
          return;
        }
      }
      const listaDestino = cpfsAreaEspecial[para.key] || [];
      if (!listaDestino.includes(cpf)) await handleSaveCpfsAreaEspecial(para.key, [...listaDestino, cpf]);
      await handleSaveCpfsAreaEspecial(de.key, (cpfsAreaEspecial[de.key] || []).filter(c => c !== cpf));
      toast({
        title: 'Transferido',
        description: `${nome}: ${de.label} → ${para.label}${escalado ? ' (a escala também mudou)' : ''}.`,
        className: 'bg-green-600 text-white'
      });
      if (escalado) await fetchBackgroundData(false);
    } catch (error) {
      toast({ title: 'Erro ao transferir', description: `${nome}: ${error.message || 'tente de novo.'}`, variant: 'destructive' });
      fetchBackgroundData(false);
    }
  };

  // Especial em que a pessoa esta escalada (para a busca do pre-cadastro).
  const escaladoEmEspecial = (cpf) => allocations
    .find(a => pessoaTemChave(a, cpf) && NOMES_ESPECIAIS.includes(a.allocatedArea))?.allocatedArea || null;
  // "Transferir para ca" pela busca: acha em qual lista a pessoa esta.
  const transferirParaCa = (para) => async (cpf) => {
    const de = AREAS_ESPECIAIS.find(a => a.key !== para.key && (cpfsAreaEspecial[a.key] || []).includes(cpf));
    if (!de) { toast({ title: 'Não achei o pré-cadastro de origem', description: 'Recarregue a página e tente de novo.', variant: 'destructive' }); return; }
    await handleTransferirPorCpf(de, cpf, para);
  };
  const DESTINOS_TRANSFERENCIA = AREAS_ESPECIAIS.filter(a => AREAS_ESPECIAIS_TRANSFERIVEIS.includes(a.label));

  const handleSaveCpfsAreaEspecial = async (areaKey, novaLista) => {
    await updateCpfsAreaEspecial(areaKey, novaLista);
    setCpfsAreaEspecial(prev => ({ ...prev, [areaKey]: novaLista }));
  };

  // Aplica as listas de CPF pre-cadastradas acima (uma por area em
  // AREAS_ESPECIAIS -- ver CpfsAreaEspecialManager.jsx) contra quem ja esta
  // aprovado, casando por CPF. Busca a configuracao de novo na hora do
  // clique (em vez de usar cpfsAreaEspecial direto) porque e uma acao
  // pontual, nao algo que precisa reagir a mudanca em tempo real -- e assim
  // continua valendo mesmo que essa aba tenha ficado aberta um tempao sem
  // recarregar.
  // grupo: AREAS_ESPECIAIS ou AREAS_RECEPCAO_IGREJA (cada modulo aplica so as suas).
  const handleAlocarPorCpf = async (grupo = AREAS_ESPECIAIS) => {
    setAlocandoPorCpf(true);
    try {
      const configAtual = await fetchConfiguracoes();
      const cpfsPorArea = {};
      grupo.forEach(({ key }) => {
        cpfsPorArea[key] = configAtual[`cpfs_area_${key}`] || [];
      });

      if (Object.values(cpfsPorArea).every(lista => lista.length === 0)) {
        toast({
          title: 'Nada para aplicar',
          description: 'Cadastre os CPFs aqui em cima primeiro.'
        });
        return;
      }

      const r = await alocarAreasEspeciaisPorCpf(cpfsPorArea, equipantesAprovados, allocations, false, grupo);
      // Quem nao coube pelo limite: pergunta uma vez e tenta de novo so esses.
      const semVaga = r.erros.filter(e => e.semVaga);
      if (semVaga.length > 0 && window.confirm(
        `${semVaga.length === 1 ? 'Uma pessoa não coube' : `${semVaga.length} pessoas não couberam`} pelo limite da área:\n` +
        semVaga.map(e => `• ${e.nome} → ${e.area} (${e.erro})`).join('\n') +
        '\n\nAlocar mesmo assim? Na alocação manual o limite é só aviso.'
      )) {
        const deNovo = {};
        semVaga.forEach(e => { (deNovo[e.key] ||= []).push(e.cpf); });
        const r2 = await alocarAreasEspeciaisPorCpf(deNovo, equipantesAprovados, allocations, true, grupo);
        r.alocados += r2.alocados;
        r.realocados += r2.realocados;
        r.erros = [...r.erros.filter(e => !e.semVaga), ...r2.erros];
      }
      const aplicados = r.alocados + r.realocados;

      const detalhe = [
        r.alocados > 0 && `${r.alocados} alocado(s)`,
        r.realocados > 0 && (grupo === AREAS_ESPECIAIS
          ? `${r.realocados} trocado(s) de outra área especial ou de “Não será escalado”`
          : `${r.realocados} saíram de “Não será escalado”`),
        r.semCorrespondencia.length > 0 && `${r.semCorrespondencia.length} CPF(s) sem equipante aprovado correspondente`,
        r.erros.length > 0 && `${r.erros.length} erro(s): ${r.erros.map(e => `${e.nome || e.cpf} (${e.erro})`).join('; ')}`
      ].filter(Boolean).join('. ');

      toast({
        title: aplicados === 0 && r.erros.length === 0 ? 'Ninguém para aplicar' : `${aplicados} aplicado(s)`,
        description: detalhe || 'Todos já estavam nas áreas certas.',
        variant: r.erros.length > 0 ? 'destructive' : undefined,
        className: aplicados > 0 && r.erros.length === 0 ? 'bg-green-600 text-white' : undefined
      });

      if (aplicados > 0) fetchBackgroundData(false);
    } catch (error) {
      toast({ title: 'Erro ao aplicar CPFs', description: error.message, variant: 'destructive' });
    } finally {
      setAlocandoPorCpf(false);
    }
  };

  const handleLancarEscala = async () => {
    setLancando(true);
    const r = await lancarEscala();
    setLancando(false);
    setConfirmandoLancamento(false);
    if (r.success) {
      toast({
        title: "Escala lançada",
        description: "Os equipantes escalados já podem pagar a taxa de alimentação.",
        className: "bg-green-600 text-white"
      });
      fetchBackgroundData(false);
    } else {
      toast({ title: "Não foi possível lançar", description: r.error, variant: "destructive" });
    }
  };

  const handleLancarOficial = async () => {
    setLancando(true);
    const r = await lancarEscalaOficial();
    setLancando(false);
    setConfirmandoOficial(false);
    if (r.success) {
      toast({
        title: "Escala oficial lançada",
        description: "A escala final está publicada.",
        className: "bg-green-600 text-white"
      });
      fetchBackgroundData(false);
    } else {
      toast({ title: "Não foi possível lançar a oficial", description: r.error, variant: "destructive" });
    }
  };

  const handleDesfazerOficial = async () => {
    setLancando(true);
    const r = await desfazerEscalaOficial();
    setLancando(false);
    setConfirmandoDesfazerOficial(false);
    if (r.success) {
      toast({ title: "Escala oficial desfeita", description: "Volta a valer a escala provisória." });
      fetchBackgroundData(false);
    } else {
      toast({ title: "Não foi possível desfazer", description: r.error, variant: "destructive" });
    }
  };

  // Mover / tirar alguem de uma area e so para Desenvolvedores, Raquel e
  // Dudu (decisao do Patrick, 06/10/2026). O banco confere de novo.
  const podeGerir = !!escala?.pode_gerir;

  // Abre a troca de area ja com a pessoa (vindo do quadro de ausentes).
  const abrirTroca = (escalaId = null) => {
    const inicial = escalaId ? allocations.find(a => a.escalaId === escalaId) || null : null;
    setTrocaAberta({ inicial });
  };

  const handleDesfazerLancamento = async () => {
    setLancando(true);
    const r = await desfazerLancamentoEscala();
    setLancando(false);
    setConfirmandoDesfazer(false);
    if (r.success) {
      toast({
        title: "Lançamento desfeito",
        description: "Quem ainda não pagou volta a ver “aguardando a escala”."
      });
      fetchBackgroundData(false);
    } else {
      toast({ title: "Não foi possível desfazer", description: r.error, variant: "destructive" });
    }
  };

  const handleExportArea = (areaName, areaEquipantes) => {
    try {
      exportEquipantesByArea(areaName, areaEquipantes);
      toast({
        title: "Sucesso",
        description: `Planilha ${areaName} gerada.`,
        className: "bg-green-600 text-white"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleExportAll = () => {
    try {
      if (allocations.length === 0) throw new Error("Não há alocações.");
      exportAllEquipantes(allocations);
      toast({
        title: "Sucesso",
        description: "Planilha geral gerada.",
        className: "bg-green-600 text-white"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Em ordem alfabetica (13/10/2026) -- na tela e na planilha da area.
  // Lider sempre no topo (13/10/2026, Patrick). Nas areas por cor ha um lider
  // por cor: ficam todos no topo, na ordem das cores. Depois, todo mundo em
  // ordem alfabetica.
  // Agrupado e ordenado UMA vez por mudanca dos dados (antes: a cada letra
  // digitada numa busca, 40 filtros + ordenacoes de ~900 linhas).
  // Desempenho (14/10/2026): a lista de uma area que nao mudou continua sendo
  // o MESMO array (ver gruposAnterioresRef), e a tabela dela (React.memo) nem
  // se redesenha quando se mexe em outra area.
  const gruposAnterioresRef = useRef({});
  const equipantesPorArea = useMemo(() => {
    const ordemCor = (eq) => { const i = CORES_GRUPO.indexOf(eq.cor); return i < 0 ? CORES_GRUPO.length : i; };
    const grupos = {};
    allocations.forEach(a => { (grupos[a.allocatedArea] ||= []).push(a); });
    Object.keys(grupos).forEach(areaName => {
      const lideres = (atuacoesPorArea[areaName] || []).filter(a => a.ehLider).map(a => a.atuacao);
      const ehLider = (eq) => lideres.includes(eq.atuacao);
      grupos[areaName].sort((a, b) =>
        (Number(ehLider(b)) - Number(ehLider(a))) ||
        (ehLider(a) ? ordemCor(a) - ordemCor(b) : 0) ||
        String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
      const antes = gruposAnterioresRef.current[areaName];
      if (antes && antes.length === grupos[areaName].length && antes.every((x, i) => x === grupos[areaName][i])) {
        grupos[areaName] = antes;
      }
    });
    gruposAnterioresRef.current = grupos;
    return grupos;
  }, [allocations, atuacoesPorArea]);
  const getEquipantesByArea = areaName => equipantesPorArea[areaName] || VAZIO;

  // Sem cor numa area dividida por cor (13/10/2026): so aviso -- no topo, no
  // cabecalho da area, na coluna Cor e na confirmacao de lancamento.
  // Atuacao que nao usa cor (Celular / Mesa na Recepção Sítio) nao conta.
  const usaCor = (area, atuacao) => areaTemCor(area) &&
    !(atuacoesPorArea[area] || []).some(x => x.atuacao === atuacao && x.semCor);
  // Lider sem cor = lider da area inteira (ex.: Fotografia tem um lider so,
  // com o pessoal espalhado pelas cores). Nao conta como "sem cor".
  const ehLiderDaArea = (area, atuacao) => (atuacoesPorArea[area] || []).some(x => x.atuacao === atuacao && x.ehLider);
  const faltaCor = (area, pessoa) => usaCor(area, pessoa.atuacao) && !pessoa.cor && !ehLiderDaArea(area, pessoa.atuacao);
  const semCorPorArea = {};
  allocations.forEach(a => {
    if (faltaCor(a.allocatedArea, a)) semCorPorArea[a.allocatedArea] = (semCorPorArea[a.allocatedArea] || 0) + 1;
  });
  const totalSemCor = Object.values(semCorPorArea).reduce((t, n) => t + n, 0);
  const avisoSemCorLancamento = totalSemCor > 0 && (
    <>
      <br /><br />
      <span className="text-amber-300">
        ⚠ {totalSemCor === 1 ? '1 pessoa está' : `${totalSemCor} pessoas estão`} sem cor de grupo em áreas divididas por cor
        ({Object.entries(semCorPorArea).map(([area, n]) => `${area} ${n}`).join(', ')}). Dá para lançar assim mesmo e escolher a cor depois na coluna Cor.
      </span>
    </>
  );
  const irParaArea = (area) => {
    if (NOMES_ESPECIAIS.includes(area)) { setVerAreasEspeciais(true); return; }
    if (NOMES_RECEPCAO_IGREJA.includes(area)) { setVerRecepcaoIgreja(true); return; }
    setAreaFiltro(area);
    setBuscaNasAreas('');
    requestAnimationFrame(() => filtroAreasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Resultado do filtro "Filtrar os nomes nas tabelas", por area.
  const filtradosPorArea = useMemo(() => {
    if (!buscaNasAreas.trim()) return null;
    const montar = (casa) => {
      const r = {};
      let total = 0;
      Object.entries(equipantesPorArea).forEach(([area, lista]) => {
        r[area] = lista.filter(casa);
        total += r[area].length;
      });
      return { r, total };
    };
    const exato = montar(eq => casaBusca(buscaNasAreas, [eq.nome, nomeDaIgreja(eq), eq.igreja_outra, eq.cpf]));
    return exato.total ? exato.r : montar(eq => casaNomeParecido(buscaNasAreas, eq.nome)).r;
  }, [equipantesPorArea, buscaNasAreas]);

  // Desempenho (13/10/2026, Patrick: as buscas travavam a digitacao). A
  // tabela de cada area (EquipantesGridDisplay) e React.memo: so se redesenha
  // quando os dados DELA mudam. Para isso as funcoes passadas para ela tem de
  // ser sempre as mesmas -- estas chamam a versao mais nova de cada handler
  // pelo ref (nada fica com estado velho).
  // Acoes dos cartoes da fila (CartaoFila, React.memo): objeto fixo que chama
  // sempre a versao atual das funcoes -- mesmo padrao de acoesTabela abaixo.
  const acoesFilaRef = useRef({});
  acoesFilaRef.current = {
    alternar: alternarAreaDaFila,
    alocar: handleManualAllocate,
    alternarFixar: (id) => setFixarNaFila(prev => ({ ...prev, [id]: !prev[id] })),
  };
  const acoesFila = useMemo(() => ({
    alternar: (...a) => acoesFilaRef.current.alternar(...a),
    alocar: (...a) => acoesFilaRef.current.alocar(...a),
    alternarFixar: (...a) => acoesFilaRef.current.alternarFixar(...a),
  }), []);

  const acoesRef = useRef({});
  const acoesTabela = useMemo(() => ({
    exportar: (area) => acoesRef.current.exportar(area),
    realocar: (...a) => acoesRef.current.realocar(...a),
    adicionarArea: (...a) => acoesRef.current.adicionarArea(...a),
    remover: (...a) => acoesRef.current.remover(...a),
    definirAtuacao: (...a) => acoesRef.current.definirAtuacao(...a),
    definirCor: (...a) => acoesRef.current.definirCor(...a),
    escolherArea: (id, val) => setManualAreaChoice(prev => ({ ...prev, [id]: val })),
    fixar: (eq, a) => setFixarAberto({ eq, area: a }),
  }), []);

  const getGenderCount = (equipantes, targetGender) => {
    return equipantes.filter(e => {
      const g = (e.sexo || e.genero || '').toLowerCase();
      return g === targetGender.toLowerCase();
    }).length;
  };

  // Um cartao de area: o cabecalho com o limite mais a grade de quem esta
  // nela. Virou funcao porque agora e desenhado em DOIS lugares -- no corpo
  // da pagina e dentro do modulo das Areas Especiais. Duplicar o JSX faria
  // uma das duas copias envelhecer sozinha.
  // filtrar: so no corpo da pagina (a busca da barra de filtro). O cabecalho
  // continua contando a area inteira.
  // noModulo: dentro das Areas Especiais (janela grande), a tabela pode crescer.
  const renderCartaoArea = (area, filtrar = false, noModulo = false) => {
    const areaEquipantes = getEquipantesByArea(area);
    const mostrados = filtrar && filtradosPorArea ? (filtradosPorArea[area] || VAZIO) : areaEquipantes;
    const limitObj = getLimiteAreaComGenero(area, limitsMap, DEFAULT_AREA_CAPACITY);
    const mulheresCount = getGenderCount(areaEquipantes, 'feminino');
    const homensCount = getGenderCount(areaEquipantes, 'masculino');
    const atuacoesDaArea = atuacoesPorArea[area] || VAZIO;

    // A área tem líder previsto na escala oficial e ninguém está com
    // essa atuação -- só avisa se já houver gente na área (numa área
    // vazia o aviso seria ruído).
    const atuacoesDeLider = atuacoesDaArea.filter(a => a.ehLider).map(a => a.atuacao);
    const temCor = areaTemCor(area);

    // Fixos 📌 desta area: quem ja esta nela e quem ainda esta fora (e por que).
    const idsNaArea = new Set(areaEquipantes.map(eq => eq.id));
    const fixosDaArea = fixosPorArea[area] || [];
    const fixosHeader = {
      aqui: fixosDaArea.filter(f => idsNaArea.has(f.equipante_id)).map(f => formatNomeExibicao(f.nome)),
      fora: fixosDaArea.filter(f => !idsNaArea.has(f.equipante_id)).map(f => `${formatNomeExibicao(f.nome)} (${
        !f.inscrito ? 'não inscrito' : f.status !== 'aprovado' ? 'aguardando aprovação' : 'na fila ou em outra área'})`)
    };

    // Nas areas divididas por cor, um lider por area nao basta: cada
    // cor tem o seu (5 guias no vermelho, um deles e o lider do
    // vermelho). Entao o aviso olha cor a cor, e so para as cores que
    // realmente tem gente.
    const coresEmUso = temCor
      ? CORES_GRUPO.filter(cor => areaEquipantes.some(eq => eq.cor === cor))
      : [];
    // Um lider sem cor e o lider da area inteira: cobre todas as cores.
    const temLiderGeral = areaEquipantes.some(eq => !eq.cor && atuacoesDeLider.includes(eq.atuacao));
    const coresSemLider = temLiderGeral ? [] : coresEmUso.filter(cor =>
      !areaEquipantes.some(eq => eq.cor === cor && atuacoesDeLider.includes(eq.atuacao)));

    const faltaLider = atuacoesDeLider.length > 0 && areaEquipantes.length > 0 && (
      temCor
        ? coresSemLider.length > 0
        : !areaEquipantes.some(eq => atuacoesDeLider.includes(eq.atuacao))
    );

    // Sem backdrop-blur (14/10/2026): ~35 caixas com desfoque pesavam demais
    // na memoria do iPhone.
    return <div key={area} className="bg-black/60 border border-white/10 rounded-lg overflow-hidden shadow-md">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-white/10">
            <AreaLimitHeader areaName={area} currentCount={areaEquipantes.length} currentMulheres={mulheresCount} currentHomens={homensCount} limitObj={limitObj} onSaveLimit={handleUpdateLimit} isOrganizer={true} faltaLider={faltaLider} coresSemLider={coresSemLider} onAlocarEmLote={() => setLoteArea(area)} semCor={temCor ? areaEquipantes.filter(eq => faltaCor(area, eq)).length : 0} fixos={fixosHeader} onLimpar={podeGerir && !escala?.lancada_em ? () => setLimparAreaAberta(area) : undefined} onDistribuirCores={podeGerir && AREAS_DISTRIBUIR_CORES.includes(area) ? () => handleDistribuirCores(area) : undefined} distribuindoCores={distribuindoCores === area} />
          </div>

          {/* [overflow-anchor:none] (14/10/2026): ao trocar cor/atuacao a linha
              muda de lugar na tabela, e o navegador rolava a tela atras dela
              (no Guia, ate o topo). */}
          <div className={cn("p-4 overflow-y-auto [overflow-anchor:none]", noModulo ? "max-h-[65vh]" : "max-h-[400px]")}>
            {loadingLimits ? <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div> : <QuandoVisivel altura={Math.min(400, 60 + mostrados.length * 52)}><EquipantesGridDisplay equipantes={mostrados} areaName={area} onExport={acoesTabela.exportar} onRealocar={podeGerir ? acoesTabela.realocar : undefined} onAdicionarArea={podeGerir ? acoesTabela.adicionarArea : undefined} onRemover={podeGerir ? acoesTabela.remover : undefined} areasPorEquipante={areasPorEquipante} nomesAreasPorEquipante={nomesAreasPorEquipante} realocarAreaChoice={manualAreaChoice} onRealocarAreaChoiceChange={acoesTabela.escolherArea} realocando={manualAllocating} atuacoes={atuacoesDaArea} onDefinirAtuacao={acoesTabela.definirAtuacao} salvandoAtuacao={mostrados.some(e => salvandoAtuacao[e.escalaId]) ? salvandoAtuacao : VAZIO_OBJ} mostrarCor={temCor} onDefinirCor={acoesTabela.definirCor} salvandoCor={mostrados.some(e => salvandoCor[e.escalaId]) ? salvandoCor : VAZIO_OBJ} fixasPorEquipante={fixasPorEquipante} onFixar={podeGerir ? acoesTabela.fixar : undefined} /></QuandoVisivel>}
          </div>
        </div>;
  };

  acoesRef.current = {
    exportar: (area) => handleExportArea(area, getEquipantesByArea(area)),
    realocar: handleRealocar,
    adicionarArea: handleAdicionarArea,
    remover: handleRemover,
    definirAtuacao: handleDefinirAtuacao,
    definirCor: handleDefinirCor,
  };

  return <Layout largo>
      <Helmet>
        <title>Geração de Escalas - Organizador</title>
      </Helmet>
      <div className="space-y-6 pb-20 relative">
        <AnimatePresence>
          {saveStatus !== 'idle' && <motion.div initial={{
          opacity: 0,
          y: -20
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -20
        }} className="fixed top-24 right-4 z-50 flex items-center space-x-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-md text-sm font-medium" style={{
          backgroundColor: saveStatus === 'saving' ? 'rgba(59, 130, 246, 0.2)' : saveStatus === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${saveStatus === 'saving' ? 'rgba(59, 130, 246, 0.5)' : saveStatus === 'success' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
          color: '#fff'
        }}>
              {saveStatus === 'saving' && <><Loader2 className="w-4 h-4 animate-spin" /><span>Salvando...</span></>}
              {saveStatus === 'success' && <><CheckCircle className="w-4 h-4 text-green-400" /><span>Salvo</span></>}
              {saveStatus === 'error' && <><AlertCircle className="w-4 h-4 text-red-400" /><span>{errorMessage || 'Erro ao salvar'}</span></>}
            </motion.div>}
        </AnimatePresence>

        {/* Topo (16/10/2026, Patrick): a situacao a esquerda e os botoes em
            tres linhas com rotulo, na ordem do trabalho -- montar a escala,
            cuidar das equipes, publicar. */}
        <div className="flex flex-col xl:flex-row xl:items-stretch gap-5">
          <div className="w-full xl:flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Grid className="h-8 w-8 text-red-500" />
              Geração de Escalas
            </h1>
            <p className="text-gray-400">Geração de escalas automáticas</p>

            {/* Onde cada equipante esta no caminho ate a escala. Amarelo e
                trabalho do parceiro; vermelho e trabalho seu; verde ja
                esta pronto. Clicar no vermelho leva ate a fila. */}
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {aguardandoAprovacao !== null && (
                <ContadorEtapa
                  cor="amarelo"
                  numero={aguardandoAprovacao}
                  rotulo="aguardando o parceiro aprovar"
                />
              )}
              <ContadorEtapa
                cor="vermelho"
                numero={waitlist.length}
                rotulo="a escalar"
                onClick={waitlist.length > 0 ? () => filaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
              />
              <ContadorEtapa
                cor="verde"
                numero={pessoasEscaladas}
                rotulo={allocations.length === pessoasEscaladas
                  ? 'escalados'
                  : `escalados (${allocations.length} funções)`}
              />
            </div>

            {escala && (
              <p className={cn('text-sm mt-3 leading-relaxed', escala.lancada_em ? 'text-green-400' : 'text-amber-400/90')}>
                {escala.oficial_em
                  ? `Escala oficial lançada em ${new Date(escala.oficial_em).toLocaleString('pt-BR')} . ${escaladosReais.length - naoViramArea.length} de ${escaladosReais.length} já viram a área no site.`
                  : escala.lancada_em
                  ? `Escala provisória lançada em ${new Date(escala.lancada_em).toLocaleString('pt-BR')} — cada um já vê a área e pode pagar, e os líderes fazem a chamada. ${escaladosReais.length - naoViramArea.length} de ${escaladosReais.length} já viram a área no site.`
                  : escala.faltam > 0
                    ? `Escala ainda não lançada. ${escala.faltam === 1
                        ? 'Falta 1 equipante sem destino'
                        : `Faltam ${escala.faltam} equipantes sem destino`} — ${liberaComFila
                          ? 'no ambiente de teste dá para lançar mesmo assim.'
                          : 'distribua (ou marque como “Não será escalado”) para poder lançar.'}`
                    : !escala.escalados
                      ? 'Escala ainda não lançada — e não há ninguém escalado. Coloque pelo menos um equipante em uma área para poder lançar.'
                      : 'Todos distribuídos. A escala provisória já pode ser lançada.'}
                {escala.nao_serao_escalados > 0 && ` · ${escala.nao_serao_escalados === 1
                  ? '1 não será escalado' : `${escala.nao_serao_escalados} não serão escalados`}.`}
              </p>
            )}

            {totalSemCor > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100 space-y-2">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    {totalSemCor === 1 ? '1 pessoa está' : `${totalSemCor} pessoas estão`} sem cor de grupo em áreas divididas por cor.
                    Escolha a cor na coluna Cor de cada área (não impede nada, é só aviso).
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(semCorPorArea).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([area, n]) => (
                    <button key={area} type="button" onClick={() => irParaArea(area)}
                      data-dica={`Ir para ${area}.`}
                      className="rounded-full border border-amber-500/40 px-2.5 py-0.5 text-xs text-amber-200 hover:bg-amber-500/20">
                      {area} <span className="tabular-nums">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {escala?.lancada_em && naoViramArea.length > 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setMostrarNaoViram(v => !v)}
                  data-dica="Lista de escalados que ainda não abriram &quot;Ver qual área fui escalado&quot; no site."
                  className="text-sm text-gray-400 underline underline-offset-2 hover:text-white"
                >
                  {mostrarNaoViram ? 'esconder' : `ver quem ainda não viu (${naoViramArea.length})`}
                </button>
                {mostrarNaoViram && (
                  <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-gray-300 space-y-0.5">
                    {naoViramArea
                      .slice()
                      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
                      .map(a => (
                        <li key={a.id}>
                          {a.nome}
                          <span className="text-gray-500">{a.whatsapp ? ` · ${a.whatsapp}` : ''} · {a.allocatedArea}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {/* O quadro ocupa so o que os botoes precisam, encostado a direita,
              e acompanha a altura do lado esquerdo (sem vao embaixo). */}
          <div className="w-full xl:w-auto xl:max-w-[720px] xl:shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 flex flex-col justify-center gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
              <p className="lg:w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-500" data-dica="Montar a escala: consultar, cadastrar e alocar.">Montar a escala</p>
              <div className="flex flex-wrap gap-2 flex-1">
                <Button data-dica="Só consulta: quantos inscritos escolheram cada área, antes de montar a escala." onClick={() => setVerPreEscala(true)} variant="outline"
                  className="bg-teal-600/20 text-teal-300 border-teal-600/50 hover:bg-teal-600/40 hover:text-teal-200">
                  <ClipboardCheck className="mr-2 h-4 w-4" /> Pré-escala
                  <ChevronRight className="ml-1.5 h-4 w-4 opacity-50" />
                </Button>
                <Button data-dica="Escolher quem fica nos papéis especiais (Guia, Inimigo, Espírito Santo...)." onClick={() => setVerAreasEspeciais(true)} variant="outline"
                  className="bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> Áreas Especiais ({totalEspeciais})
                  <ChevronRight className="ml-1.5 h-4 w-4 opacity-50" />
                </Button>
                <Button data-dica="Equipe da igreja no dia da saída: Recepção Igreja, Cozinha Igreja, Som / Multimídia, Estacionamento e Mesa crachá. Pré-cadastro e alocação, como nas Áreas Especiais."
                  onClick={() => setVerRecepcaoIgreja(true)} variant="outline"
                  className="bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white">
                  <Church className="mr-2 h-4 w-4" /> Recepção Igreja ({totalRecepcaoIgreja})
                  <ChevronRight className="ml-1.5 h-4 w-4 opacity-50" />
                </Button>
                {escala?.pode_gerir && (
                  <Button onClick={() => setManualAberta(true)} variant="outline"
                    data-dica="Cadastrar na hora quem chegou sem inscrição. A pessoa cai na fila A escalar para ser alocada."
                    className="bg-emerald-600/15 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30 hover:text-emerald-200">
                    <UserPlus className="mr-2 h-4 w-4" /> Inscrição manual
                  </Button>
                )}
                {(!autoAtivo || waitlist.length > 0 || faltaPastorInvisivel > 0) && (
                <Button onClick={() => setConfirmandoAuto(true)}
                  disabled={(waitlist.length === 0 && faltaPastorInvisivel === 0) || alocandoAuto}
                  variant="outline"
                  data-dica={waitlist.length === 0
                    ? (faltaPastorInvisivel > 0
                      ? `A fila está vazia, mas o Pastor Invisível tem ${faltaPastorInvisivel} vaga(s): completa com pastores. Pede confirmação.`
                      : 'A fila "A escalar" está vazia.')
                    : 'Distribuir todo mundo da fila "A escalar" pelas áreas que escolheram na inscrição. Pede confirmação.'}
                  className="bg-purple-600/20 text-purple-300 border-purple-600/50 hover:bg-purple-600/40 hover:text-purple-200">
                  {alocandoAuto
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Wand2 className="mr-2 h-4 w-4" />}
                  Alocar automático{waitlist.length > 0 ? ` (${waitlist.length})` : ''}
                </Button>
                )}
                {autoAtivo && (
                  <Button onClick={() => setConfirmandoDesfazerAuto(true)}
                    disabled={desfazendoAuto}
                    variant="outline"
                    data-dica={autoSituacao.lotes > 1
                      ? `Desfaz só a ÚLTIMA rodada do Alocar automático (há ${autoSituacao.lotes} rodadas). Para desfazer a anterior, clique de novo depois. Quem foi mexido ou alocado à mão fica. Pede confirmação.`
                      : 'Tirar da escala quem o Alocar automático colocou (e ainda está na mesma área). Quem foi mexido ou alocado à mão fica. Pede confirmação.'}
                    className="bg-amber-600/20 text-amber-300 border-amber-600/50 hover:bg-amber-600/40 hover:text-amber-200">
                    {desfazendoAuto
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Undo2 className="mr-2 h-4 w-4" />}
                    {autoSituacao.lotes > 1 ? 'Desfazer a última alocação automática' : 'Desfazer alocação automática'}{autoSituacao.no_lugar ? ` (${autoSituacao.no_lugar})` : ''}
                  </Button>
                )}
              </div>
            </div>
            <div className="border-t border-white/5" />
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
              <p className="lg:w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-500" data-dica="Depois de lançar: trocas, reunião de escala e mutirões.">Equipes</p>
              <div className="flex flex-wrap gap-2 flex-1">
                {escala?.pode_gerir && escala.lancada_em && (
                  <Button onClick={() => abrirTroca()} variant="outline"
                    data-dica="Mudar alguém da área X para a área Y. Entra na relação do novo líder na hora."
                    className="bg-cyan-600/15 text-cyan-300 border-cyan-600/40 hover:bg-cyan-600/30 hover:text-cyan-200">
                    <Repeat className="mr-2 h-4 w-4" /> Trocar de área
                    <ChevronRight className="ml-1.5 h-4 w-4 opacity-50" />
                  </Button>
                )}
                {escala?.lancada_em && (
                  <Button onClick={() => setVerResponsaveis(true)} variant="outline"
                    data-dica="Quem conduz a reunião da escala no lugar do líder (quando ele não pode ou não delegou): faz a chamada e o grupo do WhatsApp."
                    className="bg-amber-600/15 text-amber-300 border-amber-600/40 hover:bg-amber-600/30 hover:text-amber-200">
                    <UserCog className="mr-2 h-4 w-4" /> Responsáveis pela reunião
                    <ChevronRight className="ml-1.5 h-4 w-4 opacity-50" />
                  </Button>
                )}
                <Button data-dica="Listas dos mutirões (caminhão, cozinha, limpeza). Não mexe na escala." onClick={() => setVerAreasExtra(true)} variant="outline"
                  className="bg-blue-600/20 text-blue-300 border-blue-600/50 hover:bg-blue-600/40 hover:text-blue-200">
                  <Truck className="mr-2 h-4 w-4" /> Áreas Extras
                  <ChevronRight className="ml-1.5 h-4 w-4 opacity-50" />
                </Button>
                {!escala?.lancada_em && (
                  <p className="self-center text-xs text-gray-500">
                    Trocar de área e Responsáveis pela reunião aparecem após lançar a provisória.
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-white/5" />
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
              <p className="lg:w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-500" data-dica="Lançar ou desfazer a escala e baixar a planilha.">Publicar</p>
              <div className="flex flex-wrap gap-2 flex-1">
                {!escala?.lancada_em ? (
                  <Button onClick={() => setConfirmandoLancamento(true)}
                    disabled={!escala || (escala.faltam > 0 && !liberaComFila) || !escala.escalados || !escala.pode_gerir}
                    data-dica={escala && !escala.pode_gerir
                      ? 'Só Desenvolvedores, Raquel e Dudu lançam a escala.'
                      : escala?.faltam > 0 && !liberaComFila
                        ? 'Distribua todos os equipantes antes de lançar a escala.'
                        : escala && !escala.escalados
                          ? 'Não há ninguém escalado. Coloque pelo menos um equipante em uma área.'
                          : 'Publicar a escala provisória: cada equipante vê a área no site e pode pagar, e os líderes fazem a chamada. Pede confirmação.'}
                    className="bg-amber-600 hover:bg-amber-700 text-white disabled:bg-white/5 disabled:text-white/40 disabled:border disabled:border-white/20">
                    <Send className="mr-2 h-4 w-4" />
                    Lançar escala provisória{escala?.faltam > 0 ? ` (faltam ${escala.faltam})` : ''}
                  </Button>
                ) : !escala.oficial_em ? (
                  <>
                    <Button data-dica="Esconder a escala provisória do site de novo: os equipantes deixam de ver a área e de poder pagar, e os líderes perdem a relação. Pede confirmação."
                      onClick={() => setConfirmandoDesfazer(true)} variant="outline" disabled={!escala.pode_gerir}
                      className="bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white">
                      <Undo2 className="mr-2 h-4 w-4" /> Desfazer Escala Provisória
                    </Button>
                    <Button onClick={() => setConfirmandoOficial(true)}
                      disabled={(escala.faltam > 0 && !liberaComFila) || !escala.pode_gerir}
                      data-dica={!escala.pode_gerir
                        ? 'Só Desenvolvedores, Raquel e Dudu lançam a escala.'
                        : escala.faltam > 0 && !liberaComFila
                          ? 'Há gente na fila "A escalar" (inscrição manual, por exemplo). Distribua antes de lançar a oficial.'
                          : 'Lançar a escala oficial (final), depois de refazer a escala com a chamada. Pede confirmação.'}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:bg-white/5 disabled:text-white/40 disabled:border disabled:border-white/20">
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      Lançar escala oficial{escala.faltam > 0 ? ` (faltam ${escala.faltam})` : ''}
                    </Button>
                  </>
                ) : (
                  <Button data-dica="Voltar para a escala provisória. Não mexe em pagamento nenhum. Pede confirmação."
                    onClick={() => setConfirmandoDesfazerOficial(true)} variant="outline" disabled={!escala.pode_gerir}
                    className="bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white">
                    <Undo2 className="mr-2 h-4 w-4" /> Desfazer oficial
                  </Button>
                )}
                <Button data-dica="Baixar a escala completa em planilha." onClick={handleExportAll} disabled={allocations.length === 0} variant="outline" className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/40 hover:text-green-300">
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {dbVerification.checked && !dbVerification.valid && <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-md flex items-center gap-3">
             <AlertTriangle className="h-5 w-5 text-red-400" />
             <p className="text-red-200 text-sm">Atenção: A estrutura do banco de dados parece estar incompleta.</p>
          </div>}

        {/* Chamada da reuniao de escala e os ausentes a definir. Continua
            depois da oficial: os separados podem voltar a qualquer hora. */}
        {escala?.lancada_em && escala.pode_gerir && (
          <ChamadaQuadro
            resumo={escala}
            // So os numeros da escala: recarregar as ~900 alocacoes a cada
            // 30s so por causa da chamada seria peso a toa.
            recarregarTela={async () => { const s = await fetchSituacaoEscala(); if (s) setEscala(s); }}
            recarregarTudo={() => fetchBackgroundData(false)}
            onTrocar={abrirTroca}
          />
        )}

        {/* A fila de trabalho do organizador: aprovados que ainda nao estao
            em area nenhuma. Antes isso se chamava "Lista de Espera — sem
            vaga nas 3 opções", porque so caia aqui quem a alocacao
            automatica nao tinha conseguido encaixar. Agora a aprovacao nao
            aloca mais ninguem, entao TODO aprovado passa por aqui. */}
        {waitlist.length > 0 && <Card ref={filaRef} className="bg-red-900/10 border-red-900/30 scroll-mt-24">
            <div className={cn("p-3 sm:p-4 flex flex-wrap items-center gap-x-3 gap-y-2", !filaMinimizada && "border-b border-red-900/30")}>
              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap flex-1 min-w-0">
                <AlertTriangle className="text-red-400 h-5 w-5 shrink-0" />
                <h3 className="font-semibold text-white">
                  A escalar ({waitlist.length})
                  {filaFiltrada.length !== waitlist.length && (
                    <span className="font-normal text-red-200/70 text-sm"> · {filaFiltrada.length} na busca</span>
                  )}
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={alternarFilaMinimizada}
                  data-dica={filaMinimizada ? 'Mostrar a lista de quem está a escalar.' : 'Esconder a lista (fica só esta linha) para ver melhor a escala enquanto monta.'}
                  className="h-8 px-2 text-red-200 hover:text-white hover:bg-white/10">
                  {filaMinimizada ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronUp className="h-4 w-4 mr-1" />}
                  <span className="text-xs">{filaMinimizada ? 'Mostrar' : 'Minimizar'}</span>
                </Button>
                {totalSugestoesCheias > 0 && (
                  <button type="button"
                    onClick={() => { setSoSugestoesCheias(v => !v); if (filaMinimizada) alternarFilaMinimizada(); }}
                    aria-pressed={filtroSugestoesCheias}
                    data-dica={filtroSugestoesCheias
                      ? 'Voltar a mostrar a fila inteira.'
                      : 'Pessoas que pediram áreas, mas todas as que pediram estão sem vaga: o Alocar automático não consegue colocar. Clique para ver só elas.'}
                    className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                      filtroSugestoesCheias
                        ? 'border-amber-400 bg-amber-500/25 text-amber-100'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20')}>
                    <AlertTriangle className="h-3 w-3" />
                    {totalSugestoesCheias} com as sugestões cheias{filtroSugestoesCheias ? ' · ver todos' : ''}
                  </button>
                )}
              </div>
              {!filaMinimizada && <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto">
                <Select value={ordemFila.campo} onValueChange={(v) => mudarOrdemFila({ campo: v })}>
                  <SelectTrigger className="h-9 w-[9.5rem] shrink-0 bg-black/40 border-white/20 text-white text-xs"
                    data-dica="Ordenar a lista de quem está a escalar.">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-gray-400 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="igreja">Igreja</SelectItem>
                    <SelectItem value="area">Área sugerida (1ª)</SelectItem>
                    <SelectItem value="pastor">Pastores</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => mudarOrdemFila({ desc: !ordemFila.desc })}
                  data-dica={ordemFila.desc ? 'Ordem decrescente (Z→A). Clique para inverter.' : 'Ordem crescente (A→Z). Clique para inverter.'}
                  className="h-9 w-12 shrink-0 px-0 bg-black/40 border-white/20 text-white text-[11px] hover:bg-white/10 hover:text-white">
                  {ordemFila.desc ? 'Z→A' : 'A→Z'}
                </Button>
                <div className="relative flex-1 min-w-[12rem] xl:w-72 xl:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <CampoBusca
                    value={buscaFila}
                    onChange={setBuscaFila}
                    placeholder="Buscar por nome, igreja, CPF ou área..."
                    className="h-9 pl-8 bg-black/40 border-white/20 text-white"
                  />
                </div>
              </div>}
            </div>
            {!filaMinimizada && <div className="p-4 space-y-3 max-h-[32rem] overflow-y-auto">
              {filaPorParecido && <p className="text-[11px] text-amber-200/80 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" />Nenhum nome igual a “{buscaFila.trim()}” — mostrando nomes parecidos (erro de digitação?).</p>}
              {filaFiltrada.length === 0 && (
                <p className="text-sm text-red-200/60 text-center py-4">
                  {buscaFila.trim() ? <>Ninguém na fila corresponde a “{buscaFila}”.</> : 'Ninguém na fila com esse filtro.'}
                </p>
              )}
              {filaFiltrada.length === 0 && jaEscaladosDaBuscaFila.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-300">
                    A fila só mostra quem ainda <strong className="text-white">não tem área</strong>. Quem bate com a busca e já está escalado:
                  </p>
                  {jaEscaladosDaBuscaFila.map(renderEscaladoComAcao)}
                </div>
              )}
              {/* Renderiza no maximo 100 de uma vez: com ~900 na fila, montar
                  900 blocos com 2 menus cada trava a tela sem necessidade.
                  Quem procura alguem especifico usa a busca. */}
              {filaFiltrada.slice(0, LIMITE_FILA_VISIVEL).map((eq) => (
                <CartaoFila
                  key={eq.id}
                  eq={eq}
                  semVagaDica={semVagaPorPessoa[eq.id]
                    ? 'Todas as áreas que pediu estão sem vaga:\n' + semVagaPorPessoa[eq.id].map(m => `• ${m.area}: ${m.motivo}`).join('\n') + '\n\nColoque à mão (na alocação manual o limite é só aviso).'
                    : ''}
                  manual={ehManualSemOpcao(eq)}
                  fixas={fixasPorEquipante[eq.id] || VAZIO}
                  escolhidas={areasDaFila[eq.id] || VAZIO}
                  fixar={!!fixarNaFila[eq.id]}
                  alocando={!!manualAllocating[eq.id]}
                  podeGerir={podeGerir}
                  maxAreas={MAX_AREAS_DE_UMA_VEZ}
                  acoes={acoesFila}
                />
              ))}
              {filaFiltrada.length > LIMITE_FILA_VISIVEL && (
                <p className="text-sm text-red-200/60 text-center py-2">
                  Mostrando {LIMITE_FILA_VISIVEL} de {filaFiltrada.length}. Use a busca para chegar em alguém específico.
                </p>
              )}
            </div>}
          </Card>}

        {/* Onde cada pessoa esta escalada. Sem isto, achar alguem exigia
            abrir as 40 tabelas uma a uma -- e quem trabalha em duas areas
            aparece em duas delas. */}
        {allocations.length > 0 && (
          <Card className="bg-black/40 border-white/10">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-gray-500 shrink-0" />
                <h3 className="font-semibold text-white text-sm">Onde alguém está escalado</h3>
              </div>
              <CampoBusca
                value={buscaEscalados}
                onChange={mudarBuscaEscalados}
                placeholder="Buscar por nome, igreja, CPF ou área..."
                className="h-9 w-full sm:w-96 bg-black/40 border-white/20 text-white"
              />
            </div>

            {termoEscalados && (
              <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
                {escaladosPorParecido && <p className="text-[11px] text-amber-200/80 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" />Nenhum nome igual a “{buscaEscalados.trim()}” — mostrando nomes parecidos (erro de digitação?).</p>}
                {escaladosEncontrados.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Ninguém escalado corresponde a “{buscaEscalados}”.
                  </p>
                )}
                {escaladosEncontrados.slice(0, 40).map(renderEscaladoComAcao)}
                {escaladosEncontrados.length > 40 && (
                  <p className="text-xs text-gray-500 text-center">
                    Mostrando 40 de {escaladosEncontrados.length}. Refine a busca.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        <AnimatePresence>
          {verPreEscala && <PreEscalaDialog onClose={() => setVerPreEscala(false)} />}
          {verAreasExtra && <AreasExtraDialog onClose={() => setVerAreasExtra(false)} />}
          {verResponsaveis && <ResponsaveisReuniaoDialog onClose={() => setVerResponsaveis(false)} />}
          {manualAberta && (
            <InscricaoManualDialog
              key="manual"
              onClose={() => setManualAberta(false)}
              onCriado={() => fetchBackgroundData(false)}
            />
          )}
          {trocaAberta && (
            <TrocarAreaDialog
              key="troca"
              allocations={allocations}
              inicial={trocaAberta.inicial}
              onClose={() => setTrocaAberta(null)}
              onTrocado={() => fetchBackgroundData(false)}
            />
          )}
          {verAreasEspeciais && (
            <AreasEspeciaisDialog
              total={totalEspeciais}
              onClose={() => setVerAreasEspeciais(false)}
              onAplicarCpfs={() => handleAlocarPorCpf(AREAS_ESPECIAIS)}
              aplicandoPorCpf={alocandoPorCpf}
            >
              {AREAS_ESPECIAIS.map(({ key, label }) => (
                <div key={key} className="space-y-3">
                  <div className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <h4 className="text-sm font-medium text-gray-300">Pré-cadastro por CPF — {label}</h4>
                    <CpfsAreaEspecialManager
                      areaLabel={label}
                      cpfs={cpfsAreaEspecial[key] || []}
                      equipantes={equipantesParaSelecao}
                      carregandoEquipantes={carregandoEquipantesParaSelecao}
                      areaPorCpf={cpfsDosOutrosPapeis(key)}
                      onSave={(novaLista) => handleSaveCpfsAreaEspecial(key, novaLista)}
                      situacaoDoCpf={situacaoDoCpfNaArea(label)}
                      permitirSemCpf={preCadastroSemCpf}
                      onAlocar={(cpf) => handleAlocarUmPorCpf(key, label, cpf)}
                      areasDestino={AREAS_ESPECIAIS_TRANSFERIVEIS.includes(label) ? DESTINOS_TRANSFERENCIA : []}
                      onTransferir={podeGerir && AREAS_ESPECIAIS_TRANSFERIVEIS.includes(label) ? (cpf, para) => handleTransferirPorCpf({ key, label }, cpf, para) : undefined}
                      escaladoEmEspecial={escaladoEmEspecial}
                      areasTransferiveis={AREAS_ESPECIAIS_TRANSFERIVEIS}
                      onTransferirParaCa={podeGerir ? transferirParaCa({ key, label }) : undefined}
                      areasComunsDoCpf={areasComunsDoCpf}
                      areasComunsDisponiveis={AREAS_COMUNS}
                      onEscalarTambem={podeGerir ? handleEscalarTambemPorCpf : undefined}
                    />
                  </div>
                  {renderCartaoArea(label, false, true)}
                </div>
              ))}
            </AreasEspeciaisDialog>
          )}
          {verRecepcaoIgreja && (
            <AreasEspeciaisDialog
              titulo="Recepção Igreja"
              Icone={Church}
              descricao={<>Equipe da igreja no dia da saída: {NOMES_RECEPCAO_IGREJA.join(', ')}. A mesma pessoa pode estar em várias destas áreas e também nas áreas do sítio (o “Alocar” só acrescenta).</>}
              resumo={totalRecepcaoIgreja === 0
                ? 'Ninguém escalado nestas áreas ainda.'
                : `${totalRecepcaoIgreja} ${totalRecepcaoIgreja === 1 ? 'escalação' : 'escalações'} nestas áreas.`}
              dicaAplicar="Aplica as listas de CPF pré-cadastradas acima contra quem já está aprovado."
              onClose={() => setVerRecepcaoIgreja(false)}
              onAplicarCpfs={() => handleAlocarPorCpf(AREAS_RECEPCAO_IGREJA)}
              aplicandoPorCpf={alocandoPorCpf}
            >
              {AREAS_RECEPCAO_IGREJA.map(({ key, label }) => (
                <div key={key} className="space-y-3">
                  <div className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <h4 className="text-sm font-medium text-gray-300">Pré-cadastro por CPF — {label}</h4>
                    <CpfsAreaEspecialManager
                      areaLabel={label}
                      cpfs={cpfsAreaEspecial[key] || []}
                      equipantes={equipantesParaSelecao}
                      carregandoEquipantes={carregandoEquipantesParaSelecao}
                      onSave={(novaLista) => handleSaveCpfsAreaEspecial(key, novaLista)}
                      situacaoDoCpf={situacaoDoCpfNaArea(label)}
                      permitirSemCpf={preCadastroSemCpf}
                      onAlocar={(cpf) => handleAlocarUmPorCpf(key, label, cpf, AREAS_RECEPCAO_IGREJA)}
                      dicaAlocar={`Colocar esta pessoa em ${label} agora (as outras áreas dela continuam).`}
                      areasComunsDoCpf={outrasAreasDoCpf(label)}
                      areasComunsDisponiveis={AREAS_COMUNS}
                      onEscalarTambem={podeGerir ? handleEscalarTambemPorCpf : undefined}
                    />
                  </div>
                  {renderCartaoArea(label, false, true)}
                </div>
              ))}
            </AreasEspeciaisDialog>
          )}
        </AnimatePresence>

        <AlertDialog open={confirmandoAuto} onOpenChange={setConfirmandoAuto}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Alocar pelas preferências?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {waitlist.length === 1
                  ? 'A pessoa da fila vai '
                  : `As ${waitlist.length} pessoas da fila vão `}
                para as áreas que escolheram na inscrição, respeitando o teto de cada
                área e o limite por sexo.
                <br /><br />
                <strong className="text-white">Antes de tudo, os fixos 📌</strong> vão para as suas
                áreas fixas.
                <br /><br />
                <strong className="text-white">Depois todo mundo na 1ª opção</strong>, depois
                quem sobrou na 2ª, depois na 3ª — assim ninguém perde a 1ª opção para a 3ª de
                outra pessoa. Dentro de cada opção, escolhe primeiro quem{' '}
                {escalaOrdem === 'cadastro' ? 'se cadastrou' : 'foi aprovado'} antes.
                <br /><br />
                <strong className="text-white">No fim, quem sobrou vai para uma área sorteada com vaga</strong>:
                quem marcou “Disponível para qualquer área”, as inscrições manuais sem opção e quem
                teve as 3 opções cheias (esses ficam com a etiqueta “Fora das opções”). Quem não tem
                sexo informado só vai para área sem limite por sexo.
                <br /><br />
                <strong className="text-white">Pastor Invisível:</strong> completa até o limite com
                pastores que <strong className="text-white">ainda não têm área</strong>, 3 por cor, homens e
                mulheres misturados (o pré-cadastro entra primeiro). Pastor que já está escalado
                em qualquer área <strong className="text-white">nunca é tirado de lá</strong>.
                <br /><br />
                Invisível e Marcador já entram com cor. Fotografia, Guia, Inimigo, Espírito Santo e
                as demais áreas que só a diretoria preenche <strong className="text-white">só recebem
                os fixos 📌</strong> por aqui. Ninguém volta para uma área de onde foi tirado à mão.
                <strong className="text-white">Quem já está escalado nunca é movido</strong>, nem por esta
                rodada nem pelas anteriores: o automático só coloca quem está na fila. Você pode mudar tudo depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleAlocarAutomatico} disabled={alocandoAuto}
                className="bg-purple-600 hover:bg-purple-700 text-white">
                {alocandoAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alocar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {loteArea && (() => {
          const naArea = getEquipantesByArea(loteArea);
          // Quem ja esta escalado em OUTRA area (13/10/2026): aparece na busca
          // do lote para ganhar esta como segunda area. Fica de fora quem ja
          // esta aqui e quem esta em "Não será escalado".
          const porPessoa = new Map();
          allocations.forEach(a => {
            const p = porPessoa.get(a.id) || { ...a, areas: [] };
            p.areas.push(a.allocatedArea);
            porPessoa.set(a.id, p);
          });
          const escaladosFora = [...porPessoa.values()]
            .filter(p => !p.areas.includes(loteArea) && !p.areas.includes('Não será escalado'));
          return (
            <AlocarEmLoteDialog
              area={loteArea}
              limitObj={getLimiteAreaComGenero(loteArea, limitsMap, DEFAULT_AREA_CAPACITY)}
              ocupados={naArea.length}
              mulheres={getGenderCount(naArea, 'feminino')}
              homens={getGenderCount(naArea, 'masculino')}
              fila={loteArea === 'Pastor Invisível' ? waitlist.filter(p => tituloPastor(p) && seloOrganizacao(p.id) !== 'pastor_diretor') : waitlist}
              escalados={loteArea === 'Pastor Invisível' ? escaladosFora.filter(p => tituloPastor(p) && seloOrganizacao(p.id) !== 'pastor_diretor') : escaladosFora}
              areasEspeciais={NOMES_ESPECIAIS}
              atuacoes={atuacoesPorArea[loteArea] || []}
              onClose={() => setLoteArea(null)}
              onAlocado={() => fetchBackgroundData(false)}
            />
          );
        })()}

        <AlertDialog open={confirmandoDesfazerAuto} onOpenChange={setConfirmandoDesfazerAuto}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>{autoSituacao.lotes > 1 ? 'Desfazer a última alocação automática?' : 'Desfazer a alocação automática?'}</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {autoSituacao.lotes > 1 && (<>
                  Há <strong className="text-white">{autoSituacao.lotes} rodadas</strong> do Alocar automático.
                  Isto desfaz <strong className="text-white">só a última</strong>; as anteriores não são tocadas.
                  Para desfazer a anterior, clique no botão de novo depois.
                  <br /><br />
                </>)}
                {autoSituacao.no_lugar === 1
                  ? 'A pessoa que o Alocar automático colocou nesta rodada volta '
                  : `As ${autoSituacao.no_lugar || 0} pessoas que o Alocar automático colocou nesta rodada voltam `}
                para a fila “A escalar”.
                <br /><br />
                Quem foi <strong className="text-white">mexido à mão depois</strong> fica onde está
                {autoSituacao.total > autoSituacao.no_lugar ? ` (${autoSituacao.total - autoSituacao.no_lugar} hoje)` : ''},
                e quem foi <strong className="text-white">alocado à mão</strong> não é tocado. Os fixos 📌
                ficam nas suas áreas fixas.
                {autoSituacao.feito_por ? <><br /><br />Última alocação automática feita por {autoSituacao.feito_por}.</> : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDesfazerAutomatico} disabled={desfazendoAuto}
                className="bg-amber-600 hover:bg-amber-700 text-white">
                {desfazendoAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desfazer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {fixarAberto && (
          <FixarAreaDialog
            equipante={fixarAberto.eq}
            area={fixarAberto.area}
            fixasAtuais={fixasPorEquipante[fixarAberto.eq.id] || []}
            onClose={() => setFixarAberto(null)}
            onSalvo={() => fetchBackgroundData(false)}
          />
        )}

        <AlertDialog open={!!remocao} onOpenChange={(v) => { if (!v && !removendo) setRemocao(null); }}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Tirar {remocao?.nome} de {remocao?.area}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-gray-400 text-sm space-y-3">
                  {remocao?.soEstaArea ? (
                    <p>
                      {remocao.ficamEm?.length > 0
                        ? <>Só sai de <strong className="text-white">{remocao.area}</strong>; continua em {remocao.ficamEm.join(', ')}.</>
                        : <>É a única área dessa pessoa, então ela volta para a fila “A escalar”.</>}
                    </p>
                  ) : remocao?.outras.length > 0 ? (
                    <p>
                      <strong className="text-white">{remocao.nome}</strong> está escalado(a) também em{' '}
                      <strong className="text-amber-300">{remocao.outras.map(o => o.area).join(', ')}</strong>.
                      {' '}Deseja retirar de lá também?
                    </p>
                  ) : remocao?.juntoRegra?.length > 0 ? (
                    <p>Sem outras áreas, ela volta para a fila “A escalar”.</p>
                  ) : (
                    <p>É a única área dessa pessoa, então ela volta para a fila “A escalar”.</p>
                  )}
                  {remocao?.juntoRegra?.length > 0 && (
                    <p className="text-sky-200/90">
                      Sai junto da {remocao.juntoRegra.join(', ')}: todo Guia fica lá pela regra, e quem
                      deixa de ser Guia sai de lá também.
                    </p>
                  )}
                  {remocao?.avisoGuia && (
                    <p className="text-amber-200/90">
                      ⚠ {remocao.nome} é Guia, e pela regra todo Guia fica na {GUIA_TAMBEM_EM}. Se tirar
                      só daqui, só volta com “+ área” ou saindo e voltando ao Guia.
                    </p>
                  )}
                  {remocao?.fixas.length > 0 && (
                    <p className="text-amber-200/90">
                      📌 É fixo(a) em {remocao.fixas.join(', ')}. A marca continua: o próximo Alocar
                      automático coloca de volta. Para tirar a marca, use o alfinete.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800" disabled={removendo}>
                Cancelar
              </AlertDialogCancel>
              {remocao?.outras.length > 0 ? (
                <>
                  <Button variant="outline" onClick={() => executarRemocao(false)} disabled={removendo}
                    className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">
                    Não, só de {remocao.area}
                  </Button>
                  <Button onClick={() => executarRemocao(true)} disabled={removendo}
                    className="bg-red-600 hover:bg-red-700 text-white">
                    {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sim, de todas'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => executarRemocao(false)} disabled={removendo}
                  className="bg-red-600 hover:bg-red-700 text-white">
                  {removendo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tirar'}
                </Button>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!limparAreaAberta} onOpenChange={(v) => { if (!v && !limpandoArea) setLimparAreaAberta(null); }}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar {limparAreaAberta}?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {(() => {
                  const todos = limparAreaAberta ? getEquipantesByArea(limparAreaAberta) : [];
                  const guias = limparAreaAberta === GUIA_TAMBEM_EM
                    ? todos.filter(p => allocations.some(a => a.id === p.id && a.allocatedArea === AREA_GUIA)).length : 0;
                  const n = todos.length - guias;
                  return (n === 1 ? 'A pessoa desta área sai dela' : `As ${n} pessoas desta área saem dela`) +
                    (guias > 0 ? ` — ${guias === 1 ? 'o Guia continua' : `os ${guias} Guias continuam`} (regra: todo Guia fica na ${GUIA_TAMBEM_EM})` : '') +
                    (limparAreaAberta === AREA_GUIA ? ` e também da ${GUIA_TAMBEM_EM} que a regra dos Guias criou` : '');
                })()}{' '}
                (fixos 📌 inclusive). Quem não tem outra área volta para a fila “A escalar”; quem
                está em mais de uma área continua nas outras.
                <br /><br />
                A marca de fixo não se perde: o próximo “Alocar automático” coloca os fixos de volta.
                Atuação (líder) e cor de quem sair se perdem.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800" disabled={limpandoArea}>
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleLimparArea(); }} disabled={limpandoArea}
                className="bg-red-600 hover:bg-red-700 text-white">
                {limpandoArea ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Limpar área'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmandoLancamento} onOpenChange={setConfirmandoLancamento}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Lançar a escala provisória?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {/* O numero vem de escala.escalados, nao de allocations.length:
                    quem esta em "Não será escalado" tambem tem linha em escalas,
                    mas NAO vai poder pagar. */}
                A partir de agora, <strong className="text-white">
                  {escala?.escalados === 1
                    ? '1 equipante escalado vai ver a sua área e poder pagar'
                    : `os ${escala?.escalados ?? 0} equipantes escalados vão ver a sua área e poder pagar`}
                </strong> a taxa de alimentação, e cada líder passa a ver a relação da sua equipe para a
                chamada da reunião de escala.
                {escala?.nao_serao_escalados > 0 && (
                  <>
                    <br /><br />
                    {escala.nao_serao_escalados === 1
                      ? 'A pessoa marcada como '
                      : `As ${escala.nao_serao_escalados} pessoas marcadas como `}
                    “Não será escalado” {escala.nao_serao_escalados === 1 ? 'vai ver' : 'vão ver'}{' '}
                    <strong className="text-white">“Cancelado — verificar com a Direção”</strong> e não
                    {escala.nao_serao_escalados === 1 ? ' conseguirá' : ' conseguirão'} pagar.
                  </>
                )}
                {avisoSemCorLancamento}
                <br /><br />
                Você ainda pode realocar pessoas depois, e dá para desfazer o lançamento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleLancarEscala} disabled={lancando} className="bg-amber-600 hover:bg-amber-700 text-white">
                {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar provisória'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmandoDesfazer} onOpenChange={setConfirmandoDesfazer}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Desfazer a escala provisória?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Os equipantes voltam a ver “aguardando a escala” e quem ainda não pagou perde o acesso
                ao pagamento. Os líderes deixam de ver a relação da equipe. A chamada que já foi feita
                fica guardada, e <strong className="text-white">quem já pagou continua pago</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDesfazerLancamento} disabled={lancando} className="bg-red-600 hover:bg-red-700 text-white">
                {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desfazer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmandoOficial} onOpenChange={setConfirmandoOficial}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Lançar a escala oficial?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                A escala fica definitiva para{' '}
                <strong className="text-white">
                  {escala?.escalados === 1 ? '1 equipante escalado' : `os ${escala?.escalados ?? 0} equipantes escalados`}
                </strong>, e a etapa “Escala de trabalho” fica concluída no site de cada um.
                {avisoSemCorLancamento}
                <br /><br />
                Dá para desfazer depois.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleLancarOficial} disabled={lancando} className="bg-green-600 hover:bg-green-700 text-white">
                {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar oficial'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmandoDesfazerOficial} onOpenChange={setConfirmandoDesfazerOficial}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Desfazer a escala oficial?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Volta a valer a escala provisória. Nada muda no pagamento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDesfazerOficial} disabled={lancando} className="bg-red-600 hover:bg-red-700 text-white">
                {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desfazer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Filtro das areas (13/10/2026). */}
        {(() => {
          const termo = buscaNasAreas.trim();
          const visiveis = AREAS_NO_CORPO
            .filter(area => areaFiltro === 'todas' || area === areaFiltro)
            .filter(area => !termo || (filtradosPorArea?.[area] || VAZIO).length > 0);
          const encontrados = termo
            ? visiveis.reduce((t, area) => t + (filtradosPorArea?.[area] || VAZIO).length, 0)
            : null;
          return (
            <>
              <div ref={filtroAreasRef} className="mt-8 mb-4 flex flex-col sm:flex-row gap-2 sm:items-center scroll-mt-4">
                <Select value={areaFiltro} onValueChange={setAreaFiltro}>
                  <SelectTrigger className="h-10 sm:w-[260px] bg-black/40 border-white/20 text-white">
                    <SelectValue placeholder="Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as áreas</SelectItem>
                    {AREAS_NO_CORPO.map(area => (
                      <SelectItem key={area} value={area}>{area} ({getEquipantesByArea(area).length})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <CampoBusca
                    value={buscaNasAreas} onChange={setBuscaNasAreas}
                    placeholder="Filtrar os nomes nas tabelas abaixo..."
                    className="h-10 pl-8 pr-8 bg-black/40 border-white/20 text-white placeholder:text-gray-500"
                  />
                  {buscaNasAreas && (
                    <button type="button" onClick={() => setBuscaNasAreas('')} aria-label="Limpar a busca"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {(areaFiltro !== 'todas' || termo) && (
                  <Button variant="ghost" onClick={() => { setAreaFiltro('todas'); setBuscaNasAreas(''); }}
                    className="h-10 text-gray-300 hover:text-white hover:bg-white/10">Limpar filtro</Button>
                )}
              </div>
              {termo && (
                <p className="-mt-2 mb-3 text-xs text-gray-400">
                  {encontrados} {encontrados === 1 ? 'pessoa encontrada' : 'pessoas encontradas'} em {visiveis.length} {visiveis.length === 1 ? 'área' : 'áreas'}.
                  {' '}As Áreas Especiais (Guia, Inimigo...) ficam no módulo próprio.
                </p>
              )}
              <div className="flex flex-col gap-6">
                {visiveis.length === 0 && (
                  <p className="text-center py-10 text-gray-500">Ninguém escalado bate com a busca.</p>
                )}
                {visiveis.map(area => renderCartaoArea(area, true))}
              </div>
            </>
          );
        })()}
      </div>
    </Layout>;
};
export default OrganizerScalesPage;