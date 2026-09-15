import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { WORK_AREAS, AREAS_ESPECIAIS, DEFAULT_AREA_CAPACITY, CORES_GRUPO, areaTemCor } from '@/constants/workAreas';
import { fetchApprovedEquipantes, saveScales, fetchAllAllocations, detectAllocationChanges, fetchAtuacoesPorArea, definirAtuacao,
  definirCor, contarAguardandoAprovacao, fetchSituacaoEscala, lancarEscala, desfazerLancamentoEscala,
  alocarFilaAutomaticamente } from '@/services/scalesService';
import { fetchLimitesAreas, saveLimiteAreaComGenero, getLimiteAreaComGenero } from '@/services/limiteAreasService';
import { verifyDatabaseSchema } from '@/services/databaseVerification';
import { exportEquipantesByArea, exportAllEquipantes } from '@/utils/excelExport';
import { batchUpdateWorkScheduleStatus } from '@/services/workScheduleService';
import { alocarEquipanteManualmente, realocarAlocacao, removerAlocacao, alocarAreasEspeciaisPorCpf } from '@/services/equipanteAllocationService';
import { fetchConfiguracoes } from '@/services/organizerConfigService';
import { Grid, Loader2, AlertTriangle, CheckCircle, Download, AlertCircle, Search, Send, Undo2, X, Truck, Sparkles, Wand2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import AreaLimitHeader from '@/components/scales/AreaLimitHeader';
import EquipantesGridDisplay from '@/components/scales/EquipantesGridDisplay';
import AreasExtraDialog from '@/components/scales/AreasExtraDialog';
import AreasEspeciaisDialog from '@/components/scales/AreasEspeciaisDialog';
import { nomeDaIgreja } from '@/constants/igrejas';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
const AREAS_NO_CORPO = WORK_AREAS.filter(area => !NOMES_ESPECIAIS.includes(area));

const OrganizerScalesPage = () => {
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
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
  const [confirmandoLancamento, setConfirmandoLancamento] = useState(false);
  const [confirmandoDesfazer, setConfirmandoDesfazer] = useState(false);
  const [lancando, setLancando] = useState(false);

  // Areas de Trabalho Extra: painel a parte, so de leitura + resposta.
  // Nao mexe em escalas nem no lancamento -- ver AreasExtraDialog.jsx.
  const [verAreasExtra, setVerAreasExtra] = useState(false);
  const [verAreasEspeciais, setVerAreasEspeciais] = useState(false);

  // Alocacao automatica pelas 3 preferencias -- ver o comentario grande
  // em scalesService.alocarFilaAutomaticamente.
  const [confirmandoAuto, setConfirmandoAuto] = useState(false);
  const [alocandoAuto, setAlocandoAuto] = useState(false);

  // Aplicacao das 3 listas de CPF pre-cadastradas em Configuracoes -- ver
  // handleAlocarPorCpf, abaixo.
  const [alocandoPorCpf, setAlocandoPorCpf] = useState(false);

  const semAcento = (texto) => (texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const termoBusca = semAcento(buscaFila.trim());
  const digitosBusca = termoBusca.replace(/\D/g, '');
  const filaFiltrada = termoBusca
    ? waitlist.filter(eq =>
        semAcento(eq.nome).includes(termoBusca) ||
        semAcento(nomeDaIgreja(eq)).includes(termoBusca) ||
        (digitosBusca !== '' && (eq.cpf || '').replace(/\D/g, '').includes(digitosBusca)) ||
        semAcento(eq.area_trabalho_opcao1).includes(termoBusca) ||
        semAcento(eq.area_trabalho_opcao2).includes(termoBusca) ||
        semAcento(eq.area_trabalho_opcao3).includes(termoBusca)
      )
    : waitlist;

  // As 3 preferencias da pessoa, sem repeticao e so as que existem hoje
  // como area de verdade (uma preferencia antiga pode ter sido renomeada).
  const preferenciasValidas = (eq) => [
    eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3
  ].filter((a, i, todas) => a && WORK_AREAS.includes(a) && todas.indexOf(a) === i);


  // Quantas areas cada pessoa tem. Uma pessoa pode aparecer em varias
  // tabelas -- nas escalas oficiais ~55 por edicao trabalham em duas areas
  // e algumas em tres.
  const areasPorEquipante = allocations.reduce((acc, a) => {
    acc[a.id] = (acc[a.id] || 0) + 1;
    return acc;
  }, {});

  // Contagem de PESSOAS, nao de participacoes: quem esta em duas areas tem
  // duas linhas em `allocations`, mas e uma pessoa so.
  const pessoasEscaladas = new Set(allocations.map(a => a.id)).size;

  // Quantos estao nos tres papeis especiais -- o numero no botao que abre o
  // modulo. E por PARTICIPACAO, mas como ninguem pode ter dois dos tres, da
  // no mesmo que contar pessoas.
  const totalEspeciais = allocations.filter(a => NOMES_ESPECIAIS.includes(a.allocatedArea)).length;

  // Resultado da busca "onde o fulano esta?". Agrupa as participacoes por
  // pessoa, para responder numa linha so em vez de obrigar o organizador a
  // varrer as 40 tabelas.
  const termoEscalados = semAcento(buscaEscalados.trim());
  const escaladosEncontrados = !termoEscalados ? [] : Object.values(
    allocations.reduce((acc, a) => {
      (acc[a.id] = acc[a.id] || { id: a.id, nome: a.nome, igreja: nomeDaIgreja(a), cpf: a.cpf, areas: [] })
        .areas.push({ area: a.allocatedArea, atuacao: a.atuacao, escalaId: a.escalaId });
      return acc;
    }, {})
  ).filter(p =>
    semAcento(p.nome).includes(termoEscalados) ||
    semAcento(p.igreja).includes(termoEscalados) ||
    (p.cpf || '').replace(/\D/g, '').includes(termoEscalados.replace(/\D/g, '') || ' ') ||
    p.areas.some(x => semAcento(x.area).includes(termoEscalados))
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  
  const previousAllocationsRef = useRef([]);
  const saveTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  
  const { toast } = useToast();

  const fetchBackgroundData = async (showLoading = false) => {
    if (isFetchingRef.current) return;
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

      const idsAlocados = new Set((existingAllocations || []).map(a => a.id));
      setWaitlist((equipantes || []).filter(eq => !idsAlocados.has(eq.id)));
      setAguardandoAprovacao(await contarAguardandoAprovacao());
      setEscala(await fetchSituacaoEscala());

      if (existingAllocations && existingAllocations.length > 0) {
        const changed = detectAllocationChanges(existingAllocations, previousAllocationsRef.current);
        if (changed.length > 0 || allocations.length !== existingAllocations.length) {
          setAllocations(existingAllocations);
          previousAllocationsRef.current = [...existingAllocations];
        }
      } else if (existingAllocations?.length === 0 && allocations.length > 0) {
        setAllocations([]);
        previousAllocationsRef.current = [];
      }
    } catch (error) {
      console.error("Background fetch error:", error);
    } finally {
      isFetchingRef.current = false;
      if (showLoading) setLoadingLimits(false);
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
    if (anterior === novaAtuacao) return;

    setSalvandoAtuacao(prev => ({ ...prev, [escalaId]: true }));
    setAllocations(prev => prev.map(a => (a.escalaId === escalaId ? { ...a, atuacao: novaAtuacao } : a)));
    // Mantém o "antes" alinhado com o "agora": sem isso o efeito de
    // auto-save enxergaria uma diferença e tentaria regravar a escala.
    previousAllocationsRef.current = previousAllocationsRef.current.map(
      a => (a.escalaId === escalaId ? { ...a, atuacao: novaAtuacao } : a)
    );

    const resultado = await definirAtuacao(escalaId, novaAtuacao);

    if (!resultado.success) {
      setAllocations(prev => prev.map(a => (a.escalaId === escalaId ? { ...a, atuacao: anterior } : a)));
      previousAllocationsRef.current = previousAllocationsRef.current.map(
        a => (a.escalaId === escalaId ? { ...a, atuacao: anterior } : a)
      );
      toast({
        title: "Não foi possível salvar a atuação",
        description: resultado.error,
        variant: "destructive"
      });
    }

    setSalvandoAtuacao(prev => ({ ...prev, [escalaId]: false }));
  };

  // Cor do grupo de trilha. Vale so nas nove areas que trabalham divididas
  // por cor, e e opcional -- "Sem cor" e uma resposta legitima.
  const handleDefinirCor = async (escalaId, novaCor) => {
    setSalvandoCor(prev => ({ ...prev, [escalaId]: true }));
    try {
      const r = await definirCor(escalaId, novaCor);
      if (!r?.ok) {
        toast({ title: 'Não deu certo', description: r?.erro, variant: 'destructive' });
        return;
      }
      setAllocations(prev => prev.map(a =>
        a.escalaId === escalaId ? { ...a, cor: novaCor || null } : a));
    } catch (error) {
      toast({
        title: 'Erro ao definir a cor',
        description: error.message || 'Tente de novo.',
        variant: 'destructive'
      });
    } finally {
      setSalvandoCor(prev => ({ ...prev, [escalaId]: false }));
    }
  };

  useEffect(() => {
    loadInitialData();
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
        const r = await alocarEquipanteManualmente(equipanteId, area);
        if (r.success) feitas.push(area); else falhas.push(`${area}: ${r.error}`);
      }

      if (feitas.length > 0) {
        toast({
          title: feitas.length === 1 ? "Alocado" : `Alocado em ${feitas.length} áreas`,
          description: `${nomeEquipante} → ${feitas.join(' + ')}.` +
            (falhas.length ? ` Não coube em: ${falhas.join(' · ')}` : ''),
          className: falhas.length ? undefined : "bg-green-600 text-white",
          variant: falhas.length ? "destructive" : undefined
        });
        setAreasDaFila(prev => { const n = { ...prev }; delete n[equipanteId]; return n; });
        fetchBackgroundData(false);
      } else {
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
  const handleRealocar = async (escalaId, nomeEquipante, areaAtual) => {
    const novaArea = manualAreaChoice[escalaId];
    if (!novaArea) {
      toast({ title: "Escolha a área de destino", variant: "destructive" });
      return;
    }
    setManualAllocating(prev => ({ ...prev, [escalaId]: true }));
    try {
      const resultado = await realocarAlocacao(escalaId, novaArea);
      if (resultado.success) {
        toast({
          title: "Movido",
          description: `${nomeEquipante}: ${areaAtual} → ${novaArea}.`,
          className: "bg-green-600 text-white"
        });
        setManualAreaChoice(prev => { const n = { ...prev }; delete n[escalaId]; return n; });
        fetchBackgroundData(false);
      } else {
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
      const resultado = await alocarEquipanteManualmente(equipanteId, novaArea);
      if (resultado.success) {
        toast({
          title: `Escalado também em ${novaArea}`,
          description: `${nomeEquipante} agora trabalha em mais de uma área.`,
          className: "bg-green-600 text-white"
        });
        setManualAreaChoice(prev => { const n = { ...prev }; delete n[escalaId]; return n; });
        fetchBackgroundData(false);
      } else {
        toast({ title: "Não foi possível escalar", description: resultado.error, variant: "destructive" });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [escalaId]: false }));
    }
  };

  // Tira a pessoa de UMA area. Se for a unica dela, volta para a fila -- e
  // por isso pede confirmacao nesse caso.
  const handleRemover = async (escalaId, nomeEquipante, areaAtual, quantasAreas) => {
    if (quantasAreas <= 1) {
      const ok = window.confirm(
        `Tirar ${nomeEquipante} de ${areaAtual}?\n\n` +
        'É a única área dela, então volta para a fila "A escalar".'
      );
      if (!ok) return;
    }
    setManualAllocating(prev => ({ ...prev, [escalaId]: true }));
    try {
      const resultado = await removerAlocacao(escalaId);
      if (resultado.success) {
        toast({
          title: `Removido de ${areaAtual}`,
          description: resultado.restam > 0
            ? `${nomeEquipante} continua em ${resultado.restam} área(s).`
            : `${nomeEquipante} voltou para a fila "A escalar".`
        });
        fetchBackgroundData(false);
      } else {
        toast({ title: "Não foi possível remover", description: resultado.error, variant: "destructive" });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [escalaId]: false }));
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
      r.opcao1 > 0 && `${r.opcao1} na 1ª opção`,
      r.opcao2 > 0 && `${r.opcao2} na 2ª`,
      r.opcao3 > 0 && `${r.opcao3} na 3ª`,
      r.coringa > 0 && `${r.coringa} de "qualquer área"`
    ].filter(Boolean).join(', ');

    toast({
      title: r.alocados === 0 ? 'Ninguém foi alocado' : `${r.alocados} alocado(s)`,
      description: [
        detalhe,
        r.sobraram > 0 && `${r.sobraram} ${r.sobraram === 1 ? 'continua' : 'continuam'} na fila — sem vaga nas opções escolhidas. Coloque à mão.`
      ].filter(Boolean).join('. ') || 'A fila já estava vazia.',
      className: r.alocados > 0 ? 'bg-green-600 text-white' : undefined
    });

    fetchBackgroundData(false);
  };

  // Aplica as 3 listas de CPF pre-cadastradas em Configuracoes -> Areas de
  // Trabalho Especiais (Guia, Inimigo, Espirito Santo -- ver
  // CpfsAreaEspecialManager.jsx) contra quem ja esta aprovado, casando por
  // CPF. Busca a configuracao na hora do clique (em vez de manter uma copia
  // sincronizada aqui) porque e uma acao pontual, nao algo que precisa
  // reagir a mudanca em tempo real.
  const handleAlocarPorCpf = async () => {
    setAlocandoPorCpf(true);
    try {
      const configAtual = await fetchConfiguracoes();
      const cpfsPorArea = {
        guia: configAtual.cpfs_area_guia || [],
        inimigo: configAtual.cpfs_area_inimigo || [],
        espirito_santo: configAtual.cpfs_area_espirito_santo || []
      };

      if (Object.values(cpfsPorArea).every(lista => lista.length === 0)) {
        toast({
          title: 'Nada para aplicar',
          description: 'Cadastre CPFs em Configurações → Áreas de Trabalho Especiais primeiro.'
        });
        return;
      }

      const r = await alocarAreasEspeciaisPorCpf(cpfsPorArea, equipantesAprovados, allocations);
      const aplicados = r.alocados + r.realocados;

      const detalhe = [
        r.alocados > 0 && `${r.alocados} alocado(s)`,
        r.realocados > 0 && `${r.realocados} realocado(s)`,
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

  const getEquipantesByArea = areaName => {
    return allocations.filter(a => a.allocatedArea === areaName);
  };

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
  const renderCartaoArea = (area) => {
    const areaEquipantes = getEquipantesByArea(area);
    const limitObj = getLimiteAreaComGenero(area, limitsMap, DEFAULT_AREA_CAPACITY);
    const mulheresCount = getGenderCount(areaEquipantes, 'feminino');
    const homensCount = getGenderCount(areaEquipantes, 'masculino');
    const atuacoesDaArea = atuacoesPorArea[area] || [];

    // A área tem líder previsto na escala oficial e ninguém está com
    // essa atuação -- só avisa se já houver gente na área (numa área
    // vazia o aviso seria ruído).
    const atuacoesDeLider = atuacoesDaArea.filter(a => a.ehLider).map(a => a.atuacao);
    const temCor = areaTemCor(area);

    // Nas areas divididas por cor, um lider por area nao basta: cada
    // cor tem o seu (5 guias no vermelho, um deles e o lider do
    // vermelho). Entao o aviso olha cor a cor, e so para as cores que
    // realmente tem gente.
    const coresEmUso = temCor
      ? CORES_GRUPO.filter(cor => areaEquipantes.some(eq => eq.cor === cor))
      : [];
    const coresSemLider = coresEmUso.filter(cor =>
      !areaEquipantes.some(eq => eq.cor === cor && atuacoesDeLider.includes(eq.atuacao)));

    const faltaLider = atuacoesDeLider.length > 0 && areaEquipantes.length > 0 && (
      temCor
        ? coresSemLider.length > 0
        : !areaEquipantes.some(eq => atuacoesDeLider.includes(eq.atuacao))
    );

    return <div key={area} className="bg-black/40 border border-white/10 rounded-lg overflow-hidden shadow-md backdrop-blur-sm">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-white/10">
            <AreaLimitHeader areaName={area} currentCount={areaEquipantes.length} currentMulheres={mulheresCount} currentHomens={homensCount} limitObj={limitObj} onSaveLimit={handleUpdateLimit} isOrganizer={true} faltaLider={faltaLider} coresSemLider={coresSemLider} />
          </div>

          <div className="p-4 max-h-[400px] overflow-y-auto">
            {loadingLimits ? <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div> : <EquipantesGridDisplay equipantes={areaEquipantes} areaName={area} onExport={handleExportArea} onRealocar={handleRealocar} onAdicionarArea={handleAdicionarArea} onRemover={handleRemover} areasPorEquipante={areasPorEquipante} realocarAreaChoice={manualAreaChoice} onRealocarAreaChoiceChange={(id, val) => setManualAreaChoice(prev => ({ ...prev, [id]: val }))} realocando={manualAllocating} atuacoes={atuacoesDaArea} onDefinirAtuacao={handleDefinirAtuacao} salvandoAtuacao={salvandoAtuacao} mostrarCor={temCor} onDefinirCor={handleDefinirCor} salvandoCor={salvandoCor} />}
          </div>
        </div>;
  };

  return <Layout>
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

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Grid className="h-8 w-8 text-red-500" />
              Geração de Escalas
            </h1>
            <p className="text-gray-400">Você monta a escala: aprovar não coloca ninguém em área nenhuma.</p>

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
              <p className={cn('text-xs mt-2', escala.lancada_em ? 'text-green-400' : 'text-amber-400/90')}>
                {escala.lancada_em
                  ? `Escala lançada em ${new Date(escala.lancada_em).toLocaleString('pt-BR')} — os escalados já podem pagar.`
                  : escala.faltam > 0
                    ? `Escala ainda não lançada. ${escala.faltam === 1
                        ? 'Falta 1 equipante sem destino'
                        : `Faltam ${escala.faltam} equipantes sem destino`} — distribua (ou marque como “Não será escalado”) para poder lançar.`
                    : !escala.escalados
                      ? 'Escala ainda não lançada — e não há ninguém escalado. Coloque pelo menos um equipante em uma área para poder lançar.'
                      : 'Todos distribuídos. A escala já pode ser lançada.'}
                {escala.nao_serao_escalados > 0 && ` · ${escala.nao_serao_escalados === 1
                  ? '1 não será escalado' : `${escala.nao_serao_escalados} não serão escalados`}.`}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap justify-end">
            {/* Distribui a fila pelas preferencias da inscricao. So aparece
                habilitado quando ha alguem esperando. */}
            <Button onClick={() => setConfirmandoAuto(true)}
              disabled={waitlist.length === 0 || alocandoAuto}
              variant="outline"
              title={waitlist.length === 0 ? 'A fila "A escalar" está vazia.' : undefined}
              className="bg-purple-600/20 text-purple-300 border-purple-600/50 hover:bg-purple-600/40 hover:text-purple-200">
              {alocandoAuto
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Wand2 className="mr-2 h-4 w-4" />}
              Alocar automático{waitlist.length > 0 ? ` (${waitlist.length})` : ''}
            </Button>

            <Button onClick={handleExportAll} disabled={allocations.length === 0} variant="outline" className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/40 hover:text-green-300">
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>

            <Button onClick={() => setVerAreasEspeciais(true)} variant="outline"
              className="bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white">
              <Sparkles className="mr-2 h-4 w-4" /> Áreas Especiais ({totalEspeciais})
            </Button>

            {/* Os 3 mutiroes da Centenario (caminhao, cozinha, limpeza). Fica
                aqui porque e o organizador de escalas quem organiza isso --
                mas e uma lista a parte: nao entra na escala, nao conta para
                "faltam N" e nao interfere no lancamento. */}
            <Button onClick={() => setVerAreasExtra(true)} variant="outline"
              className="bg-blue-600/20 text-blue-300 border-blue-600/50 hover:bg-blue-600/40 hover:text-blue-200">
              <Truck className="mr-2 h-4 w-4" /> Áreas Extras
            </Button>

            {/* Lancar a escala e o que faz o equipante ver a etapa concluida
                e poder pagar. So libera com a fila zerada -- todo aprovado
                precisa ter destino, nem que seja "Não será escalado". */}
            {escala?.lancada_em ? (
              <Button onClick={() => setConfirmandoDesfazer(true)} variant="outline"
                className="bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white">
                <Undo2 className="mr-2 h-4 w-4" /> Desfazer lançamento
              </Button>
            ) : (
              <Button onClick={() => setConfirmandoLancamento(true)}
                disabled={!escala || escala.faltam > 0 || !escala.escalados}
                title={escala?.faltam > 0
                  ? 'Distribua todos os equipantes antes de lançar a escala.'
                  : escala && !escala.escalados
                    ? 'Não há ninguém escalado. Coloque pelo menos um equipante em uma área.'
                    : undefined}
                className="bg-amber-600 hover:bg-amber-700 text-white disabled:bg-white/5 disabled:text-white/40 disabled:border disabled:border-white/20">
                <Send className="mr-2 h-4 w-4" />
                Lançar escala{escala?.faltam > 0 ? ` (faltam ${escala.faltam})` : ''}
              </Button>
            )}
          </div>
        </div>

        {dbVerification.checked && !dbVerification.valid && <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-md flex items-center gap-3">
             <AlertTriangle className="h-5 w-5 text-red-400" />
             <p className="text-red-200 text-sm">Atenção: A estrutura do banco de dados parece estar incompleta.</p>
          </div>}

        {/* A fila de trabalho do organizador: aprovados que ainda nao estao
            em area nenhuma. Antes isso se chamava "Lista de Espera — sem
            vaga nas 3 opções", porque so caia aqui quem a alocacao
            automatica nao tinha conseguido encaixar. Agora a aprovacao nao
            aloca mais ninguem, entao TODO aprovado passa por aqui. */}
        {waitlist.length > 0 && <Card ref={filaRef} className="bg-red-900/10 border-red-900/30 scroll-mt-24">
            <div className="p-4 border-b border-red-900/30 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <AlertTriangle className="text-red-400 h-5 w-5 shrink-0" />
                <h3 className="font-semibold text-white">
                  A escalar ({waitlist.length})
                  {filaFiltrada.length !== waitlist.length && (
                    <span className="font-normal text-red-200/70 text-sm"> · {filaFiltrada.length} na busca</span>
                  )}
                </h3>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input
                  value={buscaFila}
                  onChange={(e) => setBuscaFila(e.target.value)}
                  placeholder="Buscar por nome, igreja, CPF ou área..."
                  className="h-9 pl-8 bg-black/40 border-white/20 text-white"
                />
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[32rem] overflow-y-auto">
              {filaFiltrada.length === 0 && (
                <p className="text-sm text-red-200/60 text-center py-4">Ninguém na fila corresponde a “{buscaFila}”.</p>
              )}
              {/* Renderiza no maximo 100 de uma vez: com ~900 na fila, montar
                  900 blocos com 2 menus cada trava a tela sem necessidade.
                  Quem procura alguem especifico usa a busca. */}
              {filaFiltrada.slice(0, LIMITE_FILA_VISIVEL).map((eq) => (
                <div key={eq.id} className="bg-red-900/20 border border-red-700/30 rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {eq.nome} <span className="text-xs text-red-300/70">({eq.sexo})</span>
                    </p>
                    <p className="text-[11px] text-gray-500 truncate mb-1.5" title={nomeDaIgreja(eq) || ''}>{nomeDaIgreja(eq) || '—'}</p>

                    {/* As 3 areas que a PESSOA marcou na inscricao. E
                        sugestao: a escolha final e sua -- por isso o menu
                        ao lado continua com as 40 areas. */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">
                        Pediu (sugestão)
                      </span>
                      {[eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3].map((area, i) => (
                        <span
                          key={i}
                          className={cn(
                            "text-[11px] px-1.5 py-0.5 rounded border",
                            area
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border-white/10 bg-white/5 text-gray-600"
                          )}
                        >
                          <span className="opacity-60 mr-1">{i + 1}ª</span>{area || '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                    {/* As areas ja escolhidas, como selos removiveis. */}
                    {(areasDaFila[eq.id] || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {(areasDaFila[eq.id] || []).map(area => (
                          <button
                            key={area}
                            onClick={() => alternarAreaDaFila(eq.id, area)}
                            title={`Tirar ${area} da escolha`}
                            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
                          >
                            {area} <X className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                    <Select
                      value=""
                      onValueChange={(val) => alternarAreaDaFila(eq.id, val)}
                    >
                      <SelectTrigger className="h-9 w-[200px] bg-black/40 border-white/20 text-white text-xs">
                        <span className="truncate">
                          {(areasDaFila[eq.id] || []).length === 0
                            ? 'Escolher área'
                            : `Adicionar outra (${(areasDaFila[eq.id] || []).length}/${MAX_AREAS_DE_UMA_VEZ})`}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {/* As 3 escolhas da pessoa vem primeiro, num grupo
                            separado -- e o que o organizador vai usar na
                            maioria das vezes, e evita procurar o nome no
                            meio das 40 areas. Todas as areas continuam
                            logo abaixo: a decisao e dele. */}
                        {preferenciasValidas(eq).length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-amber-300/80 text-[11px]">
                              O que o equipante pediu
                            </SelectLabel>
                            {preferenciasValidas(eq).map(area => (
                              <SelectItem key={`pref-${area}`} value={area}>★ {area}</SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        <SelectGroup>
                          <SelectLabel className="text-gray-400 text-[11px]">Todas as áreas</SelectLabel>
                          {WORK_AREAS.filter(area => !preferenciasValidas(eq).includes(area)).map(area => (
                            <SelectItem key={area} value={area}>{area}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => handleManualAllocate(eq.id, eq.nome)}
                      disabled={(areasDaFila[eq.id] || []).length === 0 || manualAllocating[eq.id]}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                    >
                      {manualAllocating[eq.id]
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : `Alocar${(areasDaFila[eq.id] || []).length > 1 ? ` (${areasDaFila[eq.id].length})` : ''}`}
                    </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filaFiltrada.length > LIMITE_FILA_VISIVEL && (
                <p className="text-sm text-red-200/60 text-center py-2">
                  Mostrando {LIMITE_FILA_VISIVEL} de {filaFiltrada.length}. Use a busca para chegar em alguém específico.
                </p>
              )}
            </div>
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
              <Input
                value={buscaEscalados}
                onChange={(e) => setBuscaEscalados(e.target.value)}
                placeholder="Buscar por nome, igreja, CPF ou área..."
                className="h-9 w-full sm:w-96 bg-black/40 border-white/20 text-white"
              />
            </div>

            {termoEscalados && (
              <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
                {escaladosEncontrados.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Ninguém escalado corresponde a “{buscaEscalados}”.
                  </p>
                )}
                {escaladosEncontrados.slice(0, 40).map(p => (
                  <div key={p.id} className="bg-white/5 border border-white/10 rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {p.nome}
                        {p.areas.length > 1 && (
                          <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {p.areas.length} áreas
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{p.igreja || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.areas.map(x => (
                        <span key={x.escalaId} className="text-[11px] px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-200">
                          {x.area}
                          {x.atuacao && <span className="text-green-400/70"> · {x.atuacao}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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
          {verAreasExtra && <AreasExtraDialog onClose={() => setVerAreasExtra(false)} />}
          {verAreasEspeciais && (
            <AreasEspeciaisDialog
              total={totalEspeciais}
              onClose={() => setVerAreasEspeciais(false)}
              onAplicarCpfs={handleAlocarPorCpf}
              aplicandoPorCpf={alocandoPorCpf}
            >
              {NOMES_ESPECIAIS.map(renderCartaoArea)}
            </AreasEspeciaisDialog>
          )}
        </AnimatePresence>

        <AlertDialog open={confirmandoAuto} onOpenChange={setConfirmandoAuto}>
          <AlertDialogContent className="bg-gray-900 border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle>Alocar pelas preferências?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {waitlist.length === 1
                  ? 'A pessoa da fila vai '
                  : `As ${waitlist.length} pessoas da fila vão `}
                para as áreas que escolheram na inscrição, respeitando o teto de cada
                área e o limite por sexo.
                <br /><br />
                <strong className="text-white">Primeiro todo mundo na 1ª opção</strong>, depois
                quem sobrou na 2ª, depois na 3ª — assim ninguém perde a 1ª opção para a 3ª de
                outra pessoa. Quem marcou “Disponível para qualquer área” fica para o fim.
                <br /><br />
                Guia, Inimigo, Espírito Santo e as demais áreas que só a diretoria preenche
                <strong className="text-white"> não recebem ninguém</strong> por aqui. Quem já
                está escalado não sai do lugar, e você pode mudar tudo depois.
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

        <AlertDialog open={confirmandoLancamento} onOpenChange={setConfirmandoLancamento}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Lançar a escala?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {/* O numero vem de escala.escalados, nao de allocations.length:
                    quem esta em "Não será escalado" tambem tem linha em escalas,
                    mas NAO vai poder pagar. */}
                A partir de agora, <strong className="text-white">
                  {escala?.escalados === 1
                    ? '1 equipante escalado vai poder iniciar o pagamento'
                    : `os ${escala?.escalados ?? 0} equipantes escalados vão poder iniciar o pagamento`}
                </strong> da taxa de alimentação, e vão ver a etapa “Escala de trabalho” como concluída.
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
                <br /><br />
                Você ainda pode realocar pessoas depois, e dá para desfazer o lançamento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleLancarEscala} disabled={lancando} className="bg-amber-600 hover:bg-amber-700 text-white">
                {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar escala'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmandoDesfazer} onOpenChange={setConfirmandoDesfazer}>
          <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Desfazer o lançamento?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Quem ainda não pagou volta a ver “aguardando a escala” e perde o acesso ao pagamento.
                <br /><br />
                <strong className="text-white">Quem já pagou continua pago</strong> — nada é desfeito no
                pagamento.
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

        <div className="flex flex-col gap-6">
          {AREAS_NO_CORPO.map(renderCartaoArea)}
        </div>
      </div>
    </Layout>;
};
export default OrganizerScalesPage;