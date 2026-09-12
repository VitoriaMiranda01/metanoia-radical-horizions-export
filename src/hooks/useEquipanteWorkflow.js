import { useState, useEffect, useCallback } from 'react';
import {
  getEquipanteWorkflow,
  uploadParentalAuthFile,
  updateWorkflowStage
} from '@/services/equipantesService';
import { useToast } from '@/components/ui/use-toast';

export const useEquipanteWorkflow = (equipante_id, age, dono = {}) => {
  const [workflowData, setWorkflowData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  // Use age directly — from the 'idade' field saved in equipantes
  const resolvedAge = Number(age) || 18;
  // Quem diz se e menor e o servidor (situacao_inscricao), que le a idade
  // gravada. O `age` da tela e so o palpite enquanto nao carregou.
  const isMinor = workflowData ? !!workflowData.menor_de_idade : resolvedAge < 18;

  const fetchWorkflow = useCallback(async () => {
    if (!equipante_id) return;
    try {
      setIsLoading(true);
      const data = await getEquipanteWorkflow(equipante_id, dono);
      setWorkflowData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [equipante_id, dono.cpf, dono.nome]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const uploadFile = async (file) => {
    try {
      setIsLoading(true);
      const updated = await uploadParentalAuthFile(equipante_id, file, dono);
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

  // As etapas sao montadas a partir do que o SERVIDOR respondeu. Se ele nao
  // respondeu, a lista fica vazia -- e por isso quem le `podePagar` tem de
  // usar a flag abaixo, e nunca "todas as etapas estao ok": [].every() e
  // true em JavaScript, e era exatamente assim que o botao de pagamento
  // abria sozinho quando a consulta falhava.
  const getWorkflowStages = () => {
    if (!workflowData) return [];

    const stages = [];

    stages.push({ id: 'inscricao', label: 'Inscrição enviada', status: 'ok' });

    if (workflowData.menor_de_idade) {
      stages.push({
        id: 'parental_auth',
        label: 'Autorização dos pais',
        status: workflowData.autorizacao_pais_enviada ? 'ok' : 'em_processo',
      });
    }

    stages.push({
      id: 'pastoral_auth',
      label: 'Aprovação da sua igreja',
      status: workflowData.aprovacao === 'aprovado'
        ? 'ok'
        : workflowData.aprovacao === 'rejeitado'
          ? 'rejeitado'
          : 'pendente',
    });

    stages.push({
      id: 'scale',
      label: 'Escala de trabalho',
      status: workflowData.escalado ? 'ok' : 'pendente',
    });

    stages.push({
      id: 'payment',
      label: 'Pagamento da taxa de alimentação',
      status: workflowData.pago ? 'ok' : 'pendente',
    });

    return stages;
  };

  return {
    age: resolvedAge,
    isMinor,
    workflowData,
    // Quem autoriza o pagamento e o servidor, nunca a tela. Enquanto nao
    // houver resposta, e false -- falha fechada.
    podePagar: !!workflowData?.pode_pagar,
    escalado: !!workflowData?.escalado,
    pago: !!workflowData?.pago,
    aprovacao: workflowData?.aprovacao ?? null,
    workflowStages: getWorkflowStages(),
    isLoading,
    error,
    updateStage,
    uploadFile,
    refresh: fetchWorkflow
  };
};