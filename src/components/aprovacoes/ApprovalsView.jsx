import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AprovacoesStatsCards from '@/components/aprovacoes/AprovacoesStatsCards';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import AprovacoesTable from '@/components/aprovacoes/AprovacoesTable';
import { fetchEquipantesRaw, updateEquipanteStatus } from '@/services/equipantesService';

const ApprovalsView = ({ 
  pageTitle = "Aprovações de Equipantes", 
  pageDescription = "Aprove ou rejeite as inscrições de equipantes",
  showStatistics = true 
}) => {
  const { toast } = useToast();
  const [inscricoes, setInscricoes] = useState([]);
  const [selectedInscricao, setSelectedInscricao] = useState(null);
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

      const mappedEquipantes = (data || []).map(e => ({
        ...e,
        tipo: 'equipante',
        telefone: e.whatsapp,
        pastor: e.pastor_nome,
        areaTrabalho: e.area_trabalho_opcao1,
        motivacao: `Área desejada: ${e.area_trabalho_opcao1}`,
        experienciaAnterior: e.ja_trabalhou_equipe ? `Já trabalhou em: ${e.edicao_trabalhou || 'N/A'}` : 'Primeira vez na equipe'
      }));

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
    </div>
  );
};

export default ApprovalsView;