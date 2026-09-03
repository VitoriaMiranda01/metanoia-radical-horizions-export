import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AprovacoesStatsCards from '@/components/aprovacoes/AprovacoesStatsCards';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import AprovacoesTable from '@/components/aprovacoes/AprovacoesTable';
import { fetchEquipantesRaw, updateEquipanteStatus } from '@/services/equipantesService';
import { useAuth } from '@/contexts/AuthContext';
import { alocarEquipanteAutomaticamente, liberarVagaERealocar } from '@/services/equipanteAllocationService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const ApprovalsView = ({ 
  pageTitle = "Aprovações de Equipantes", 
  pageDescription = "Aprove ou rejeite as inscrições de equipantes",
  showStatistics = true 
}) => {
  const { toast } = useToast();
  const { isParceiro, igrejaUser } = useAuth();
  const [inscricoes, setInscricoes] = useState([]);
  const [selectedInscricao, setSelectedInscricao] = useState(null);
  const [inscricaoParaCancelar, setInscricaoParaCancelar] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Global Search states
  const [searchTermPendentes, setSearchTermPendentes] = useState('');
  const [searchTermAprovadas, setSearchTermAprovadas] = useState('');
  const [searchTermRejeitadas, setSearchTermRejeitadas] = useState('');

  useEffect(() => {
    carregarInscricoes();

    const intervalId = setInterval(() => {
      carregarInscricoes(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const carregarInscricoes = async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
      if (isParceiro && igrejaUser?.codigo) {
        const prefixoIgreja = `${igrejaUser.codigo} - `;
        mappedEquipantes = mappedEquipantes.filter(e => e.igreja && e.igreja.startsWith(prefixoIgreja));
      }

      setInscricoes(mappedEquipantes);
    } catch (error) {
      console.error("Erro ao carregar inscrições:", error);
      if (showLoading) {
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível buscar as inscrições do servidor.",
          variant: "destructive"
        });
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };
  
  const updateInscricaoStatus = async (id, tipo, newStatus) => {
    try {
      const { error } = await updateEquipanteStatus(id, newStatus);

      if (error) throw error;

      // Update local state to reflect change immediately
      const novasInscricoes = inscricoes.map(inscricao => 
        inscricao.id === id
          ? { ...inscricao, status: newStatus }
          : inscricao
      );
      setInscricoes(novasInscricoes);
      
      // Trigger background refresh to ensure sync
      carregarInscricoes(false);
      
      return true;
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({ 
        title: "Erro na atualização", 
        description: "Não foi possível atualizar o status da inscrição.", 
        variant: "destructive" 
      });
      return false;
    }
  };

  const aprovarInscricao = async (id) => {
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

    const success = await updateInscricaoStatus(id, inscricao.tipo, 'aprovado');
    
    if (!success) return;

    toast({ 
      title: "Equipante aprovado!", 
      description: "A inscrição foi aprovada com sucesso.", 
      className: "bg-green-600 text-white" 
    });

    // Alocacao automatica em area de trabalho, seguindo a ordem de
    // preferencia do equipante. Nao bloqueia a aprovacao se falhar (mesmo
    // espirito do sorteio de grupo de trilha do acampante) — so avisa o
    // organizador do resultado.
    const alocacao = await alocarEquipanteAutomaticamente(id);
    if (alocacao.success && alocacao.alocado) {
      toast({
        title: "Alocado automaticamente",
        description: `${inscricao.nome} foi alocado em: ${alocacao.area}`,
        className: "bg-blue-600 text-white"
      });
    } else if (alocacao.success && !alocacao.alocado) {
      toast({
        title: "Sem vaga nas 3 opções",
        description: `${inscricao.nome} ficou na lista de espera. Aloque manualmente em Geração de Escalas.`,
        variant: "destructive"
      });
    } else if (!alocacao.success) {
      console.error('Falha ao tentar alocar equipante automaticamente:', alocacao.error);
    }
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

    const success = await updateInscricaoStatus(id, inscricao.tipo, 'rejeitado');
    
    if (success) {
      toast({ 
        title: "Inscrição rejeitada", 
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

    const success = await updateInscricaoStatus(inscricao.id, inscricao.tipo, 'rejeitado');

    if (!success) return;

    toast({
      title: "Aprovação cancelada",
      description: `A inscrição de ${inscricao.nome} foi cancelada.`,
      variant: "destructive"
    });

    // Libera a vaga em escalas (se ela tinha uma) e tenta realocar o
    // primeiro compativel da lista de espera nela. Nao bloqueia o
    // cancelamento se falhar por qualquer motivo de infra — o cancelamento
    // em si ja aconteceu (mesmo espirito do resto desta tela).
    const liberacao = await liberarVagaERealocar(inscricao.id);

    if (liberacao.success && liberacao.vagaLiberada) {
      if (liberacao.novoAlocadoNome) {
        toast({
          title: "Vaga realocada",
          description: `A vaga em ${liberacao.areaLiberada} foi liberada e ${liberacao.novoAlocadoNome} foi alocado automaticamente.`,
          className: "bg-blue-600 text-white"
        });
      } else {
        toast({
          title: "Vaga liberada",
          description: `A vaga em ${liberacao.areaLiberada} foi liberada. Ninguém na lista de espera se encaixou nela por enquanto.`
        });
      }
    } else if (!liberacao.success) {
      console.error('Falha ao tentar liberar vaga / realocar após cancelamento:', liberacao.error);
    }
  };

  const filterInscricoes = (inscricoes, searchTerm) => {
    if (!searchTerm.trim()) return inscricoes;
    
    const term = searchTerm.toLowerCase();
    return inscricoes.filter(inscricao => 
      (inscricao.nome && inscricao.nome.toLowerCase().includes(term)) ||
      (inscricao.nome_completo && inscricao.nome_completo.toLowerCase().includes(term)) ||
      (inscricao.email && inscricao.email.toLowerCase().includes(term)) ||
      (inscricao.cidade && inscricao.cidade.toLowerCase().includes(term)) ||
      (inscricao.estado && inscricao.estado.toLowerCase().includes(term)) ||
      (inscricao.cpf && inscricao.cpf.includes(term)) ||
      (inscricao.tipo && inscricao.tipo.toLowerCase().includes(term))
    );
  };

  const { 
    pendentes, aprovadas, rejeitadas,
    pendentesFiltered, aprovadasFiltered, rejeitadasFiltered
  } = useMemo(() => {
    // Categorize by Status
    const pendentes = inscricoes.filter(i => i.status === 'pendente');
    const aprovadas = inscricoes.filter(i => i.status === 'aprovado'); 
    const rejeitadas = inscricoes.filter(i => i.status === 'rejeitado'); 

    // Apply Global Search Logic
    return { 
      pendentes, aprovadas, rejeitadas,
      pendentesFiltered: filterInscricoes(pendentes, searchTermPendentes),
      aprovadasFiltered: filterInscricoes(aprovadas, searchTermAprovadas),
      rejeitadasFiltered: filterInscricoes(rejeitadas, searchTermRejeitadas),
    };
  }, [inscricoes, searchTermPendentes, searchTermAprovadas, searchTermRejeitadas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-white mb-2">{pageTitle}</h1>
          <p className="text-blue-200">{pageDescription}</p>
        </div>
      </div>

      {showStatistics && (
        <AprovacoesStatsCards pendentes={pendentes.length} aprovadas={aprovadas.length} rejeitadas={rejeitadas.length} />
      )}

      <Tabs defaultValue="pendentes" className="space-y-6">
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
            searchTerm={searchTermPendentes}
            onSearchChange={setSearchTermPendentes}
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
            searchTerm={searchTermRejeitadas}
            onSearchChange={setSearchTermRejeitadas}
          />
        </TabsContent>
      </Tabs>

      {selectedInscricao && (
        <InscricaoDetalhesModal
          inscricao={selectedInscricao}
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
    </div>
  );
};

export default ApprovalsView;