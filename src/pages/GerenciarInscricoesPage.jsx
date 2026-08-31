import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Layout from '@/components/Layout';
import InscricoesStatsCards from '@/components/gerenciar/InscricoesStatsCards';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import InscricoesTable from '@/components/gerenciar/InscricoesTable';
import AcampantesTable from '@/components/gerenciar/AcampantesTable';
import GruposTrailhaCards from '@/components/gerenciar/GruposTrailhaCards';
import GruposTrailhaModal from '@/components/gerenciar/GruposTrailhaModal';
import AcampantesStatsCards from '@/components/gerenciar/AcampantesStatsCards';
import AcampantesDetailModal from '@/components/gerenciar/AcampantesDetailModal';
import { deleteAcampante, getAcampantes, countAcampantes } from '@/services/acampantesService';
import { fetchEquipantesInscritos, countEquipantesInscritos } from '@/services/equipantesService';
import { groupAcampantesByTrilha } from '@/utils/gruposTrailha';

const GerenciarInscricoesPage = () => {
  const { toast } = useToast();
  
  const [inscricoes, setInscricoes] = useState([]);
  const [acampantesList, setAcampantesList] = useState([]);
  
  const [totalEquipantes, setTotalEquipantes] = useState(0);
  const [totalAcampantes, setTotalAcampantes] = useState(0);

  const [loadingAcampantes, setLoadingAcampantes] = useState(false);
  const [errorAcampantes, setErrorAcampantes] = useState(null);
  
  const [selectedInscricao, setSelectedInscricao] = useState(null);
  const [searchTermEquipantes, setSearchTermEquipantes] = useState('');

  const [acampanteToDeactivate, setAcampanteToDeactivate] = useState(null);
  
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsModalTitle, setStatsModalTitle] = useState('');
  const [statsModalData, setStatsModalData] = useState([]);
  
  const [refreshReports, setRefreshReports] = useState(0);

  useEffect(() => {
    carregarEquipantes();
    fetchAcampantesSupabase();
    buscarTotais();
  }, []);

  const carregarEquipantes = async () => {
  try {
    const { data, error } = await fetchEquipantesInscritos();

    if (error) throw error;

    setInscricoes(data || []);
  } catch (error) {
    console.error('Erro ao carregar equipantes:', error);
    setInscricoes([]);
  }
};

  const fetchAcampantesSupabase = async () => {
    setLoadingAcampantes(true);
    setErrorAcampantes(null);
    try {
      const data = await getAcampantes();
      setAcampantesList(data || []);
      setRefreshReports(prev => prev + 1);
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

  const buscarTotais = async () => {
    try {
      const { count: equipantesCount, error: equipantesError } = await countEquipantesInscritos();

      if (equipantesError) throw equipantesError;

      const { count: acampantesCount, error: acampantesError } = await countAcampantes();

      if (acampantesError) throw acampantesError;

      setTotalEquipantes(equipantesCount || 0);
      setTotalAcampantes(acampantesCount || 0);
    } catch (error) {
      console.error('Erro ao buscar totais:', error);
    }
  };

  const handleDeleteAcampante = (acampante) => {
    setAcampanteToDeactivate(acampante);
  };

  const confirmarDesativacaoAcampante = async () => {
    if (!acampanteToDeactivate) return;

    setLoadingAcampantes(true);

    try {
      const result = await deleteAcampante(acampanteToDeactivate.id);

      if (result.success) {
        setAcampanteToDeactivate(null);

        toast({
          title: "Sucesso",
          description: "Acampante desativado.",
        });

        fetchAcampantesSupabase();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: err.message || "Falha ao desativar acampante.",
        variant: "destructive",
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
    
    let headers = [];
    let rows = [];

    if (tipo === 'equipantes') {
      headers = ['CPF', 'Nome', 'Email', 'Telefone', 'Idade', 'Cidade', 'Estado', 'Igreja', 'Pastor', 'Status'];
      rows = dadosParaExportar.map(i => [
        i.cpf, i.nome, i.email, i.telefone, i.idade, i.cidade, i.estado, i.igreja, i.pastor, i.status]);
    } else {
      headers = ['CPF', 'Nome', 'Email', 'WhatsApp', 'Idade', 'Cidade', 'Estado', 'Igreja', 'Status'];
      rows = dadosParaExportar.map(i => [
        i.cpf, i.nome, i.email, i.whatsapp, i.idade, i.cidade, i.estado, i.igreja, i.status]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tipo}_metanoia_radical.csv`;
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
    const equipantes = inscricoes.filter(i => i.tipo === 'equipante');
    return {
      equipantes,
      filteredEquipantes: filterInscricoes(equipantes, searchTermEquipantes),
    };
  }, [inscricoes, searchTermEquipantes]);

  const allocatedGroups = useMemo(() => {
    return groupAcampantesByTrilha(acampantesList);
  }, [acampantesList]);

  const handleViewDetails = (acampante) => {
    const adapted = {
      ...acampante,
      telefone: acampante.whatsapp,
      contatoEmergencia: acampante.contato_emergencia_nome,
      telefoneEmergencia: acampante.contato_emergencia_telefone,
      experienciaAnterior: acampante.experiencia_anterior,
      motivacao: acampante.motivacao,
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
          </div>
          
          <InscricoesStatsCards
            equipantes={totalEquipantes}
            acampantes={totalAcampantes}
            total={totalEquipantes + totalAcampantes}
          />

          <Tabs defaultValue="acampantes" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-white/10">
              <TabsTrigger value="acampantes" className="data-[state=active]:bg-green-600">
                Acampantes ({totalAcampantes})
              </TabsTrigger>
              <TabsTrigger value="equipantes" className="data-[state=active]:bg-red-600">
                Equipantes ({totalEquipantes})
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
                  <div className="mb-8">
                    <AcampantesStatsCards 
                      acampantes={acampantesList}
                      loading={loadingAcampantes}
                      onCardClick={handleStatsCardClick}
                    />
                  </div>

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
                onExportar={exportarDados}
                searchTerm={searchTermEquipantes}
                onSearchChange={setSearchTermEquipantes}
              />
            </TabsContent>
          </Tabs>

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

          <AlertDialog
            open={!!acampanteToDeactivate}
            onOpenChange={(open) => {
              if (!open) setAcampanteToDeactivate(null);
            }}
          >
            <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Desativar inscrição
                </AlertDialogTitle>

                <AlertDialogDescription className="text-gray-400">
                  Tem certeza que deseja desativar a inscrição
                  {acampanteToDeactivate?.nome && (
                    <>
                      {' do acampante '}
                      <strong className="text-white">
                        {acampanteToDeactivate.nome}
                      </strong>
                    </>
                  )}
                  ? Esta ação removerá o acampante da lista de inscritos.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                  Cancelar
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={confirmarDesativacaoAcampante}
                  className="bg-red-600 hover:bg-red-700 text-white border-none"
                >
                  Desativar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </motion.div>
      </Layout>
    </>
  );
};

export default GerenciarInscricoesPage;