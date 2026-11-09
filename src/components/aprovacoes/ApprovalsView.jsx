import React, { useState, useEffect, useMemo, useRef } from 'react';
import { minhasIgrejasParceiro } from '@/services/senhasParceirosService';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Baby, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MenorAprovacaoDialog from '@/components/aprovacoes/MenorAprovacaoDialog';
import AprovacoesStatsCards from '@/components/aprovacoes/AprovacoesStatsCards';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import AprovacoesTable from '@/components/aprovacoes/AprovacoesTable';
import { fetchEquipantesRaw, updateEquipanteStatus, fetchMenoresDaAprovacao, liberarMenor, definirSoDomingoPendente } from '@/services/equipantesService';
import { indexarMenores } from '@/utils/menorAprovacao';
import { useAuth } from '@/contexts/AuthContext';
import { liberarVagaERealocar } from '@/services/equipanteAllocationService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const ApprovalsView = ({
  pageTitle = "Aprovações de Equipantes",
  pageDescription = "Aprove ou rejeite as inscrições de equipantes",
  showStatistics = true
}) => {
  const { toast } = useToast();
  const { isParceiro, isOrganizador, igrejaUser } = useAuth();
  const [inscricoes, setInscricoes] = useState([]);
  const [selectedInscricao, setSelectedInscricao] = useState(null);
  const [inscricaoParaCancelar, setInscricaoParaCancelar] = useState(null);
  // Pendente que vai mudar para "Só Domingo" (ou voltar para todos os dias).
  const [inscricaoParaDomingo, setInscricaoParaDomingo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Global Search states
  // Aba aberta. Precisa ser estado (e nao defaultValue) porque os cartoes de
  // cima tambem trocam de aba.
  const [aba, setAba] = useState('pendentes');
  const [searchTermPendentes, setSearchTermPendentes] = useState('');
  const [searchTermAprovadas, setSearchTermAprovadas] = useState('');
  const [searchTermRejeitadas, setSearchTermRejeitadas] = useState('');
  const buscaPendentesRef = useRef(null);

  // Quem procurou alguem pelo nome na aba Pendentes e decidiu (aprovou ou
  // rejeitou) quase sempre vai procurar a proxima pessoa: a busca zera e o
  // cursor volta para ela (pedido de 07/10/2026). Sem nada digitado nao mexe
  // -- quem aprova rolando a lista nao e puxado de volta para o topo.
  const voltarParaBuscaPendentes = (inscricao) => {
    if (inscricao.status !== 'pendente' || !searchTermPendentes) return;
    setSearchTermPendentes('');
    requestAnimationFrame(() => buscaPendentesRef.current?.focus());
  };

  // Menores de idade (20261105a): sem carta. Aprovar um menor abre a
  // declaracao (MenorAprovacaoDialog); a lista vem do servidor, que sabe a
  // idade no primeiro dia do projeto e acha o acompanhante pelo nome.
  const [menores, setMenores] = useState({ itens: [], ctx: {} });
  const [menorEmAprovacao, setMenorEmAprovacao] = useState(null); // { id, modo }

  const carregarMenores = async () => {
    const r = await fetchMenoresDaAprovacao();
    if (!r.success) return null;
    setMenores({
      itens: r.itens,
      ctx: { quem: r.quem, edicao: r.edicao, eventoInicio: r.eventoInicio, eventoFim: r.eventoFim },
    });
    return r.itens;
  };

  const { porId: menorPorId, acompanhanteDe } = useMemo(() => indexarMenores(menores.itens), [menores.itens]);

  useEffect(() => {
    carregarInscricoes();

    // So com a aba visivel (25/10/2026).
    const intervalId = setInterval(() => {
      if (!document.hidden) carregarInscricoes(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // Estado da carga da lista (09/11/2026). Antes, enquanto carregava ou
  // quando a busca falhava, a tela mostrava "0 pendentes" -- igual a uma
  // igreja sem ninguem inscrito. Agora: primeira carga mostra "Carregando",
  // falha mostra um aviso fixo com "Tentar de novo", e uma lista ja carregada
  // NUNCA e zerada por uma atualizacao que deu errado.
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erroCarga, setErroCarga] = useState(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  // Atualizacao automatica (30 s) e o botao podem se cruzar: so vale a
  // resposta da chamada mais recente.
  const cargaAtualRef = useRef(0);

  const carregarInscricoes = async (showLoading = true) => {
    const minhaCarga = ++cargaAtualRef.current;
    if (showLoading) setLoading(true);
    setAtualizando(true);
    // A lista dos menores (etiquetas e declaracao) vem a parte: a lista das
    // inscricoes nao espera por ela.
    carregarMenores().catch(() => {});
    try {
      // Esta tela é só para inscrições de equipante: acampante já nasce com
      // status 'aprovado' (não passa por aprovação manual) e vai direto pra
      // tabela geral em Gerenciar Inscrições.
      const { data, error } = await fetchEquipantesRaw();

      if (error) throw error;

      let mappedEquipantes = (data || []).map(e => ({
        ...e,
        tipo: 'equipante',
        telefone: e.whatsapp,
        pastor: e.pastor_nome,
        areaTrabalho: e.area_trabalho_opcao1,
        motivacao: `Área desejada: ${e.area_trabalho_opcao1}`,
        experienciaAnterior: e.ja_trabalhou_equipe ? `Já trabalhou em: ${e.edicao_trabalhou || 'N/A'}` : 'Primeira vez na equipe'
      }));

      // Parceiro (igreja logada) só vê as inscrições de equipante que
      // marcaram a própria igreja no campo "Igreja que frequenta". O código
      // de login da igreja (igrejaUser.codigo, ex: "01") é o mesmo número
      // que prefixa cada nome em IGREJAS_PARCEIRAS (ex: "01 - A CASA DO
      // MESTRE"), então a correspondência é por prefixo exato "<codigo> - ".
      // Inscrições sem igreja informada (campo vazio — pergunta "Congrega em
      // alguma igreja?" respondida NÃO) nunca batem com nenhum código e por
      // isso nunca aparecem pra nenhum parceiro; só os organizadores (sem
      // esse filtro) continuam vendo essas.
      // Parceiro sem codigo de igreja nao ve nada (nunca "tudo"): quem ve
      // todas as igrejas e so o organizador. O banco ja barra por RLS
      // (policy "parceiro ve so a propria igreja"); isto e a segunda trava.
      // Pastor de mais de uma igreja (19/10/2026): a conta pode responder
      // tambem por igrejas vinculadas -- a lista vem do servidor; sem ela,
      // so a da propria conta.
      if (isParceiro) {
        let codigos = igrejaUser?.codigo ? [String(igrejaUser.codigo)] : [];
        try {
          const minhas = await minhasIgrejasParceiro();
          if (Array.isArray(minhas) && minhas.length) codigos = minhas.map((i) => String(i.codigo));
        } catch { /* fica so a propria igreja */ }
        mappedEquipantes = mappedEquipantes.filter(e => e.igreja && codigos.some((c) => e.igreja.startsWith(`${c} - `)));
        // Areas pedidas e pagamento nao chegam as telas do parceiro (ele ainda
        // nao conhece o projeto; isso e decisao da organizacao).
        mappedEquipantes = mappedEquipantes.map(e => ({
          ...e,
          area_trabalho_opcao1: null, area_trabalho_opcao2: null, area_trabalho_opcao3: null,
          area_trabalho_extra: null, areaTrabalho: null, motivacao: null,
          forma_pagamento: null, status_pagamento: null, data_pagamento: null,
          metodo_pagamento: null, id_transacao_sicoob: null, txid_pix: null
        }));
      }

      if (minhaCarga !== cargaAtualRef.current) return;
      setInscricoes(mappedEquipantes);
      setCarregouUmaVez(true);
      setErroCarga(null);
      setUltimaAtualizacao(new Date());
    } catch (error) {
      console.error("Erro ao carregar inscrições:", error);
      if (minhaCarga !== cargaAtualRef.current) return;
      // A lista que ja estava na tela fica como esta; o aviso fixo diz que
      // ela pode estar desatualizada.
      setErroCarga(String(error?.message || error?.details || error || 'erro desconhecido'));
    } finally {
      if (minhaCarga === cargaAtualRef.current) {
        if (showLoading) setLoading(false);
        setAtualizando(false);
      }
    }
  };

  const horaCurta = (d) => (d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

  // Devolve a DECISAO (quem assinou, quando) em vez de um true/false, para
  // quem chamou poder dizer na hora "Aprovado por Fulano". Devolve null se
  // deu errado.
  const updateInscricaoStatus = async (id, tipo, newStatus, declaracaoMenor = false) => {
    try {
      const { data, error } = await updateEquipanteStatus(id, newStatus, declaracaoMenor);

      if (error) throw error;

      // O servidor devolve quem assinou a decisao. Guardamos junto para a
      // linha ja aparecer com o autor, sem esperar o recarregamento.
      const novasInscricoes = inscricoes.map(inscricao =>
        inscricao.id === id
          ? {
              ...inscricao,
              status: newStatus,
              decidido_por: data?.decidido_por ?? null,
              decidido_por_tipo: data?.decidido_por_tipo ?? null,
              decidido_por_igreja: data?.decidido_por_igreja ?? null,
              decidido_em: data?.decidido_em ?? null
            }
          : inscricao
      );
      setInscricoes(novasInscricoes);

      // Trigger background refresh to ensure sync
      carregarInscricoes(false);

      return data || {};
    } catch (error) {
      // A lista dos menores nao tinha carregado: o servidor pediu a
      // declaracao. Recarrega e abre a janela do menor em vez do erro.
      if (error?.precisaDeclaracaoMenor) {
        const itens = await carregarMenores();
        if (itens?.some((m) => m.id === id)) {
          setMenorEmAprovacao({ id, modo: 'aprovar' });
          return null;
        }
      }
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro na atualização",
        description: error?.message || "Não foi possível atualizar o status da inscrição.",
        variant: "destructive"
      });
      return null;
    }
  };

  const aprovarInscricao = async (id, declaracaoMenor = false) => {
    // Find the inscription to get its type and CPF
    const inscricao = inscricoes.find(i => i.id === id);

    if (!inscricao) {
      toast({
        title: "Erro",
        description: "Inscrição não encontrada.",
        variant: "destructive"
      });
      return;
    }

    // Menor sem liberacao: primeiro a declaracao (20261105a).
    const menor = menorPorId.get(id);
    if (menor && !menor.menor_liberado_em && !declaracaoMenor) {
      setMenorEmAprovacao({ id, modo: 'aprovar' });
      return false;
    }

    const decisao = await updateInscricaoStatus(id, inscricao.tipo, 'aprovado', declaracaoMenor);

    if (!decisao) return false;
    if (menor) carregarMenores();

    voltarParaBuscaPendentes(inscricao);

    // A aprovacao NAO escala mais ninguem automaticamente (decidido com o
    // Patrick em 12/09/2026). Antes, aprovar ja jogava a pessoa na primeira
    // das 3 preferencias que tivesse vaga; agora ela entra na fila "A
    // escalar" da tela de Geracao de Escalas e o organizador coloca uma a
    // uma na area, olhando o conjunto. As preferencias continuam gravadas e
    // aparecem ali do lado, como sugestao -- so nao decidem sozinhas.
    toast({
      title: decisao.decidido_por
        ? `Aprovado por ${decisao.decidido_por}`
        : "Equipante aprovado!",
      description: `${inscricao.nome} entrou na fila para ser escalado em Geração de Escalas.`,
      className: "bg-green-600 text-white"
    });
    return true;
  };

  // Menor ja aprovado (ou Só Domingo pendente) sem a liberacao.
  const solicitarLiberacaoMenor = (id) => setMenorEmAprovacao({ id, modo: 'liberar' });

  const confirmarMenor = async () => {
    if (!menorEmAprovacao) return false;
    const { id, modo } = menorEmAprovacao;
    if (modo === 'aprovar') return aprovarInscricao(id, true);
    const r = await liberarMenor(id, true);
    if (!r.success) {
      toast({ title: 'Não deu para liberar', description: r.error, variant: 'destructive' });
      return false;
    }
    toast({
      title: 'Menor liberado',
      description: `A autorização ficou registrada${r.por ? ` por ${r.por}` : ''}. O pagamento já pode abrir para ${menorPorId.get(id)?.nome || 'o menor'}.`,
      className: 'bg-green-600 text-white'
    });
    carregarMenores();
    carregarInscricoes(false);
    return true;
  };

  const rejeitarInscricao = async (id) => {
    const inscricao = inscricoes.find(i => i.id === id);

    if (!inscricao) {
      toast({
        title: "Erro",
        description: "Inscrição não encontrada.",
        variant: "destructive"
      });
      return;
    }

    const decisao = await updateInscricaoStatus(id, inscricao.tipo, 'rejeitado');

    if (decisao) {
      voltarParaBuscaPendentes(inscricao);
      toast({
        title: decisao.decidido_por
          ? `Rejeitada por ${decisao.decidido_por}`
          : "Inscrição rejeitada",
        variant: "destructive"
      });
    }
  };

  // Cancelamento de quem ja esta aprovado (aba "Aprovadas"). Diferente de
  // rejeitarInscricao (que so age sobre pendentes, sem confirmacao), esta
  // acao pode desalocar alguem que ja esta escalado numa area de trabalho —
  // por isso passa por uma confirmacao explicita antes de executar
  // (solicitarCancelamento abre o dialogo; confirmarCancelamento e quem
  // efetivamente muda o status e libera a vaga).
  const solicitarCancelamento = (id) => {
    const inscricao = inscricoes.find(i => i.id === id);

    if (!inscricao) {
      toast({
        title: "Erro",
        description: "Inscrição não encontrada.",
        variant: "destructive"
      });
      return;
    }

    setInscricaoParaCancelar(inscricao);
  };

  const confirmarCancelamento = async () => {
    if (!inscricaoParaCancelar) return;

    const inscricao = inscricaoParaCancelar;
    setInscricaoParaCancelar(null);

    const decisao = await updateInscricaoStatus(inscricao.id, inscricao.tipo, 'rejeitado');

    if (!decisao) return;

    toast({
      title: "Aprovação cancelada",
      description: `A inscrição de ${inscricao.nome} foi cancelada.`,
      variant: "destructive"
    });

    // Libera a vaga em escalas, se a pessoa tinha uma. NAO puxa mais
    // ninguem da fila para o lugar dela: com a escala sendo montada a mao,
    // quem entra na vaga e escolha do organizador, na tela de Geracao de
    // Escalas. Nao bloqueia o cancelamento se falhar por qualquer motivo de
    // infra — o cancelamento em si ja aconteceu (mesmo espirito do resto
    // desta tela).
    const liberacao = await liberarVagaERealocar(inscricao.id);

    if (liberacao.success && liberacao.vagaLiberada) {
      toast({
        title: "Vaga liberada",
        description: `A vaga de ${inscricao.nome} em ${liberacao.areaLiberada} está livre. Escolha quem entra no lugar em Geração de Escalas.`
      });
    } else if (!liberacao.success) {
      console.error('Falha ao tentar liberar vaga / realocar após cancelamento:', liberacao.error);
    }
  };

  // Quem se inscreveu para todos os dias e avisou que so vai no domingo
  // (29/10/2026). So organizador, so pendente; o servidor confere tudo de novo
  // (20261029d). Mudar apaga as areas escolhidas; voltar nao as devolve.
  const solicitarMudancaDomingo = (id) => {
    const inscricao = inscricoes.find(i => i.id === id);
    if (inscricao) setInscricaoParaDomingo(inscricao);
  };

  const confirmarMudancaDomingo = async () => {
    if (!inscricaoParaDomingo) return;
    const inscricao = inscricaoParaDomingo;
    const paraDomingo = !inscricao.so_domingo;
    setInscricaoParaDomingo(null);

    const { error } = await definirSoDomingoPendente(inscricao.id, paraDomingo);
    if (error) {
      toast({ title: 'Não foi possível mudar', description: error.message, variant: 'destructive' });
      return;
    }

    setInscricoes(lista => lista.map(i => (i.id === inscricao.id
      ? {
          ...i,
          so_domingo: paraDomingo,
          ...(paraDomingo
            ? { area_trabalho_opcao1: null, area_trabalho_opcao2: null, area_trabalho_opcao3: null, area_trabalho_extra: null, areaTrabalho: null }
            : {})
        }
      : i)));
    carregarInscricoes(false);

    toast({
      title: paraDomingo ? 'Movido para Só Domingo' : 'Voltou para todos os dias',
      description: paraDomingo
        ? `${inscricao.nome} segue pendente. Aprovada, vai para "Vão somente no domingo" e paga 50%.`
        : `${inscricao.nome} precisa escolher as 3 áreas de novo no acompanhamento da inscrição.`,
      className: 'bg-green-600 text-white'
    });
  };

  // A busca em si fica na tabela (AprovacoesTable, utils/busca.js): filtrar
  // aqui e de novo la, com campos diferentes, fazia sumir quem casava pela
  // igreja (04/10/2026). A lista vai inteira.
  const filterInscricoes = (inscricoes) => inscricoes;

  // Etiquetas do menor e do acompanhante (20261105a).
  const linhas = useMemo(() => inscricoes.map((i) => {
    const m = menorPorId.get(i.id);
    const de = acompanhanteDe.get(i.id);
    if (!m && !de) return i;
    return {
      ...i,
      menor: !!m,
      menorLiberado: !!m?.menor_liberado_em,
      menorInfo: m || null,
      acompanhanteDe: de || null,
    };
  }), [inscricoes, menorPorId, acompanhanteDe]);

  const menoresSemLiberacao = useMemo(
    () => menores.itens.filter((m) => !m.menor_liberado_em && m.status !== 'rejeitado').length,
    [menores.itens]
  );

  const {
    pendentes, aprovadas, rejeitadas,
    pendentesFiltered, aprovadasFiltered, rejeitadasFiltered
  } = useMemo(() => {
    // Categorize by Status
    const pendentes = linhas.filter(i => i.status === 'pendente');
    const aprovadas = linhas.filter(i => i.status === 'aprovado');
    const rejeitadas = linhas.filter(i => i.status === 'rejeitado');

    // Apply Global Search Logic
    return {
      pendentes, aprovadas, rejeitadas,
      pendentesFiltered: filterInscricoes(pendentes, searchTermPendentes),
      aprovadasFiltered: filterInscricoes(aprovadas, searchTermAprovadas),
      rejeitadasFiltered: filterInscricoes(rejeitadas, searchTermRejeitadas),
    };
  }, [linhas, searchTermPendentes, searchTermAprovadas, searchTermRejeitadas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-white mb-2">{pageTitle}</h1>
          <p className="text-blue-200">{pageDescription}</p>
        </div>

        {/* Atualiza so a lista, sem recarregar a pagina (09/11/2026). */}
        <div className="flex flex-col items-center md:items-end gap-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => carregarInscricoes(false)}
            disabled={atualizando}
            className="border-white/20 bg-white/5 text-white hover:bg-white/15"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />
            {atualizando ? 'Atualizando...' : 'Atualizar'}
          </Button>
          {ultimaAtualizacao && (
            <span className="text-xs text-gray-400">Atualizado às {horaCurta(ultimaAtualizacao)}</span>
          )}
        </div>
      </div>

      {erroCarga && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" />
          <div className="flex-1">
            <p className="font-semibold">Não foi possível carregar as inscrições.</p>
            <p className="text-red-200/90">
              {carregouUmaVez
                ? `A lista abaixo é a da última atualização que deu certo (${horaCurta(ultimaAtualizacao)}) e pode estar desatualizada.`
                : 'Verifique a internet e tente de novo.'}
            </p>
            <p className="mt-1 text-xs text-red-300/70 break-words">Detalhe: {erroCarga}</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => carregarInscricoes(false)}
            disabled={atualizando}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${atualizando ? 'animate-spin' : ''}`} />
            Tentar de novo
          </Button>
        </div>
      )}

      {!carregouUmaVez ? (
        !erroCarga && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-white">
            <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
            <p>Carregando inscrições...</p>
          </div>
        )
      ) : (
      <>

      {menoresSemLiberacao > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-pink-500/30 bg-pink-500/10 p-3 text-sm text-pink-100">
          <Baby className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
          <span>
            {menoresSemLiberacao === 1 ? '1 menor de idade espera' : `${menoresSemLiberacao} menores de idade esperam`} a confirmação da
            autorização do responsável. Procure a etiqueta <strong>Menor de idade</strong>: ao aprovar, aparece a mensagem
            pronta para mandar ao responsável pelo WhatsApp.
          </span>
        </p>
      )}

      {showStatistics && (
        <AprovacoesStatsCards
          pendentes={pendentes.length}
          aprovadas={aprovadas.length}
          rejeitadas={rejeitadas.length}
          abaAtiva={aba}
          onSelecionar={setAba}
        />
      )}

      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-white/10">
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-yellow-600">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="aprovadas" className="data-[state=active]:bg-green-600">Aprovadas ({aprovadas.length})</TabsTrigger>
          <TabsTrigger value="rejeitadas" className="data-[state=active]:bg-red-600">Rejeitadas ({rejeitadas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <AprovacoesTable
            dados={pendentesFiltered}
            titulo="Inscrições Pendentes"
            onSelect={setSelectedInscricao}
            onAprovar={aprovarInscricao}
            onRejeitar={rejeitarInscricao}
            showActions={true}
            situacao="pendente"
            podeAprovarEmLote={isOrganizador && !isParceiro}
            onLoteConcluido={() => carregarInscricoes(false)}
            contextoMenores={menores.ctx}
            onMudarDomingo={isOrganizador && !isParceiro ? solicitarMudancaDomingo : undefined}
            searchTerm={searchTermPendentes}
            onSearchChange={setSearchTermPendentes}
            buscaRef={buscaPendentesRef}
          />
        </TabsContent>
        <TabsContent value="aprovadas">
           <AprovacoesTable
            dados={aprovadasFiltered}
            titulo="Inscrições Aprovadas"
            onSelect={setSelectedInscricao}
            onAprovar={aprovarInscricao}
            onRejeitar={rejeitarInscricao}
            showActions={false}
            showCancelAction={true}
            onCancelar={solicitarCancelamento}
            onLiberarMenor={solicitarLiberacaoMenor}
            situacao="aprovado"
            searchTerm={searchTermAprovadas}
            onSearchChange={setSearchTermAprovadas}
          />
        </TabsContent>
        <TabsContent value="rejeitadas">
          <AprovacoesTable
            dados={rejeitadasFiltered}
            titulo="Inscrições Negadas"
            onSelect={setSelectedInscricao}
            onAprovar={aprovarInscricao}
            onRejeitar={rejeitarInscricao}
            showActions={false}
            showApproveOnly={true}
            situacao="rejeitado"
            searchTerm={searchTermRejeitadas}
            onSearchChange={setSearchTermRejeitadas}
          />
        </TabsContent>
      </Tabs>
      </>
      )}

      <MenorAprovacaoDialog
        aberto={!!menorEmAprovacao}
        menor={menorEmAprovacao ? menorPorId.get(menorEmAprovacao.id) : null}
        ctx={menores.ctx}
        modo={menorEmAprovacao?.modo}
        onConfirmar={confirmarMenor}
        onFechar={() => setMenorEmAprovacao(null)}
        onAcompanhanteMudou={carregarMenores}
      />

      {selectedInscricao && (
        <InscricaoDetalhesModal
          inscricao={linhas.find((l) => l.id === selectedInscricao.id) || selectedInscricao}
          onClose={() => setSelectedInscricao(null)}
          onAprovar={aprovarInscricao}
          onRejeitar={rejeitarInscricao}
        />
      )}

      <AlertDialog
        open={!!inscricaoParaCancelar}
        onOpenChange={(open) => {
          if (!open) setInscricaoParaCancelar(null);
        }}
      >
        <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancelar aprovação
            </AlertDialogTitle>

            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja cancelar a aprovação
              {inscricaoParaCancelar?.nome && (
                <>
                  {' de '}
                  <strong className="text-white">
                    {inscricaoParaCancelar.nome}
                  </strong>
                </>
              )}
              ? Se já estiver alocado em alguma área de trabalho, a vaga será liberada e o primeiro compatível da lista de espera poderá ser alocado automaticamente nela.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Voltar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmarCancelamento}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!inscricaoParaDomingo}
        onOpenChange={(open) => {
          if (!open) setInscricaoParaDomingo(null);
        }}
      >
        <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {inscricaoParaDomingo?.so_domingo ? 'Voltar para todos os dias' : 'Mover para Só Domingo'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {inscricaoParaDomingo?.so_domingo ? (
                <>
                  <strong className="text-white">{inscricaoParaDomingo?.nome}</strong> volta a ir todos os dias.
                  As áreas de trabalho não voltam: a pessoa precisa escolher as 3 áreas de novo no acompanhamento da inscrição.
                </>
              ) : (
                <>
                  <strong className="text-white">{inscricaoParaDomingo?.nome}</strong> passa a ir somente no domingo.
                  As áreas de trabalho escolhidas são apagadas e a pessoa nunca entra na escala.
                  A inscrição continua pendente; depois de aprovada, vai para "Vão somente no domingo" e paga 50% do lote.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarMudancaDomingo}
              className="bg-amber-600 hover:bg-amber-700 text-white border-none"
            >
              {inscricaoParaDomingo?.so_domingo ? 'Sim, todos os dias' : 'Sim, só domingo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApprovalsView;