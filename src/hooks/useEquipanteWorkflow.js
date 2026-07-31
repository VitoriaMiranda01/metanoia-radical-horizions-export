import { useState, useEffect, useCallback } from 'react';
import {
  initEquipanteWorkflow,
  getEquipanteWorkflow,
  uploadParentalAuthFile,
  updateWorkflowStage
} from '@/lib/api/equipanteApi';
import { useToast } from '@/components/ui/use-toast';

export const useEquipanteWorkflow = (equipante_id, age) => {
  const [workflowData, setWorkflowData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  // Use age directly — from the 'idade' field saved in equipantes
  const resolvedAge = workflowData?.idade ?? Number(age) ?? 18;
  const isMinor = resolvedAge < 18;

  const fetchWorkflow = useCallback(async () => {
    if (!equipante_id) return;
    try {
      setIsLoading(true);
      let data = await getEquipanteWorkflow(equipante_id);

      if (!data?.current_stage) {
        data = await initEquipanteWorkflow(equipante_id, age);
      }
      setWorkflowData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [equipante_id, age]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const uploadFile = async (file) => {
    try {
      setIsLoading(true);
      const updated = await uploadParentalAuthFile(equipante_id, file);
      setWorkflowData(updated);
      toast({ title: 'Sucesso', description: 'Arquivo enviado com sucesso.' });
      return updated;
    } catch (err) {
      setError(err.message);
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateStage = async (updates) => {
    try {
      setIsLoading(true);
      const updated = await updateWorkflowStage(equipante_id, updates);
      setWorkflowData(updated);
      toast({ title: 'Sucesso', description: 'Status atualizado com sucesso.' });
      return updated;
    } catch (err) {
      setError(err.message);
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getWorkflowStages = () => {
    if (!workflowData) return [];

    const stages = [];

    // 1. Inscrição step - always completed
    stages.push({
      id: 'inscricao',
      label: 'Inscrição',
      status: 'ok',
    });

    // 2. Autorização dos Pais step - only for minors
    if (isMinor) {
      stages.push({
        id: 'parental_auth',
        label: 'Autorização dos Pais',
        status: workflowData.parental_auth_file_url ? 'ok' : 'em_processo',
      });
    }

    // 3. Autorização Pastoral
    stages.push({
      id: 'pastoral_auth',
      label: 'Autorização Pastoral',
      status: workflowData.pastoral_auth_status || 'pendente',
    });

    // 4. Escala
    stages.push({
      id: 'scale',
      label: 'Escala de Trabalho',
      status: workflowData.scale_status || 'pendente',
    });

    // 5. Pagamento
    stages.push({
      id: 'payment',
      label: 'Pagamento',
      status: workflowData.status_pagamento === 'pago' || workflowData.status_pagamento === 'confirmado' ? 'ok' : (workflowData.status_pagamento || 'pendente'),
    });

    return stages;
  };

  return {
    age: resolvedAge,
    isMinor,
    currentStage: workflowData?.current_stage,
    workflowData,
    workflowStages: getWorkflowStages(),
    isLoading,
    error,
    updateStage,
    uploadFile,
    refresh: fetchWorkflow
  };
};