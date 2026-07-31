import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Layout from '@/components/Layout';
import Statistics from '@/components/gerenciar/Statistics';
import InscricaoDetalhesModal from '@/components/gerenciar/InscricaoDetalhesModal';
import InscricoesTable from '@/components/gerenciar/InscricoesTable';
import AcampantesTable from '@/components/gerenciar/AcampantesTable';
import GruposTrailhaCards from '@/components/gerenciar/GruposTrailhaCards';
import GruposTrailhaModal from '@/components/gerenciar/GruposTrailhaModal';
import AcampantesStatsCards from '@/components/gerenciar/AcampantesStatsCards';
import AcampantesDetailModal from '@/components/gerenciar/AcampantesDetailModal';
import { supabase } from '@/lib/supabase';
import { deleteAcampante, getAcampantes } from '@/lib/acampanteHelpers';
import { useEdition } from '@/contexts/EditionContext';
import { allocateAcampantesToGroups } from '@/lib/gruposTrailhaHelpers';

const GerenciarInscricoes = () => {
  const { toast } = useToast();
  const { selectedEdition } = useEdition();
  
  // State for LocalStorage data (Legacy/Equipantes not yet fully migrated in this view)
  const [inscricoes, setInscricoes] = useState([]);
  
  // State for Supabase Acampantes
  const [acampantesList, setAcampantesList] = useState([]);
  const [loadingAcampantes, setLoadingAcampantes] = useState(false);
  const [errorAcampantes, setErrorAcampantes] = useState(null);
  
  const [selectedInscricao, setSelectedInscricao] = useState(null);
  const [searchTermEquipantes, setSearchTermEquipantes] = useState('');
  
  // State for Groups Modal
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  
  // State for Acampantes Stats Modal
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsModalTitle, setStatsModalTitle] = useState('');
  const [statsModalData, setStatsModalData] = useState([]);
  
  // Force refresh trigger for reports
  const [refreshReports, setRefreshReports] = useState(0);

  useEffect(() => {
    carregarInscricoesLegacy();
  }, [selectedEdition]); // Also re-filter legacy on edition change if applicable

  useEffect(() => {
    fetchAcampantesSupabase();
  }, [selectedEdition]);

  const carregarInscricoesLegacy = () => {
    // Carrega equipantes do localStorage para manter compatibilidade
    // Depending on schema, we might filter these locally by edition if they had one
    const inscricoesStorage = JSON.parse(localStorage.getItem('metanoia_inscricoes') || '[]');
    setInscricoes(inscricoesStorage);
  };

  const fetchAcampantesSupabase = async () => {
    if (!selectedEdition) return;
    
    setLoadingAcampantes(true);
    setErrorAcampantes(null);
    try {
      const data = await getAcampantes(null, selectedEdition);
      setAcampantesList(data || []);
      setRefreshReports(prev => prev + 1); // Trigger report refresh when data changes
    } catch (error) {
      console.error("Erro ao buscar acampantes:", error);
      setErrorAcampantes("Falha ao carregar lista de acampantes. Verifique sua conexão.");
      toast({ 
        title: "Erro de Conexão", 
        description: "Não foi possível carregar os dados do servidor.",
        variant: "destructive"
      });
    } finally {
      setLoadingAcampantes(false);
    }
  };

  // Legacy delete for equipantes (localStorage)
  const excluirInscricaoLegacy = (id) => {
    if (!window.confirm("Tem certeza que deseja excluir?")) return;
    const novasInscricoes = inscricoes.filter(i => i.id !== id);
    localStorage.setItem('metanoia_inscricoes', JSON.stringify(novasInscricoes));
    setInscricoes(novasInscricoes);
    toast({ title: "Inscrição excluída", description: "A inscrição foi removida com sucesso." });
  };

  // Supabase delete for acampantes
  const handleDeleteAcampante = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este acampante?")) return;
    
    setLoadingAcampantes(true);
    try {
      const result = await deleteAcampante(id); // Using helper which uses Supabase
      if (result.success) {
        toast({ title: "Sucesso", description: "Acampante removido." });
        fetchAcampantesSupabase();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast({ 
        title: "Erro", 
        description: err.message || "Falha ao remover acampante.", 
        variant: "destructive" 
      });
      setLoadingAcampantes(false);
    }
  };

  const exportarDados = (tipo) => {
    const dadosParaExportar = tipo === 'equipantes' ? equipantes : acampantesList;
    
    if (dadosParaExportar.length === 0) {
      toast({ title: "Nenhum dado", description: `Não há ${tipo} para exportar.`, variant: "destructive" });
      return;
    }
    
    // Header setup based on type
    let headers = [];
    let rows = [];

    if (tipo === 'equipantes') {
      headers = ['Nome', 'Email', 'Telefone', 'Idade', 'Cidade', 'Estado', 'Igreja', 'Pastor', 'Status', 'Data Inscrição'];
      rows = dadosParaExportar.map(i => [
        i.nome, i.email, i.telefone, i.idade, i.cidade, i.estado, i.igreja, i.pastor, i.status, new Date(i.dataInscricao).toLocaleString('pt-BR')
      ]);
    } else {
      // This is now handled by the specific button inside AcampantesTable, but kept for fallback or legacy tab
      headers = ['Nome', 'CPF', 'Email', 'WhatsApp', 'Idade', 'Cidade', 'Estado', 'Igreja', 'Status', 'Data Inscrição'];
      rows = dadosParaExportar.map(i => [
        i.nome, i.cpf, i.email, i.whatsapp, i.idade, i.cidade, i.estado, i.igreja, i.status, new Date(i.created_at).toLocaleString('pt-BR')
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tipo}_metanoia_radical_edicao_${selectedEdition}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Dados exportados", description: `Lista de ${tipo} exportada com sucesso!` });
  };
  
  const filterInscricoes = (list, searchTerm) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(item => 
      (item.nome && item.nome.toLowerCase().includes(term)) ||
      (item.email && item.email.toLowerCase().includes(term)) ||
      (item.telefone && item.telefone.toLowerCase().includes(term))
    );
  };

  const { equipantes, filteredEquipantes } = useMemo(() => {
    // Filter legacy localstorage items for equipantes only
    // Assuming legacy items might not have strong edition filtering, but we apply what we can
    const equipantes = inscricoes.filter(i => i.tipo === 'equipante' && (!selectedEdition || parseInt(i.numero_edicao, 10) === selectedEdition || !i.numero_edicao));
    return {
      equipantes,
      filteredEquipantes: filterInscricoes(equipantes, searchTermEquipantes),
    };
  }, [inscricoes, searchTermEquipantes, selectedEdition]);

  // Calculate allocated groups
  const allocatedGroups = useMemo(() => {
    return allocateAcampantesToGroups(acampantesList);
  }, [acampantesList]);

  // Transform Acampante DB data to fit Modal structure if needed
  const handleViewDetails = (acampante) => {
    // Adapter to make DB data compatible with existing Modal expectation
    const adapted = {
      ...acampante,
      telefone: acampante.whatsapp,
      dataInscricao: acampante.created_at,
      contatoEmergencia: acampante.contato_emergencia_nome,
      telefoneEmergencia: acampante.contato_emergencia_telefone,
      experienciaAnterior: acampante.experiencia_anterior, // may be null
      motivacao: acampante.motivacao, // may be null
      condicoesMedicas: acampante.condicoes_medicas,
      restricoesAlimentares: acampante.restricoes_alimentares
    };
    setSelectedInscricao(adapted);
  };

  const handleGroupClick = (groupName, data) => {
    setSelectedGroup({ name: groupName, data });
    setIsGroupModalOpen(true);
  };

  const handleStatsCardClick = (title, data) => {
    setStatsModalTitle(title);
    setStatsModalData(data);
    setIsStatsModalOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Inscrições - Metanoia Radical</title>
        <meta name="description" content="Gerencie todas as inscrições do projeto Metanoia Radical" />
      </Helmet>

      <Layout>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Gerenciar Inscrições</h1>
            <p className="text-blue-200">
              {selectedEdition ? `Visualizando dados da Edição ${selectedEdition}` : 'Carregando edições...'}
            </p>
          </div>
          
          {/* General Stats - Kept for top-level overview */}
          <Statistics 
            equipantes={equipantes.length} 
            acampantes={acampantesList.length} 
            total={equipantes.length + acampantesList.length} 
          />

          <Tabs defaultValue="acampantes" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-white/10">
              <TabsTrigger value="acampantes" className="data-[state=active]:bg-green-600">
                Acampantes ({acampantesList.length})
              </TabsTrigger>
              <TabsTrigger value="equipantes" className="data-[state=active]:bg-red-600">
                Equipantes ({equipantes.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="acampantes">
              {errorAcampantes ? (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar dados</h3>
                  <p className="text-gray-300 mb-4">{errorAcampantes}</p>
                  <Button onClick={fetchAcampantesSupabase} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              ) : (
                <>
                  {/* Detailed Statistics Section for Acampantes */}
                  <div className="mb-8">
                    <AcampantesStatsCards 
                      acampantes={acampantesList}
                      loading={loadingAcampantes}
                      onCardClick={handleStatsCardClick}
                    />
                  </div>

                  {/* Grupos de Trilha Section */}
                  <div className="mb-8">
                    <GruposTrailhaCards 
                      groupsData={allocatedGroups} 
                      onGroupClick={handleGroupClick} 
                    />
                  </div>

                  <AcampantesTable 
                    data={acampantesList}
                    loading={loadingAcampantes}
                    onViewDetails={handleViewDetails}
                    onDelete={handleDeleteAcampante}
                    onRefresh={fetchAcampantesSupabase}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="equipantes">
              <InscricoesTable 
                dados={filteredEquipantes} 
                tipo="equipantes" 
                onSelect={setSelectedInscricao} 
                onExcluir={excluirInscricaoLegacy} 
                onExportar={exportarDados}
                searchTerm={searchTermEquipantes}
                onSearchChange={setSearchTermEquipantes}
              />
            </TabsContent>
          </Tabs>

          {/* Modals */}
          {selectedInscricao && (
            <InscricaoDetalhesModal inscricao={selectedInscricao} onClose={() => setSelectedInscricao(null)} />
          )}

          {selectedGroup && (
            <GruposTrailhaModal 
              isOpen={isGroupModalOpen}
              onClose={() => setIsGroupModalOpen(false)}
              groupName={selectedGroup.name}
              groupData={selectedGroup.data}
            />
          )}

          <AcampantesDetailModal 
            isOpen={isStatsModalOpen}
            onClose={() => setIsStatsModalOpen(false)}
            title={statsModalTitle}
            acampantes={statsModalData}
          />

        </motion.div>
      </Layout>
    </>
  );
};

export default GerenciarInscricoes;