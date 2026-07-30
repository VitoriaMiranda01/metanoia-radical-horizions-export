import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { WORK_AREAS, DEFAULT_AREA_CAPACITY } from '@/constants/workAreas';
import { fetchApprovedEquipantes, saveScales, fetchAllAllocations, detectAllocationChanges } from '@/lib/organizerHelpers';
import { fetchLimitesAreas, saveLimiteAreaComGenero, getLimiteAreaComGenero } from '@/lib/limiteAreasHelpers';
import { verifyDatabaseSchema } from '@/lib/databaseVerification';
import { exportEquipantesByArea, exportAllEquipantes } from '@/lib/excelExportHelpers';
import { batchUpdateWorkScheduleStatus } from '@/lib/api/workScheduleApi';
import { Grid, Play, Loader2, AlertTriangle, CheckCircle, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EdicaoDisplay from '@/components/EdicaoDisplay';
import AreaLimitHeader from '@/components/scales/AreaLimitHeader';
import EquipantesGridDisplay from '@/components/scales/EquipantesGridDisplay';
import { useEdition } from '@/contexts/EditionContext';

const OrganizerScalesPage = () => {
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [unallocated, setUnallocated] = useState([]);
  const [stats, setStats] = useState(null);
  const [limitsMap, setLimitsMap] = useState({});
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [dbVerification, setDbVerification] = useState({
    checked: false,
    valid: true
  });
  const [saveStatus, setSaveStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const previousAllocationsRef = useRef([]);
  const saveTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);
  
  const { toast } = useToast();
  const { selectedEdition } = useEdition();

  const fetchBackgroundData = async (showLoading = false) => {
    if (isFetchingRef.current || !selectedEdition) return;
    isFetchingRef.current = true;
    if (showLoading) setLoadingLimits(true);
    
    try {
      const [limitsData, existingAllocations, equipantes] = await Promise.all([
        fetchLimitesAreas(), 
        fetchAllAllocations(selectedEdition), 
        fetchApprovedEquipantes(selectedEdition)
      ]);
      
      setLimitsMap(limitsData);
      
      if (existingAllocations && existingAllocations.length > 0) {
        const changed = detectAllocationChanges(existingAllocations, previousAllocationsRef.current);
        if (changed.length > 0 || allocations.length !== existingAllocations.length) {
          setAllocations(existingAllocations);
          previousAllocationsRef.current = [...existingAllocations];
        }
      } else if (existingAllocations?.length === 0 && allocations.length > 0) {
        // Clear allocations if edition has none
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
    await fetchBackgroundData(false);
    setLoadingLimits(false);
  };

  useEffect(() => {
    if (selectedEdition) {
      loadInitialData();
    }
  }, [selectedEdition]); // Refetch when edition changes

  useEffect(() => {
    if (selectedEdition) {
      const intervalId = setInterval(() => fetchBackgroundData(false), 30000);
      return () => clearInterval(intervalId);
    }
  }, [selectedEdition]);

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
      // Extract unique CPFs from allocated equipantes
      const cpfsToUpdate = [...new Set(savedAllocations.filter(allocation => allocation.cpf && allocation.allocatedArea && allocation.allocatedArea !== 'Pendente de Alocação Manual').map(allocation => allocation.cpf))];
      if (cpfsToUpdate.length === 0) {
        console.log('[updateWorkScheduleForAllocations] No CPFs to update');
        return {
          success: true,
          message: 'Nenhum CPF para atualizar'
        };
      }
      console.log(`[updateWorkScheduleForAllocations] Updating scale_status for ${cpfsToUpdate.length} equipantes`);

      // Batch update work schedule status
      const result = await batchUpdateWorkScheduleStatus(cpfsToUpdate);
      if (result.success) {
        const totalProcessed = result.updated + result.alreadyUpdated;
        if (totalProcessed > 0) {
          console.log(`[updateWorkScheduleForAllocations] Successfully updated ${result.updated} equipantes, ${result.alreadyUpdated} already updated`);

          // Show success toast only if there were actual updates
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
      // Save the scale allocations
      await attemptSaveWithRetry(changesToSave);
      previousAllocationsRef.current = [...allocations];
      setSaveStatus('success');

      // Update scale_status for allocated equipantes
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

  const handleRunAlgorithm = async () => {
    setLoading(true);
    setStats(null);
    try {
      const [equipantes, fetchedLimits] = await Promise.all([
        fetchApprovedEquipantes(selectedEdition), 
        fetchLimitesAreas()
      ]);
      setLimitsMap(fetchedLimits);
      if (!equipantes.length) {
        toast({
          title: "Sem dados",
          description: "Não há equipantes aprovados nesta edição.",
          variant: "warning"
        });
        setLoading(false);
        return;
      }
      const buckets = new Map();
      WORK_AREAS.forEach(area => buckets.set(area, []));
      const pendingAllocation = [];
      const newAllocations = [];
      equipantes.forEach(equipante => {
        let allocated = false;
        let allocatedArea = null;
        const tryAllocate = areaName => {
          if (!areaName) return false;
          const currentBucket = buckets.get(areaName);
          const limitObj = getLimiteAreaComGenero(areaName, fetchedLimits, DEFAULT_AREA_CAPACITY);
          if (currentBucket && currentBucket.length < limitObj.limiteMaximo) {
            currentBucket.push(equipante);
            allocatedArea = areaName;
            return true;
          }
          return false;
        };
        const op1 = equipante.area_trabalho_opcao1 || equipante.areaTrabalhoOpcao1;
        const op2 = equipante.area_trabalho_opcao2 || equipante.areaTrabalhoOpcao2;
        const op3 = equipante.area_trabalho_opcao3 || equipante.areaTrabalhoOpcao3;
        if (tryAllocate(op1)) allocated = true;else if (tryAllocate(op2)) allocated = true;else if (tryAllocate(op3)) allocated = true;
        const displayName = equipante.nome_completo || equipante.nome;
        if (allocated) {
          newAllocations.push({
            ...equipante,
            nome: displayName,
            allocatedArea,
            statusAllocation: 'Alocado',
            isManual: false
          });
        } else {
          pendingAllocation.push({
            ...equipante,
            nome: displayName,
            areaTrabalhoOpcao1: op1,
            areaTrabalhoOpcao2: op2,
            allocatedArea: 'Pendente de Alocação Manual',
            statusAllocation: 'Pendente',
            isManual: false
          });
        }
      });
      setAllocations(newAllocations);
      setUnallocated(pendingAllocation);
      setStats({
        total: equipantes.length,
        allocated: newAllocations.length,
        pending: pendingAllocation.length
      });

      // Update scale_status for all newly allocated equipantes
      if (newAllocations.length > 0) {
        console.log(`[handleRunAlgorithm] Updating scale_status for ${newAllocations.length} allocated equipantes`);
        await updateWorkScheduleForAllocations(newAllocations);
      }
      toast({
        title: "Escalas Geradas",
        description: `${newAllocations.length} equipantes alocados com sucesso.`,
        className: "bg-green-600 text-white"
      });
    } catch (error) {
      console.error('[handleRunAlgorithm] Error:', error);
      toast({
        title: "Erro na execução",
        description: "Falha ao executar o algoritmo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
              Geração de Escalas {selectedEdition ? `- Edição ${selectedEdition}` : ''}
            </h1>
            <p className="text-gray-400">Distribuição automática.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap justify-end">
            <Button onClick={handleRunAlgorithm} disabled={loading || !selectedEdition} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Gerar escalas
            </Button>
            <Button onClick={handleExportAll} disabled={allocations.length === 0} variant="outline" className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/40 hover:text-green-300">
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
          </div>
        </div>

        {dbVerification.checked && !dbVerification.valid && <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-md flex items-center gap-3">
             <AlertTriangle className="h-5 w-5 text-red-400" />
             <p className="text-red-200 text-sm">Atenção: A estrutura do banco de dados parece estar incompleta.</p>
          </div>}

        {stats && <motion.div initial={{
        opacity: 0,
        height: 0
      }} animate={{
        opacity: 1,
        height: 'auto'
      }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-900/20 border-blue-900/50 p-4">
              <p className="text-sm text-blue-400">Total Processado</p><p className="text-2xl font-bold text-white">{stats.total}</p>
            </Card>
            <Card className="bg-green-900/20 border-green-900/50 p-4">
              <p className="text-sm text-green-400">Alocados com Sucesso</p><p className="text-2xl font-bold text-white">{stats.allocated}</p>
            </Card>
            <Card className="bg-yellow-900/20 border-yellow-900/50 p-4">
              <p className="text-sm text-yellow-400">Pendentes (Sem Vaga)</p><p className="text-2xl font-bold text-white">{stats.pending}</p>
            </Card>
          </motion.div>}

        {unallocated.length > 0 && <Card className="bg-yellow-900/10 border-yellow-900/30">
            <div className="p-4 border-b border-yellow-900/30 flex items-center gap-2">
              <AlertTriangle className="text-yellow-500 h-5 w-5" /><h3 className="font-semibold text-white">Pendentes de Alocação Manual ({unallocated.length})</h3>
            </div>
            <div className="p-4 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {unallocated.map((u, idx) => <div key={idx} className="bg-yellow-900/40 text-yellow-200 px-3 py-1 rounded-full text-sm border border-yellow-700/50 flex items-center gap-1">
                  <span>{u.nome}</span>
                  <span className="text-yellow-500/50 text-[10px] ml-1">({(u.areaTrabalhoOpcao1 || '').slice(0, 3)}/{(u.areaTrabalhoOpcao2 || '').slice(0, 3)})</span>
                </div>)}
            </div>
          </Card>}

        <div className="flex flex-col gap-6">
          {WORK_AREAS.map((area, index) => {
          const areaEquipantes = getEquipantesByArea(area);
          const limitObj = getLimiteAreaComGenero(area, limitsMap, DEFAULT_AREA_CAPACITY);
          const mulheresCount = getGenderCount(areaEquipantes, 'feminino');
          const homensCount = getGenderCount(areaEquipantes, 'masculino');
          return <div key={index} className="bg-black/40 border border-white/10 rounded-lg overflow-hidden shadow-md backdrop-blur-sm">
                <div className="sticky top-0 z-10 bg-gray-900 border-b border-white/10">
                  <AreaLimitHeader areaName={area} currentCount={areaEquipantes.length} currentMulheres={mulheresCount} currentHomens={homensCount} limitObj={limitObj} onSaveLimit={handleUpdateLimit} isOrganizer={true} />
                </div>
                
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  {loadingLimits ? <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div> : <EquipantesGridDisplay equipantes={areaEquipantes} areaName={area} onExport={handleExportArea} />}
                </div>
              </div>;
        })}
        </div>
      </div>
    </Layout>;
};
export default OrganizerScalesPage;