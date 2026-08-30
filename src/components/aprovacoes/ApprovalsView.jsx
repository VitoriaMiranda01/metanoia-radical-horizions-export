import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AprovacoesStatsCards from '@/components/aprovacoes/AprovacoesStatsCards';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import AprovacoesTable from '@/components/aprovacoes/AprovacoesTable';
import { fetchEquipantesRaw, updateEquipanteStatus } from '@/services/equipantesService';
import { fetchAcampantesRaw, updateAcampanteStatus } from '@/services/acampantesService';

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
      // Fetch both equipantes and acampantes directly without relying on email parameters
      const [equipantesResult, acampantesResult] = await Promise.all([
        fetchEquipantesRaw(),
        fetchAcampantesRaw(),
      ]);

      if (equipantesResult.error) throw equipantesResult.error;
      if (acampantesResult.error) throw acampantesResult.error;

      // Map Equipantes to unified structure
      const mappedEquipantes = (equipantesResult.data || []).map(e => ({
        ...e,
        tipo: 'equipante',
        telefone: e.whatsapp,
        pastor: e.pastor_nome,
        areaTrabalho: e.area_trabalho_opcao1,
        motivacao: `Área desejada: ${e.area_trabalho_opcao1}`,
        experienciaAnterior: e.ja_trabalhou_equipe ? `Já trabalhou em: ${e.edicao_trabalhou || 'N/A'}` : 'Primeira vez na equipe'
      }));

      // Map Acampantes to unified structure
      const mappedAcampantes = (acampantesResult.data || []).map(a => ({
        ...a,
        tipo: 'acampante',
        nome: a.nome_completo || a.nome || a.full_name,
        telefone: a.telefone || a.whatsapp,
        pastor: a.pastor_nome || a.pastor,
        motivacao: a.conhecido_no_projeto ? `Conheceu através de: ${a.nome_familiar_conhecido || 'N/A'}` : 'Primeira experiência',
        experienciaAnterior: a.problemas_saude ? 'Possui condições médicas informadas' : 'Sem restrições informadas'
      }));

      // Combine both arrays
      const todasInscricoes = [...mappedEquipantes, ...mappedAcampantes];

      setInscricoes(todasInscricoes);
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
      const { error } = tipo === 'equipante'
        ? await updateEquipanteStatus(id, newStatus)
        : await updateAcampanteStatus(id, newStatus);

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

    try {
      // Aprovação da inscrição do equipante É a autorização pastoral — não há
      // mais um campo/ação separados para isso.
      if (inscricao.tipo === 'equipante') {
        toast({ 
          title: "Equipante aprovado!", 
          description: "A inscrição foi aprovada com sucesso.", 
          className: "bg-green-600 text-white" 
        });
      } 
      // Acampantes não passam por vínculo com equipante: uma pessoa nunca se
      // inscreve como acampante e equipante ao mesmo tempo, então não existe
      // "equipante vinculado por CPF" a atualizar aqui.
      else if (inscricao.tipo === 'acampante') {
        toast({ 
          title: "Acampante aprovado!", 
          description: "A inscrição foi aprovada com sucesso.", 
          className: "bg-green-600 text-white" 
        });
      }
    } catch (err) {
      console.error('Error in approval process:', err);
      toast({ 
        title: "Aviso", 
        description: "Inscrição aprovada, mas houve um erro no processamento adicional.", 
        variant: "destructive" 
      });
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