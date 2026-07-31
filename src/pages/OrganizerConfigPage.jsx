import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchConfiguracoes, saveConfiguracoes, updateInscricoesStatus } from '@/lib/organizerHelpers';
import { verifyDatabaseSchema } from '@/lib/databaseVerification';
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { Settings, Loader2, Calendar, Lock, Unlock, AlertCircle, FileText, DollarSign, CalendarDays, CheckCircle2, Tag, Plus, Trash2, Clock, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useEdition } from '@/contexts/EditionContext';
import PricingPeriodsManager from '@/components/PricingPeriodsManager';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const getMonthNumber = monthName => {
  const index = MESES.indexOf(monthName);
  return index !== -1 ? String(index + 1).padStart(2, '0') : null;
};
const buildDateString = (day, monthName, year) => {
  if (!day || !monthName || !year) return null;
  const monthNum = getMonthNumber(monthName);
  if (!monthNum) return null;
  const d = String(day).padStart(2, '0');
  const dateStr = `${year}-${monthNum}-${d}`;
  const dateObj = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dateObj.getTime())) return null;
  return dateStr;
};
const parseDateString = dateStr => {
  if (!dateStr) return {
    day: '',
    month: '',
    year: ''
  };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return {
    day: '',
    month: '',
    year: ''
  };
  const [year, monthNum, day] = parts;
  const monthIndex = parseInt(monthNum, 10) - 1;
  return {
    day: parseInt(day, 10).toString(),
    month: MESES[monthIndex] || '',
    year: year
  };
};
const FieldIndicator = ({
  status
}) => {
  return <AnimatePresence mode="wait">
      {status === 'saving' && <motion.span initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} exit={{
      opacity: 0
    }} className="text-xs text-gray-500 font-medium">
          Salvando...
        </motion.span>}
      {status === 'saved' && <motion.span initial={{
      opacity: 0,
      scale: 0.8
    }} animate={{
      opacity: 1,
      scale: 1
    }} exit={{
      opacity: 0
    }} className="text-xs text-green-500 flex items-center font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" />
        </motion.span>}
    </AnimatePresence>;
};
const OrganizerConfigPage = () => {
  const {
    organizadorId,
    organizadorUser,
    user,
    isAuthenticated
  } = useAuth();
  const {
    selectedEdition
  } = useEdition();
  const [config, setConfig] = useState({
    max_equipantes: '',
    max_acampantes: '',
    max_acampantes_homens: '',
    max_acampantes_mulheres: '',
    numero_edicao: '',
    data_edicao_dia_inicio: '',
    data_edicao_dia_fim: '',
    data_edicao_mes: '',
    data_edicao_ano: '',
    horario_saida_igreja: '',
    horario_retorno_sitio: '',
    data_limite_inscricao_pagamento: '',
    equipante_pricing_periods: [],
    acampante_pricing_periods: []
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [fieldStatus, setFieldStatus] = useState({});
  const [sectionStatus, setSectionStatus] = useState({});
  const [dbStatus, setDbStatus] = useState({
    checked: false,
    success: true
  });
  const {
    equipantesAbertos,
    acampantesAbertos,
    loading: loadingStatus,
    refetch: refetchStatus
  } = useInscricoesStatus();
  const [statusControl, setStatusControl] = useState({
    equipantes: true,
    acampantes: true
  });
  const [savingStatus, setSavingStatus] = useState(false);
  const {
    toast
  } = useToast();
  const saveTimeoutsRef = useRef({});
  const [coupons, setCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [newCoupon, setNewCoupon] = useState({
    codigo: '',
    desconto_fixo: '',
    ativo: true
  });
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);
  useEffect(() => {
    checkDb();
    loadCoupons();
  }, []);
  useEffect(() => {
    const targetOrganizadorId = organizadorId || organizadorUser?.id || user?.id;
    if (targetOrganizadorId !== undefined || isAuthenticated) {
      loadData(targetOrganizadorId, selectedEdition);
    }
  }, [organizadorId, organizadorUser?.id, user?.id, isAuthenticated, selectedEdition]);
  useEffect(() => {
    if (!loadingStatus) {
      setStatusControl({
        equipantes: equipantesAbertos,
        acampantes: acampantesAbertos
      });
    }
  }, [loadingStatus, equipantesAbertos, acampantesAbertos]);
  const checkDb = async () => {
    const result = await verifyDatabaseSchema();
    setDbStatus({
      checked: true,
      success: result.valid,
      errors: result.errors
    });
  };
  const loadData = async (targetId, editionNum) => {
    setLoadingConfig(true);
    try {
      const data = await fetchConfiguracoes(targetId, editionNum);
      const {
        data: directConfigData
      } = await supabase.from('configuracoes').select('*').eq('edicao_numero', editionNum || data.edicao_numero).single();
      const mergedData = {
        ...data,
        ...directConfigData
      };
      const parsedInicio = parseDateString(mergedData.data_evento_inicio);
      const parsedFim = parseDateString(mergedData.data_evento_fim);
      setConfig({
        max_equipantes: mergedData.max_equipantes || '',
        max_acampantes: mergedData.max_acampantes || '',
        max_acampantes_homens: mergedData.max_acampantes_homens || '',
        max_acampantes_mulheres: mergedData.max_acampantes_mulheres || '',
        numero_edicao: mergedData.edicao_numero || mergedData.numero_edicao || editionNum || '',
        data_edicao_dia_inicio: parsedInicio.day || mergedData.data_edicao_dia_inicio || '',
        data_edicao_dia_fim: parsedFim.day || mergedData.data_edicao_dia_fim || '',
        data_edicao_mes: parsedInicio.month || mergedData.data_edicao_mes || '',
        data_edicao_ano: parsedInicio.year || mergedData.data_edicao_ano || '',
        horario_saida_igreja: mergedData.horario_saida_igreja || '',
        horario_retorno_sitio: mergedData.horario_retorno_sitio || '',
        data_limite_inscricao_pagamento: mergedData.data_limite_inscricao_pagamento || '',
        equipante_pricing_periods: mergedData.equipante_pricing_periods || [],
        acampante_pricing_periods: mergedData.acampante_pricing_periods || []
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive"
      });
    } finally {
      setLoadingConfig(false);
    }
  };
  const validateDateField = (field, value) => {
    if (!value) return true;
    if (field === 'data_edicao_dia_inicio' || field === 'data_edicao_dia_fim') {
      const day = parseInt(value, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        toast({
          title: "Data inválida",
          description: "O dia deve ser um número entre 1 e 31.",
          variant: "destructive"
        });
        return false;
      }
    }
    if (field === 'data_edicao_ano') {
      const year = parseInt(value, 10);
      if (isNaN(year) || year < 2020 || year > 2099) {
        toast({
          title: "Ano inválido",
          description: "O ano deve ter 4 dígitos e ser válido (ex: 2024).",
          variant: "destructive"
        });
        return false;
      }
    }
    return true;
  };
  const saveCombinedDates = async (currentConfig, editionNum, triggeringField) => {
    setSaveStatus('saving');
    setFieldStatus(prev => ({
      ...prev,
      [triggeringField]: 'saving'
    }));
    try {
      if (!editionNum) throw new Error("Número da edição é necessário para salvar.");
      const dateInicioStr = buildDateString(currentConfig.data_edicao_dia_inicio, currentConfig.data_edicao_mes, currentConfig.data_edicao_ano);
      const dateFimStr = buildDateString(currentConfig.data_edicao_dia_fim, currentConfig.data_edicao_mes, currentConfig.data_edicao_ano);
      const updates = {};
      if (dateInicioStr) updates.data_evento_inicio = dateInicioStr;
      if (dateFimStr) updates.data_evento_fim = dateFimStr;
      if (Object.keys(updates).length > 0) {
        const {
          data: existingConfig
        } = await supabase.from('configuracoes').select('id').eq('edicao_numero', editionNum).maybeSingle();
        let error;
        if (existingConfig) {
          const {
            error: updateError
          } = await supabase.from('configuracoes').update(updates).eq('edicao_numero', editionNum);
          error = updateError;
        } else {
          const {
            error: insertError
          } = await supabase.from('configuracoes').insert([{
            edicao_numero: editionNum,
            ...updates
          }]);
          error = insertError;
        }
        if (error) throw error;
      }
      setSaveStatus('saved');
      setFieldStatus(prev => ({
        ...prev,
        [triggeringField]: 'saved'
      }));
      setTimeout(() => {
        setSaveStatus(current => current === 'saved' ? 'idle' : current);
        setFieldStatus(current => ({
          ...current,
          [triggeringField]: 'idle'
        }));
      }, 2000);
      return true;
    } catch (error) {
      console.error(`[OrganizerConfigPage] Save error for dates:`, error);
      setSaveStatus('error');
      setFieldStatus(prev => ({
        ...prev,
        [triggeringField]: 'error'
      }));
      toast({
        title: "Erro ao salvar data",
        description: `Falha ao salvar as datas. Verifique se formam uma data válida.`,
        variant: "destructive"
      });
      setTimeout(() => {
        setSaveStatus('idle');
        setFieldStatus(prev => ({
          ...prev,
          [triggeringField]: 'idle'
        }));
      }, 3000);
      return false;
    }
  };
  const executeSave = async (updatedConfig, fieldName) => {
    const isDateField = ['data_edicao_dia_inicio', 'data_edicao_dia_fim', 'data_edicao_mes', 'data_edicao_ano'].includes(fieldName);
    if (isDateField) {
      return await saveCombinedDates(updatedConfig, updatedConfig.numero_edicao, fieldName);
    }
    setSaveStatus('saving');
    setFieldStatus(prev => ({
      ...prev,
      [fieldName]: 'saving'
    }));
    const targetOrganizadorId = organizadorId || organizadorUser?.id || user?.id;
    try {
      const payload = {
        ...updatedConfig,
        organizadorId: targetOrganizadorId
      };
      await saveConfiguracoes(payload, fieldName);
      setSaveStatus('saved');
      setFieldStatus(prev => ({
        ...prev,
        [fieldName]: 'saved'
      }));
      setTimeout(() => {
        setSaveStatus(current => current === 'saved' ? 'idle' : current);
      }, 2000);
      setTimeout(() => {
        setFieldStatus(current => ({
          ...current,
          [fieldName]: 'idle'
        }));
      }, 2000);
      return true;
    } catch (error) {
      setSaveStatus('error');
      setFieldStatus(prev => ({
        ...prev,
        [fieldName]: 'error'
      }));
      toast({
        title: "Erro ao salvar",
        description: `Falha ao salvar campo. Revertendo alterações...`,
        variant: "destructive"
      });
      loadData(targetOrganizadorId, selectedEdition);
      setTimeout(() => {
        setSaveStatus('idle');
        setFieldStatus(prev => ({
          ...prev,
          [fieldName]: 'idle'
        }));
      }, 3000);
      return false;
    }
  };

  const handleManualSave = async (field) => {
    if (saveTimeoutsRef.current[field]) {
      clearTimeout(saveTimeoutsRef.current[field]);
    }
    const success = await executeSave(config, field);
    if (success) {
      toast({
        title: "Salvo com sucesso",
        description: "A alteração foi registrada no banco de dados.",
        className: "bg-emerald-600 text-white border-none"
      });
    }
  };

  const handleSaveSection = async (sectionKey) => {
    setSectionStatus(prev => ({ ...prev, [sectionKey]: 'saving' }));
    try {
      if (sectionKey === 'datas') {
        const r = await saveCombinedDates(config, config.numero_edicao, 'data_edicao_dia_inicio');
        if (!r) throw new Error("Erro de validação de data");
      } else {
        const targetId = organizadorId || organizadorUser?.id || user?.id;
        await saveConfiguracoes({ ...config, organizadorId: targetId }); 
      }
      setSectionStatus(prev => ({ ...prev, [sectionKey]: 'saved' }));
      toast({
        title: "Seção salva",
        description: "Configurações atualizadas com sucesso.",
        className: "bg-emerald-600 text-white border-none"
      });
      setTimeout(() => setSectionStatus(prev => ({ ...prev, [sectionKey]: 'idle' })), 2000);
    } catch (error) {
      setSectionStatus(prev => ({ ...prev, [sectionKey]: 'error' }));
      toast({
        title: "Erro ao salvar",
        description: "Falha ao salvar os dados da seção.",
        variant: "destructive"
      });
      setTimeout(() => setSectionStatus(prev => ({ ...prev, [sectionKey]: 'idle' })), 3000);
    }
  };

  const handleLocalConfigChange = (field, value) => {
    if (!validateDateField(field, value)) return;
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfigChange = (field, value) => {
    if (!validateDateField(field, value)) return;
    let currentConfigSnapshot;
    setConfig(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      if (field === 'max_acampantes_homens' || field === 'max_acampantes_mulheres') {
        const homens = field === 'max_acampantes_homens' ? parseInt(value, 10) || 0 : parseInt(prev.max_acampantes_homens, 10) || 0;
        const mulheres = field === 'max_acampantes_mulheres' ? parseInt(value, 10) || 0 : parseInt(prev.max_acampantes_mulheres, 10) || 0;
        updated.max_acampantes = homens + mulheres;
      }
      currentConfigSnapshot = updated;
      return updated;
    });
    if (saveTimeoutsRef.current[field]) clearTimeout(saveTimeoutsRef.current[field]);
    setFieldStatus(prev => ({
      ...prev,
      [field]: 'saving'
    }));
    const delay = ['horario_saida_igreja', 'horario_retorno_sitio', 'data_limite_inscricao_pagamento'].includes(field) ? 500 : 1500;
    saveTimeoutsRef.current[field] = setTimeout(() => {
      executeSave(currentConfigSnapshot, field);
    }, delay);
  };

  const handleToggleInscriptionStatus = async (type, checked) => {
    setSavingStatus(true);
    const newStatusControl = {
      ...statusControl,
      [type]: checked
    };
    setStatusControl(newStatusControl);
    try {
      await updateInscricoesStatus(newStatusControl.equipantes, newStatusControl.acampantes);
      toast({
        title: "Status atualizado",
        description: `Inscrições ${checked ? 'ABERTAS' : 'FECHADAS'}.`,
        className: "bg-green-600 text-white"
      });
      refetchStatus();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status.",
        variant: "destructive"
      });
      setStatusControl({
        equipantes: equipantesAbertos,
        acampantes: acampantesAbertos
      });
    } finally {
      setSavingStatus(false);
    }
  };
  const loadCoupons = async () => {
    try {
      setLoadingCoupons(true);
      const {
        data,
        error
      } = await supabase.from('cupons').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar cupons",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingCoupons(false);
    }
  };
  const handleCreateCoupon = async e => {
    e.preventDefault();
    if (!newCoupon.codigo || !newCoupon.desconto_fixo) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o código e o valor do desconto.",
        variant: "destructive"
      });
      return;
    }
    const desconto = parseFloat(newCoupon.desconto_fixo);
    if (isNaN(desconto) || desconto < 0.01) {
      toast({
        title: "Valor inválido",
        description: "O desconto deve ser maior que zero.",
        variant: "destructive"
      });
      return;
    }
    setIsCreatingCoupon(true);
    try {
      const {
        error
      } = await supabase.from('cupons').insert([{
        codigo: newCoupon.codigo.trim().toUpperCase(),
        desconto_fixo: desconto,
        ativo: newCoupon.ativo
      }]);
      if (error) throw error;
      toast({
        title: "Sucesso!",
        description: "Cupom criado com sucesso.",
        className: "bg-emerald-600 text-white"
      });
      setNewCoupon({
        codigo: '',
        desconto_fixo: '',
        ativo: true
      });
      loadCoupons();
    } catch (error) {
      toast({
        title: "Erro ao criar cupom",
        description: error.code === '23505' ? 'Este código já existe.' : error.message,
        variant: "destructive"
      });
    } finally {
      setIsCreatingCoupon(false);
    }
  };
  const handleToggleCoupon = async (id, currentStatus) => {
    try {
      const {
        error
      } = await supabase.from('cupons').update({
        ativo: !currentStatus
      }).eq('id', id);
      if (error) throw error;
      setCoupons(prev => prev.map(c => c.id === id ? {
        ...c,
        ativo: !currentStatus
      } : c));
      toast({
        title: "Status atualizado",
        description: "O status do cupom foi alterado."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status do cupom.",
        variant: "destructive"
      });
    }
  };
  const handleDeleteCoupon = async () => {
    if (!couponToDelete) return;
    try {
      const {
        error
      } = await supabase.from('cupons').delete().eq('id', couponToDelete.id);
      if (error) throw error;
      setCoupons(prev => prev.filter(c => c.id !== couponToDelete.id));
      toast({
        title: "Cupom deletado",
        description: "O cupom foi removido com sucesso."
      });
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o cupom.",
        variant: "destructive"
      });
    } finally {
      setCouponToDelete(null);
    }
  };
  const formatCurrency = value => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  if (loadingConfig) {
    return <Layout>
        <Helmet><title>Configurações do Organizador</title></Helmet>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-400 font-medium">Carregando configurações da edição {selectedEdition}...</p>
        </div>
      </Layout>;
  }
  return <Layout>
      <Helmet><title>Configurações do Organizador</title></Helmet>
      <div className="space-y-8 pb-20 max-w-7xl mx-auto py-12 px-4">
        <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-3xl font-bold text-white">Configurações</h1>
              <p className="text-white text-sm mt-1">Gerencie as configurações gerais do projeto</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              {saveStatus === 'saving' && <motion.div initial={{
              opacity: 0,
              scale: 0.8
            }} animate={{
              opacity: 1,
              scale: 1
            }} exit={{
              opacity: 0
            }} className="flex items-center text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-full"><Loader2 className="w-4 h-4 mr-2 animate-spin" /><span className="text-sm font-medium">Salvando...</span></motion.div>}
              {saveStatus === 'saved' && <motion.div initial={{
              opacity: 0,
              scale: 0.8
            }} animate={{
              opacity: 1,
              scale: 1
            }} exit={{
              opacity: 0
            }} className="flex items-center text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full"><CheckCircle2 className="w-4 h-4 mr-2" /><span className="text-sm font-medium">Salvo</span></motion.div>}
              {saveStatus === 'error' && <motion.div initial={{
              opacity: 0,
              scale: 0.8
            }} animate={{
              opacity: 1,
              scale: 1
            }} exit={{
              opacity: 0
            }} className="flex items-center text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full"><AlertCircle className="w-4 h-4 mr-2" /><span className="text-sm font-medium">Erro ao salvar</span></motion.div>}
            </AnimatePresence>
          </div>
        </motion.div>

        {dbStatus.checked && !dbStatus.success && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="text-white font-semibold">Problemas no banco de dados</h3>
              <p className="text-white text-sm">{dbStatus.errors?.join(', ')}</p>
            </div>
          </div>}

        <div className="space-y-8">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white"><Calendar className="w-5 h-5 text-blue-400" /><span>Configurações Gerais</span></CardTitle>
                <CardDescription className="text-gray-400">Defina os parâmetros principais do retiro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Parâmetros Iniciais</h3>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => handleSaveSection('gerais')}
                      disabled={loadingConfig || sectionStatus['gerais'] === 'saving'}
                      className="h-8 w-8 bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                      title="Salvar Parâmetros Iniciais"
                    >
                      {sectionStatus['gerais'] === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2 flex flex-col h-full justify-end">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="numero_edicao" className="text-gray-300">Número da Edição</Label>
                        <FieldIndicator status={fieldStatus['numero_edicao']} />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input id="numero_edicao" type="number" min="1" value={config.numero_edicao} onChange={e => handleLocalConfigChange('numero_edicao', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white focus-visible:ring-blue-500 transition-all duration-300 h-10" />
                      </div>
                    </div>
                    <div className="space-y-2 flex flex-col h-full justify-end">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="max_equipantes" className="text-gray-300">Quantidade Equipantes</Label>
                        <FieldIndicator status={fieldStatus['max_equipantes']} />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Input id="max_equipantes" type="number" min="0" value={config.max_equipantes} onChange={e => handleLocalConfigChange('max_equipantes', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white focus-visible:ring-blue-500 transition-all duration-300 h-10" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">Quantidade de Acampantes</h3>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => handleSaveSection('acampantes')}
                      disabled={loadingConfig || sectionStatus['acampantes'] === 'saving'}
                      className="h-8 w-8 bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                      title="Salvar Quantidade de Acampantes"
                    >
                      {sectionStatus['acampantes'] === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="max_acampantes_homens" className="text-gray-300">Homens</Label>
                      <Input id="max_acampantes_homens" type="number" min="0" value={config.max_acampantes_homens} onChange={e => handleConfigChange('max_acampantes_homens', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_acampantes_mulheres" className="text-gray-300">Mulheres</Label>
                      <Input id="max_acampantes_mulheres" type="number" min="0" value={config.max_acampantes_mulheres} onChange={e => handleConfigChange('max_acampantes_mulheres', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_acampantes" className="text-gray-300">Total</Label>
                      <Input id="max_acampantes" type="number" value={config.max_acampantes} readOnly disabled className="bg-white/5 border-white/10 text-gray-400 cursor-not-allowed font-semibold" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white flex items-center space-x-2"><CalendarDays className="w-5 h-5 text-blue-400" /><span>Data do Evento</span></h3>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => handleSaveSection('datas')}
                      disabled={loadingConfig || sectionStatus['datas'] === 'saving'}
                      className="h-8 w-8 bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                      title="Salvar Data do Evento"
                    >
                      {sectionStatus['datas'] === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="data_edicao_dia_inicio" className="text-gray-300">Dia Início</Label>
                        <FieldIndicator status={fieldStatus['data_edicao_dia_inicio']} />
                      </div>
                      <Input id="data_edicao_dia_inicio" type="number" min="1" max="31" value={config.data_edicao_dia_inicio} onChange={e => handleLocalConfigChange('data_edicao_dia_inicio', e.target.value)} disabled={loadingConfig || fieldStatus['data_edicao_dia_inicio'] === 'saving'} className="bg-white/5 border-white/10 text-white" placeholder="Ex: 16" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="data_edicao_dia_fim" className="text-gray-300">Dia Fim</Label>
                        <FieldIndicator status={fieldStatus['data_edicao_dia_fim']} />
                      </div>
                      <Input id="data_edicao_dia_fim" type="number" min="1" max="31" value={config.data_edicao_dia_fim} onChange={e => handleLocalConfigChange('data_edicao_dia_fim', e.target.value)} disabled={loadingConfig || fieldStatus['data_edicao_dia_fim'] === 'saving'} className="bg-white/5 border-white/10 text-white" placeholder="Ex: 17" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-gray-300">Mês</Label>
                        <FieldIndicator status={fieldStatus['data_edicao_mes']} />
                      </div>
                      <Select value={config.data_edicao_mes} onValueChange={val => handleLocalConfigChange('data_edicao_mes', val)} disabled={loadingConfig || fieldStatus['data_edicao_mes'] === 'saving'}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[300px]">
                          {MESES.map(m => <SelectItem key={m} value={m} className="hover:bg-gray-700 focus:bg-gray-700">{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="data_edicao_ano" className="text-gray-300">Ano</Label>
                        <FieldIndicator status={fieldStatus['data_edicao_ano']} />
                      </div>
                      <Input id="data_edicao_ano" type="number" min="2020" max="2099" value={config.data_edicao_ano} onChange={e => handleLocalConfigChange('data_edicao_ano', e.target.value)} disabled={loadingConfig || fieldStatus['data_edicao_ano'] === 'saving'} className="bg-white/5 border-white/10 text-white" placeholder="Ex: 2026" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <span>Prazos e Horários</span>
                    </h3>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => handleSaveSection('prazos')}
                      disabled={loadingConfig || sectionStatus['prazos'] === 'saving'}
                      className="h-8 w-8 bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                      title="Salvar Prazos e Horários"
                    >
                      {sectionStatus['prazos'] === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="horario_saida_igreja" className="text-gray-300">Horário Saída Igreja</Label>
                        <FieldIndicator status={fieldStatus['horario_saida_igreja']} />
                      </div>
                      <Input id="horario_saida_igreja" type="time" value={config.horario_saida_igreja || ''} onChange={e => handleConfigChange('horario_saida_igreja', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white css-invert-time-icon" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="horario_retorno_sitio" className="text-gray-300">Horário Retorno Sítio</Label>
                        <FieldIndicator status={fieldStatus['horario_retorno_sitio']} />
                      </div>
                      <Input id="horario_retorno_sitio" type="time" value={config.horario_retorno_sitio || ''} onChange={e => handleConfigChange('horario_retorno_sitio', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white css-invert-time-icon" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="data_limite_inscricao_pagamento" className="text-gray-300">Data Limite Inscrição/Pagamento</Label>
                        <FieldIndicator status={fieldStatus['data_limite_inscricao_pagamento']} />
                      </div>
                      <Input id="data_limite_inscricao_pagamento" type="date" value={config.data_limite_inscricao_pagamento || ''} onChange={e => handleConfigChange('data_limite_inscricao_pagamento', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white css-invert-time-icon" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.1
        }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white"><DollarSign className="w-5 h-5 text-emerald-400" /><span>Taxa de Inscrição</span></CardTitle>
                <CardDescription className="text-gray-400">Defina os períodos e valores de inscrição para esta edição</CardDescription>
              </CardHeader>
              <CardContent className="space-y-10">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Equipantes</h3>
                  <PricingPeriodsManager type="equipante" periods={config.equipante_pricing_periods} onChange={periods => handleConfigChange('equipante_pricing_periods', periods)} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Acampantes</h3>
                  <PricingPeriodsManager type="acampante" periods={config.acampante_pricing_periods} onChange={periods => handleConfigChange('acampante_pricing_periods', periods)} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.2
        }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white"><Tag className="w-5 h-5 text-purple-400" /><span>Cupons de Desconto</span></CardTitle>
                <CardDescription className="text-gray-400">Gerencie os cupons promocionais para pagamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 bg-white/5 border border-white/10 p-6 rounded-xl space-y-6 self-start">
                    <h3 className="text-lg font-medium text-white">Criar Novo Cupom</h3>
                    <form onSubmit={handleCreateCoupon} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="codigo" className="text-gray-300">Código do Cupom</Label>
                        <Input id="codigo" placeholder="EX: LOTE1PROMO" value={newCoupon.codigo} onChange={e => setNewCoupon({
                        ...newCoupon,
                        codigo: e.target.value.toUpperCase()
                      })} className="bg-white/5 border-white/10 text-white uppercase placeholder:text-gray-600" disabled={isCreatingCoupon} maxLength={20} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="desconto_fixo" className="text-gray-300">Valor do Desconto (R$)</Label>
                        <Input id="desconto_fixo" type="number" step="0.01" min="0.01" placeholder="50.00" value={newCoupon.desconto_fixo} onChange={e => setNewCoupon({
                        ...newCoupon,
                        desconto_fixo: e.target.value
                      })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-600" disabled={isCreatingCoupon} />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="space-y-0.5">
                          <Label htmlFor="ativo" className="text-gray-300">Cupom Ativo</Label>
                          <p className="text-xs text-gray-500">Habilita o uso imediato</p>
                        </div>
                        <Switch id="ativo" checked={newCoupon.ativo} onCheckedChange={checked => setNewCoupon({
                        ...newCoupon,
                        ativo: checked
                      })} disabled={isCreatingCoupon} />
                      </div>
                      <Button type="submit" disabled={isCreatingCoupon} className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2">
                        {isCreatingCoupon ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Criar Cupom
                      </Button>
                    </form>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="rounded-md border border-white/10 overflow-hidden bg-black/20">
                      <Table>
                        <TableHeader className="bg-white/5 hover:bg-white/5">
                          <TableRow className="border-b border-white/10 hover:bg-transparent">
                            <TableHead className="text-gray-300">Código</TableHead>
                            <TableHead className="text-gray-300">Desconto</TableHead>
                            <TableHead className="text-gray-300">Status</TableHead>
                            <TableHead className="text-right text-gray-300">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingCoupons ? <TableRow className="border-b border-white/5 hover:bg-white/5"><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" /><span className="text-gray-400 text-sm">Carregando cupons...</span></TableCell></TableRow> : coupons.length === 0 ? <TableRow className="border-b border-white/5 hover:bg-white/5"><TableCell colSpan={4} className="h-24 text-center text-gray-400">Nenhum cupom criado ainda.</TableCell></TableRow> : coupons.map(coupon => <TableRow key={coupon.id} className="border-b border-white/5 hover:bg-white/5"><TableCell className="font-medium text-white">{coupon.codigo}</TableCell><TableCell className="text-emerald-400 font-medium">{formatCurrency(coupon.desconto_fixo)}</TableCell><TableCell><Badge variant={coupon.ativo ? "default" : "secondary"} className={coupon.ativo ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-none" : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 border-none"}>{coupon.ativo ? "Ativo" : "Inativo"}</Badge></TableCell><TableCell className="text-right space-x-2"><Button variant="outline" size="sm" onClick={() => handleToggleCoupon(coupon.id, coupon.ativo)} className="bg-transparent border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">{coupon.ativo ? "Desativar" : "Ativar"}</Button><Button variant="destructive" size="icon" onClick={() => setCouponToDelete(coupon)} className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-200 border-none"><Trash2 className="w-4 h-4" /></Button></TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.3
        }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white"><FileText className="w-5 h-5 text-orange-400" /><span>Controle de Abertura das Inscrições</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center space-x-3">
                    {statusControl.equipantes ? <Unlock className="text-emerald-500 w-6 h-6" /> : <Lock className="text-red-500 w-6 h-6" />}
                    <div>
                      <p className="font-semibold text-white">Equipantes</p>
                      <p className="text-sm text-gray-400">{statusControl.equipantes ? 'Inscrições abertas' : 'Inscrições fechadas'}</p>
                    </div>
                  </div>
                  <Switch checked={statusControl.equipantes} onCheckedChange={c => handleToggleInscriptionStatus('equipantes', c)} disabled={savingStatus} />
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center space-x-3">
                    {statusControl.acampantes ? <Unlock className="text-emerald-500 w-6 h-6" /> : <Lock className="text-red-500 w-6 h-6" />}
                    <div>
                      <p className="font-semibold text-white">Acampantes</p>
                      <p className="text-sm text-gray-400">{statusControl.acampantes ? 'Inscrições abertas' : 'Inscrições fechadas'}</p>
                    </div>
                  </div>
                  <Switch checked={statusControl.acampantes} onCheckedChange={c => handleToggleInscriptionStatus('acampantes', c)} disabled={savingStatus} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <AlertDialog open={!!couponToDelete} onOpenChange={open => !open && setCouponToDelete(null)}>
        <AlertDialogContent className="bg-gray-900 border border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Cupom</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja deletar o cupom <strong className="text-white">{couponToDelete?.codigo}</strong>? Esta ação não pode ser desfeita e impedirá que ele seja utilizado em novos pagamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCoupon} className="bg-red-600 hover:bg-red-700 text-white border-none">Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>;
};
export default OrganizerConfigPage;