import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { WORK_AREAS, DEFAULT_AREA_CAPACITY, AREAS_ESPECIAIS } from '@/constants/workAreas';
import { fetchApprovedEquipantes, saveScales, fetchAllAllocations, detectAllocationChanges } from '@/services/scalesService';
import { fetchLimitesAreas, saveLimiteAreaComGenero, getLimiteAreaComGenero } from '@/services/limiteAreasService';
import { verifyDatabaseSchema } from '@/services/databaseVerification';
import { exportEquipantesByArea, exportAllEquipantes } from '@/utils/excelExport';
import { batchUpdateWorkScheduleStatus } from '@/services/workScheduleService';
import { alocarEquipanteManualmente, realocarEquipante, alocarAreasEspeciaisPorCpf } from '@/services/equipanteAllocationService';
import { fetchCpfsAreasEspeciais } from '@/services/organizerConfigService';
import { Grid, Loader2, AlertTriangle, CheckCircle, Download, AlertCircle, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AreaLimitHeader from '@/components/scales/AreaLimitHeader';
import EquipantesGridDisplay from '@/components/scales/EquipantesGridDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [isAllocatingAreasEspeciais, setIsAllocatingAreasEspeciais] = useState(false);
  
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

      const idsAlocados = new Set((existingAllocations || []).map(a => a.id));
      setWaitlist((equipantes || []).filter(eq => !idsAlocados.has(eq.id)));

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
    await fetchBackgroundData(false);
    setLoadingLimits(false);
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
        console.log('[updateWorkScheduleForAllocations] No CPFs to update');
        return {
          success: true,
          message: 'Nenhum CPF para atualizar'
        };
      }
      console.log(`[updateWorkScheduleForAllocations] Updating scale_status for ${cpfsToUpdate.length} equipantes`);

      const result = await batchUpdateWorkScheduleStatus(cpfsToUpdate);
      if (result.success) {
        const totalProcessed = result.updated + result.alreadyUpdated;
        if (totalProcessed > 0) {
          console.log(`[updateWorkScheduleForAllocations] Successfully updated ${result.updated} equipantes, ${result.alreadyUpdated} already updated`);

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
    const area = manualAreaChoice[equipanteId];
    if (!area) {
      toast({ title: "Selecione uma área", variant: "destructive" });
      return;
    }
    setManualAllocating(prev => ({ ...prev, [equipanteId]: true }));
    try {
      const resultado = await alocarEquipanteManualmente(equipanteId, area);
      if (resultado.success) {
        toast({
          title: "Alocado com sucesso",
          description: `${nomeEquipante} foi alocado em ${area}.`,
          className: "bg-green-600 text-white"
        });
        fetchBackgroundData(false);
      } else {
        toast({
          title: "Não foi possível alocar",
          description: resultado.error,
          variant: "destructive"
        });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [equipanteId]: false }));
    }
  };

  // Realocacao de quem JA esta alocado (diferente de handleManualAllocate,
  // que so serve pra lista de espera). Reaproveita os mesmos states
  // manualAreaChoice/manualAllocating (chaveados por equipanteId) -- nao ha
  // colisao possivel entre um id da lista de espera e um id ja alocado, e
  // assim evita duplicar state so pra isso.
  const handleRealocar = async (equipanteId, nomeEquipante, areaAtual) => {
    const novaArea = manualAreaChoice[equipanteId];
    if (!novaArea) {
      toast({ title: "Selecione a nova área", variant: "destructive" });
      return;
    }
    setManualAllocating(prev => ({ ...prev, [equipanteId]: true }));
    try {
      const resultado = await realocarEquipante(equipanteId, novaArea);
      if (resultado.success) {
        toast({
          title: "Realocado com sucesso",
          description: `${nomeEquipante} foi movido de ${areaAtual} para ${novaArea}.`,
          className: "bg-green-600 text-white"
        });
        setManualAreaChoice(prev => {
          const next = { ...prev };
          delete next[equipanteId];
          return next;
        });
        fetchBackgroundData(false);
      } else {
        toast({
          title: "Não foi possível realocar",
          description: resultado.error,
          variant: "destructive"
        });
      }
    } finally {
      setManualAllocating(prev => ({ ...prev, [equipanteId]: false }));
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

  // Botao "Alocar Áreas Especiais": compara os CPFs configurados em
  // Configuracoes (uma das 3 areas especiais -- Guia, Inimigo, Espirito
  // Santo) com os equipantes aprovados. Quem ja tem area, realoca da area
  // atual pra area especial configurada; quem ainda esta na lista de
  // espera (aprovado, sem area nenhuma), aloca direto na area especial.
  // Toda a logica de comparacao/decisao mora em alocarAreasEspeciaisPorCpf
  // (equipanteAllocationService.js); aqui so busca os dados de entrada,
  // chama a funcao e traduz o resultado num toast pro organizador.
  const handleAlocarAreasEspeciais = async () => {
    setIsAllocatingAreasEspeciais(true);
    try {
      const [cpfsPorArea, equipantesAprovados, allocationsAtuais] = await Promise.all([
        fetchCpfsAreasEspeciais(),
        fetchApprovedEquipantes(),
        fetchAllAllocations()
      ]);

      const totalConfigurado = AREAS_ESPECIAIS.reduce((acc, area) => acc + (cpfsPorArea[area.key]?.length || 0), 0);
      if (totalConfigurado === 0) {
        toast({
          title: "Nada para alocar",
          description: "Nenhum CPF foi configurado nas Áreas Especiais ainda. Configure em Configurações primeiro.",
          variant: "destructive"
        });
        return;
      }

      const resultado = await alocarAreasEspeciaisPorCpf(cpfsPorArea, equipantesAprovados, allocationsAtuais);

      const houveMudanca = resultado.movidos.length > 0 || resultado.alocadosDiretamente.length > 0;

      const partes = [];
      if (resultado.movidos.length > 0) partes.push(`${resultado.movidos.length} realocado(s)`);
      if (resultado.alocadosDiretamente.length > 0) partes.push(`${resultado.alocadosDiretamente.length} alocado(s) direto na área especial (estavam na lista de espera)`);
      if (resultado.jaNaAreaCorreta.length > 0) partes.push(`${resultado.jaNaAreaCorreta.length} já estava(m) na área certa`);
      if (resultado.naoEncontrados.length > 0) partes.push(`${resultado.naoEncontrados.length} CPF(s) não encontrado(s) entre os equipantes aprovados`);
      if (resultado.falhas.length > 0) partes.push(`${resultado.falhas.length} falha(s) ao alocar/realocar (ex: área cheia)`);

      const houveProblema = resultado.falhas.length > 0 && !houveMudanca;

      toast({
        title: houveMudanca ? "Áreas especiais atualizadas" : "Nenhuma alocação feita",
        description: partes.length > 0 ? partes.join(' · ') : "Nada a fazer.",
        variant: houveProblema ? "destructive" : undefined,
        className: houveProblema ? undefined : "bg-blue-600 text-white border-none"
      });

      if (houveMudanca) {
        fetchBackgroundData(false);
      }
    } catch (error) {
      toast({
        title: "Erro ao alocar áreas especiais",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setIsAllocatingAreasEspeciais(false);
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
              Geração de Escalas
            </h1>
            <p className="text-gray-400">Distribuição automática.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap justify-end">
            <Button onClick={handleAlocarAreasEspeciais} disabled={isAllocatingAreasEspeciais} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isAllocatingAreasEspeciais ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
              Alocar Áreas Especiais
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

        {waitlist.length > 0 && <Card className="bg-yellow-900/10 border-yellow-900/30">
            <div className="p-4 border-b border-yellow-900/30 flex items-center gap-2">
              <AlertTriangle className="text-yellow-500 h-5 w-5" /><h3 className="font-semibold text-white">Lista de Espera — sem vaga nas 3 opções ({waitlist.length})</h3>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {waitlist.map((eq) => (
                <div key={eq.id} className="bg-yellow-900/20 border border-yellow-700/30 rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <p className="text-white font-medium">{eq.nome} <span className="text-xs text-yellow-500/70">({eq.sexo})</span></p>
                    <p className="text-xs text-yellow-200/70">
                      1ª: {eq.area_trabalho_opcao1 || '—'} · 2ª: {eq.area_trabalho_opcao2 || '—'} · 3ª: {eq.area_trabalho_opcao3 || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={manualAreaChoice[eq.id] || ''}
                      onValueChange={(val) => setManualAreaChoice(prev => ({ ...prev, [eq.id]: val }))}
                    >
                      <SelectTrigger className="h-9 w-[200px] bg-black/40 border-white/20 text-white text-xs">
                        <SelectValue placeholder="Escolher área" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_AREAS.map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => handleManualAllocate(eq.id, eq.nome)}
                      disabled={!manualAreaChoice[eq.id] || manualAllocating[eq.id]}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                    >
                      {manualAllocating[eq.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alocar'}
                    </Button>
                  </div>
                </div>
              ))}
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
                  {loadingLimits ? <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div> : <EquipantesGridDisplay equipantes={areaEquipantes} areaName={area} onExport={handleExportArea} onRealocar={handleRealocar} realocarAreaChoice={manualAreaChoice} onRealocarAreaChoiceChange={(id, val) => setManualAreaChoice(prev => ({ ...prev, [id]: val }))} realocando={manualAllocating} />}
                </div>
              </div>;
        })}
        </div>
      </div>
    </Layout>;
};
export default OrganizerScalesPage;