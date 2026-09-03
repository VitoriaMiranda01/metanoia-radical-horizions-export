import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchConfiguracoes, saveConfiguracoes, updatePricingPeriods, updateCpfsAreaEspecial, subscribeToConfiguracoesChanges } from '@/services/organizerConfigService';
import { updateInscricoesStatus } from '@/services/inscricoesStatusService';
import { resetEquipantesInscricoes } from '@/services/equipantesService';
import { verifyDatabaseSchema } from '@/services/databaseVerification';
import { useInscricoesStatus } from '@/hooks/useInscricoesStatus';
import { Settings, Loader2, Calendar, Lock, Unlock, AlertCircle, FileText, DollarSign, CalendarDays, Tag, Plus, Trash2, Clock, Save, RefreshCw, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import PricingPeriodsManager from '@/components/organizer/PricingPeriodsManager';
import CpfsAreaEspecialManager from '@/components/organizer/CpfsAreaEspecialManager';
import { AREAS_ESPECIAIS } from '@/constants/workAreas';
import { Button } from '@/components/ui/button';
import { fetchCoupons, createCoupon, toggleCouponStatus, deleteCoupon } from '@/services/couponsService';

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
  if (!dateStr) return { day: '', month: '', year: '' };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { day: '', month: '', year: '' };
  const [year, monthNum, day] = parts;
  const monthIndex = parseInt(monthNum, 10) - 1;
  return {
    day: parseInt(day, 10).toString(),
    month: MESES[monthIndex] || '',
    year: year
  };
};

const OrganizerConfigPage = () => {
  const { organizadorId, organizadorUser, user, isAuthenticated } = useAuth();
  
  const [config, setConfig] = useState({
    edicao_numero: '',
    max_equipantes: '',
    max_acampantes: '',
    max_acampantes_homens: '',
    max_acampantes_mulheres: '',
    data_edicao_dia_inicio: '',
    data_edicao_dia_fim: '',
    data_edicao_mes: '',
    data_edicao_ano: '',
    horario_saida_igreja: '',
    horario_retorno_sitio: '',
    data_limite_inscricao_pagamento: '',
    equipante_pricing_periods: [],
    acampante_pricing_periods: [],
    cpfs_area_guia: [],
    cpfs_area_inimigo: [],
    cpfs_area_espirito_santo: []
  });
  
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [dbStatus, setDbStatus] = useState({ checked: false, success: true });
  const { equipantesAbertos, acampantesAbertos, loading: loadingStatus, refetch: refetchStatus } = useInscricoesStatus();
  const [statusControl, setStatusControl] = useState({ equipantes: true, acampantes: true });
  const [savingStatus, setSavingStatus] = useState(false);
  const [isResettingInscricoes, setIsResettingInscricoes] = useState(false);
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false);
  const { toast } = useToast();
  
  const [coupons, setCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [newCoupon, setNewCoupon] = useState({ codigo: '', desconto_fixo: '', ativo: true });
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);

  useEffect(() => {
    checkDb();
    loadCoupons();
  }, []);

  useEffect(() => {
    const targetOrganizadorId = organizadorId || organizadorUser?.id || user?.id;
    if (targetOrganizadorId !== undefined || isAuthenticated) {
      loadData(targetOrganizadorId);
    }
  }, [organizadorId, organizadorUser?.id, user?.id, isAuthenticated]);

  useEffect(() => {
    const unsubscribe = subscribeToConfiguracoesChanges('public:configuracoes', () => {
      const targetOrganizadorId = organizadorId || organizadorUser?.id || user?.id;
      if (targetOrganizadorId !== undefined || isAuthenticated) {
        loadData(targetOrganizadorId);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [organizadorId, organizadorUser?.id, user?.id, isAuthenticated]);

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

  const loadData = async (targetId) => {
    setLoadingConfig(true);
    try {
      const data = await fetchConfiguracoes(targetId);
      
      const parsedInicio = parseDateString(data.data_evento_inicio);
      const parsedFim = parseDateString(data.data_evento_fim);
      
      setConfig({
        edicao_numero: data.edicao_numero || '',
        max_equipantes: data.max_equipantes || '',
        max_acampantes: data.max_acampantes || '',
        max_acampantes_homens: data.max_acampantes_homens || '',
        max_acampantes_mulheres: data.max_acampantes_mulheres || '',
        data_edicao_dia_inicio: parsedInicio.day || data.data_edicao_dia_inicio || '',
        data_edicao_dia_fim: parsedFim.day || data.data_edicao_dia_fim || '',
        data_edicao_mes: parsedInicio.month || data.data_edicao_mes || '',
        data_edicao_ano: parsedInicio.year || data.data_edicao_ano || '',
        horario_saida_igreja: data.horario_saida_igreja || '',
        horario_retorno_sitio: data.horario_retorno_sitio || '',
        data_limite_inscricao_pagamento: data.data_limite_inscricao_pagamento || '',
        equipante_pricing_periods: data.equipante_pricing_periods || [],
        acampante_pricing_periods: data.acampante_pricing_periods || [],
        cpfs_area_guia: data.cpfs_area_guia || [],
        cpfs_area_inimigo: data.cpfs_area_inimigo || [],
        cpfs_area_espirito_santo: data.cpfs_area_espirito_santo || []
      });
    } catch (error) {
      console.error("[OrganizerConfigPage] Error loading config data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as configurações. Verifique o banco de dados.",
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

  const handleChange = (field, value) => {
    if (!validateDateField(field, value)) return;
    
    setConfig(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'max_acampantes_homens' || field === 'max_acampantes_mulheres') {
        const homens = field === 'max_acampantes_homens' ? (parseInt(value, 10) || 0) : (parseInt(prev.max_acampantes_homens, 10) || 0);
        const mulheres = field === 'max_acampantes_mulheres' ? (parseInt(value, 10) || 0) : (parseInt(prev.max_acampantes_mulheres, 10) || 0);
        updated.max_acampantes = homens + mulheres;
      }
      
      return updated;
    });
  };

  const handleSavePricingPeriods = async (type, periods) => {
    try {
      await updatePricingPeriods(type, periods);
      setConfig(prev => ({
        ...prev,
        [type === 'equipante' ? 'equipante_pricing_periods' : 'acampante_pricing_periods']: periods
      }));
    } catch (error) {
      console.error("Failed to save pricing periods directly", error);
      throw error;
    }
  };

  const handleSaveCpfsAreaEspecial = async (areaKey, cpfs) => {
    await updateCpfsAreaEspecial(areaKey, cpfs);
    setConfig(prev => ({
      ...prev,
      [`cpfs_area_${areaKey}`]: cpfs
    }));
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      const dateInicioStr = buildDateString(config.data_edicao_dia_inicio, config.data_edicao_mes, config.data_edicao_ano);
      const dateFimStr = buildDateString(config.data_edicao_dia_fim, config.data_edicao_mes, config.data_edicao_ano);
      
      // Deliberately extracting out pricing periods and the special-area CPF
      // lists so they aren't included in the global save -- both are saved
      // independently (updatePricingPeriods / updateCpfsAreaEspecial).
      const { equipante_pricing_periods, acampante_pricing_periods, cpfs_area_guia, cpfs_area_inimigo, cpfs_area_espirito_santo, ...otherConfigs } = config;
      
      const payloadToSave = {
        ...otherConfigs,
        data_evento_inicio: dateInicioStr,
        data_evento_fim: dateFimStr,
        organizadorId: organizadorId || organizadorUser?.id || user?.id
      };
      
      await saveConfiguracoes(payloadToSave);
      
      const targetId = organizadorId || organizadorUser?.id || user?.id;
      await loadData(targetId);

      toast({
        title: "Sucesso!",
        description: `Configurações gerais salvas com sucesso.`,
        className: "bg-emerald-600 text-white border-none"
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao processar as configurações. Verifique os dados e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleToggleInscriptionStatus = async (type, checked) => {
    setSavingStatus(true);
    const newStatusControl = { ...statusControl, [type]: checked };
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
      setStatusControl({ equipantes: equipantesAbertos, acampantes: acampantesAbertos });
    } finally {
      setSavingStatus(false);
    }
  };

  const loadCoupons = async () => {
    try {
      setLoadingCoupons(true);
      const { data, error } = await fetchCoupons();
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
      const { error } = await createCoupon({
        codigo: newCoupon.codigo.trim().toUpperCase(),
        desconto_fixo: desconto,
        ativo: newCoupon.ativo
      });
      if (error) throw error;
      toast({
        title: "Sucesso!",
        description: "Cupom criado com sucesso.",
        className: "bg-emerald-600 text-white"
      });
      setNewCoupon({ codigo: '', desconto_fixo: '', ativo: true });
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
      const { error } = await toggleCouponStatus(id, !currentStatus);
      if (error) throw error;
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, ativo: !currentStatus } : c));
      toast({ title: "Status atualizado", description: "O status do cupom foi alterado." });
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
      const { error } = await deleteCoupon(couponToDelete.id);
      if (error) throw error;
      setCoupons(prev => prev.filter(c => c.id !== couponToDelete.id));
      toast({ title: "Cupom deletado", description: "O cupom foi removido com sucesso." });
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

  const handleResetInscricoes = async () => {
    setIsResettingInscricoes(true);
    try {
      const result = await resetEquipantesInscricoes();
      toast({
        title: "Sucesso!",
        description: `Status de inscrição resetado com sucesso para ${result.count} equipante(s).`,
        className: "bg-emerald-600 text-white border-none"
      });
      setShowResetConfirmDialog(false);
    } catch (error) {
      toast({
        title: "Erro ao resetar",
        description: error.message || "Ocorreu um erro desconhecido ao tentar resetar as inscrições.",
        variant: "destructive"
      });
    } finally {
      setIsResettingInscricoes(false);
    }
  };

  const formatCurrency = value => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loadingConfig) {
    return (
      <Layout>
        <Helmet><title>Configurações do Organizador</title></Helmet>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-400 font-medium">Carregando configurações...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet><title>Configurações do Organizador</title></Helmet>
      <div className="space-y-8 pb-20 max-w-7xl mx-auto py-12 px-4">
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-3xl font-bold text-white">Configurações</h1>
              <p className="text-white text-sm mt-1">Gerencie as configurações do projeto</p>
            </div>
          </div>
        </motion.div>

        {dbStatus.checked && !dbStatus.success && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="text-white font-semibold">Problemas no banco de dados</h3>
              <p className="text-white text-sm">{dbStatus.errors?.join(', ')}</p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span>Geral</span>
                </CardTitle>
                <CardDescription className="text-gray-400">Defina os parâmetros principais do retiro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Parâmetros Iniciais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2 flex flex-col h-full justify-end">
                      <Label htmlFor="edicao_numero" className="text-gray-300">Número da Edição</Label>
                      <Input 
                        id="edicao_numero" 
                        type="number" 
                        min="1" 
                        value={config.edicao_numero} 
                        onChange={e => handleChange('edicao_numero', e.target.value)} 
                        disabled={loadingConfig} 
                        className="bg-white/5 border-white/10 text-white focus-visible:ring-blue-500 transition-all duration-300 h-10" 
                        placeholder="Ex: 35"
                      />
                    </div>
                    <div className="space-y-2 flex flex-col h-full justify-end">
                      <Label htmlFor="max_equipantes" className="text-gray-300">Quantidade Equipantes</Label>
                      <Input 
                        id="max_equipantes" 
                        type="number" 
                        min="0" 
                        value={config.max_equipantes} 
                        onChange={e => handleChange('max_equipantes', e.target.value)} 
                        disabled={loadingConfig} 
                        className="bg-white/5 border-white/10 text-white focus-visible:ring-blue-500 transition-all duration-300 h-10" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-lg font-medium text-white">Quantidade de Acampantes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="max_acampantes_homens" className="text-gray-300">Homens</Label>
                      <Input id="max_acampantes_homens" type="number" min="0" value={config.max_acampantes_homens} onChange={e => handleChange('max_acampantes_homens', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_acampantes_mulheres" className="text-gray-300">Mulheres</Label>
                      <Input id="max_acampantes_mulheres" type="number" min="0" value={config.max_acampantes_mulheres} onChange={e => handleChange('max_acampantes_mulheres', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_acampantes" className="text-gray-300">Total</Label>
                      <Input id="max_acampantes" type="number" value={config.max_acampantes} readOnly disabled className="bg-white/5 border-white/10 text-gray-400 cursor-not-allowed font-semibold" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                    <CalendarDays className="w-5 h-5 text-blue-400" /><span>Data do Evento</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="data_edicao_dia_inicio" className="text-gray-300">Dia Início</Label>
                      <Input id="data_edicao_dia_inicio" type="number" min="1" max="31" value={config.data_edicao_dia_inicio} onChange={e => handleChange('data_edicao_dia_inicio', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" placeholder="Ex: 16" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_edicao_dia_fim" className="text-gray-300">Dia Fim</Label>
                      <Input id="data_edicao_dia_fim" type="number" min="1" max="31" value={config.data_edicao_dia_fim} onChange={e => handleChange('data_edicao_dia_fim', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" placeholder="Ex: 17" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Mês</Label>
                      <Select value={config.data_edicao_mes} onValueChange={val => handleChange('data_edicao_mes', val)} disabled={loadingConfig}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[300px]">
                          {MESES.map(m => <SelectItem key={m} value={m} className="hover:bg-gray-700 focus:bg-gray-700">{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_edicao_ano" className="text-gray-300">Ano</Label>
                      <Input id="data_edicao_ano" type="number" min="2020" max="2099" value={config.data_edicao_ano} onChange={e => handleChange('data_edicao_ano', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white" placeholder="Ex: 2026" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span>Prazos e Horários</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="horario_saida_igreja" className="text-gray-300">Horário Saída Igreja</Label>
                      <Input id="horario_saida_igreja" type="time" value={config.horario_saida_igreja || ''} onChange={e => handleChange('horario_saida_igreja', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white css-invert-time-icon" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horario_retorno_sitio" className="text-gray-300">Horário Retorno Sítio</Label>
                      <Input id="horario_retorno_sitio" type="time" value={config.horario_retorno_sitio || ''} onChange={e => handleChange('horario_retorno_sitio', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white css-invert-time-icon" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_limite_inscricao_pagamento" className="text-gray-300">Data Limite Inscrição/Pagamento</Label>
                      <Input id="data_limite_inscricao_pagamento" type="date" value={config.data_limite_inscricao_pagamento || ''} onChange={e => handleChange('data_limite_inscricao_pagamento', e.target.value)} disabled={loadingConfig} className="bg-white/5 border-white/10 text-white css-invert-time-icon" />
                    </div>
                  </div>
                </div>

              </CardContent>
              <CardFooter className="bg-black/20 border-t border-white/10 pt-6">
                <Button onClick={handleSaveAll} disabled={loadingConfig || isSavingAll} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 ml-auto">
                  {isSavingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Configurações Gerais
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Taxa de Inscrição</span>
                </CardTitle>
                <CardDescription className="text-gray-400">Gerencie os períodos e valores de inscrição.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-10">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Equipantes</h3>
                  <PricingPeriodsManager 
                    type="equipante" 
                    periods={config.equipante_pricing_periods} 
                    onSave={(periods) => handleSavePricingPeriods('equipante', periods)} 
                  />
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Acampantes</h3>
                  <PricingPeriodsManager 
                    type="acampante" 
                    periods={config.acampante_pricing_periods} 
                    onSave={(periods) => handleSavePricingPeriods('acampante', periods)} 
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span>Áreas de Trabalho Especiais</span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Gerencie os equipantes que farão parte de cada área de trabalho especial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {AREAS_ESPECIAIS.map(area => (
                  <div key={area.key} className="space-y-4">
                    <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">{area.label}</h3>
                    <CpfsAreaEspecialManager
                      areaLabel={area.label}
                      cpfs={config[`cpfs_area_${area.key}`] || []}
                      onSave={(cpfs) => handleSaveCpfsAreaEspecial(area.key, cpfs)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Tag className="w-5 h-5 text-purple-400" />
                  <span>Cupons de Desconto</span>
                </CardTitle>
                <CardDescription className="text-gray-400">Gerencie os cupons promocionais para pagamentos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 bg-white/5 border border-white/10 p-6 rounded-xl space-y-6 self-start">
                    <h3 className="text-lg font-medium text-white">Criar Novo Cupom</h3>
                    <form onSubmit={handleCreateCoupon} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="codigo" className="text-gray-300">Código do Cupom</Label>
                        <Input id="codigo" placeholder="EX: LOTE1PROMO" value={newCoupon.codigo} onChange={e => setNewCoupon({ ...newCoupon, codigo: e.target.value.toUpperCase() })} className="bg-white/5 border-white/10 text-white uppercase placeholder:text-gray-600" disabled={isCreatingCoupon} maxLength={20} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="desconto_fixo" className="text-gray-300">Valor do Desconto (R$)</Label>
                        <Input id="desconto_fixo" type="number" step="0.01" min="0.01" placeholder="50.00" value={newCoupon.desconto_fixo} onChange={e => setNewCoupon({ ...newCoupon, desconto_fixo: e.target.value })} className="bg-white/5 border-white/10 text-white placeholder:text-gray-600" disabled={isCreatingCoupon} />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="space-y-0.5">
                          <Label htmlFor="ativo" className="text-gray-300">Cupom Ativo</Label>
                          <p className="text-xs text-gray-500">Habilita o uso imediato</p>
                        </div>
                        <Switch id="ativo" checked={newCoupon.ativo} onCheckedChange={checked => setNewCoupon({ ...newCoupon, ativo: checked })} disabled={isCreatingCoupon} />
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
                          {loadingCoupons ? (
                            <TableRow className="border-b border-white/5 hover:bg-white/5">
                              <TableCell colSpan={4} className="h-24 text-center">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
                                <span className="text-gray-400 text-sm">Carregando cupons...</span>
                              </TableCell>
                            </TableRow>
                          ) : coupons.length === 0 ? (
                            <TableRow className="border-b border-white/5 hover:bg-white/5">
                              <TableCell colSpan={4} className="h-24 text-center text-gray-400">Nenhum cupom criado ainda.</TableCell>
                            </TableRow>
                          ) : (
                            coupons.map(coupon => (
                              <TableRow key={coupon.id} className="border-b border-white/5 hover:bg-white/5">
                                <TableCell className="font-medium text-white">{coupon.codigo}</TableCell>
                                <TableCell className="text-emerald-400 font-medium">{formatCurrency(coupon.desconto_fixo)}</TableCell>
                                <TableCell>
                                  <Badge variant={coupon.ativo ? "default" : "secondary"} className={coupon.ativo ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-none" : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 border-none"}>
                                    {coupon.ativo ? "Ativo" : "Inativo"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button variant="outline" size="sm" onClick={() => handleToggleCoupon(coupon.id, coupon.ativo)} className="bg-transparent border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
                                    {coupon.ativo ? "Desativar" : "Ativar"}
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => setCouponToDelete(coupon)} className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-200 border-none">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="glass-effect border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <FileText className="w-5 h-5 text-orange-400" />
                  <span>Controle de Abertura das Inscrições</span>
                </CardTitle>
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="glass-effect border-red-500/20 bg-black/40">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>Ações de Risco</span>
                </CardTitle>
                <CardDescription className="text-gray-400">Ações irreversíveis. Use com cuidado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-white font-medium mb-1">Resetar Inscrições de Equipantes</h4>
                    <p className="text-sm text-gray-400">Marca todos os equipantes atuais como "não inscritos". Isso forçará todos a passarem pelo fluxo de inscrição novamente. Esta ação não pode ser desfeita.</p>
                  </div>
                  <Button onClick={() => setShowResetConfirmDialog(true)} variant="destructive" className="bg-red-600 hover:bg-red-700 text-white font-bold whitespace-nowrap">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resetar Inscrições
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <AlertDialog open={!!couponToDelete} onOpenChange={open => !open && setCouponToDelete(null)}>
        <AlertDialogContent className="bg-zinc-900 border border-gray-800 text-white">
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

      <AlertDialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <AlertDialogContent className="bg-gray-900 border border-red-900 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Confirmar Reset de Inscrições
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400 text-base">
              Tem certeza que deseja resetar o status de inscrição de <strong>TODOS</strong> os equipantes?<br /><br />
              Isso definirá o status de inscrição como falso para todos os registros. Esta ação não apaga os dados pessoais, mas exige que eles preencham o formulário de inscrição novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResetInscricoes} disabled={isResettingInscricoes} className="bg-red-600 hover:bg-red-700 text-white border-none">
              {isResettingInscricoes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Sim, Resetar Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default OrganizerConfigPage;