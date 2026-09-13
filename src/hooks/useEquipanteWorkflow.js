import { useState, useEffect, useCallback } from 'react';
import {
  getEquipanteWorkflow,
  uploadParentalAuthFile,
  updateWorkflowStage,
  declararAutorizacaoEntregue
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

  // "Já entregue" / desfazer. Mesma forma do uploadFile: a tela nao decide
  // nada, so avisa o servidor e recarrega a situacao que ele devolver.
  const declararEntrega = async (entregue = true) => {
    try {
      setIsLoading(true);
      const updated = await declararAutorizacaoEntregue(equipante_id, entregue, dono);
      setWorkflowData(updated);
      toast({
        title: entregue ? 'Anotado' : 'Desfeito',
        description: entregue
          ? 'Registramos que você entregou a autorização em mãos.'
          : 'A entrega da autorização foi desmarcada.'
      });
      return updated;
    } catch (err) {
      setError(err.message);
      toast({ title: 'Não deu certo', description: err.message, variant: 'destructive' });
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
      // Concluida por qualquer um dos dois caminhos: arquivo anexado ou
      // carta entregue em maos. O rotulo conta em que pe esta a conferencia
      // da igreja -- que acontece DEPOIS e nao trava o pagamento.
      stages.push({
        id: 'parental_auth',
        label: workflowData.autorizacao_conferida
          ? 'Autorização dos pais (conferida pela igreja)'
          : workflowData.autorizacao_entregue_maos
            ? 'Autorização dos pais (entregue em mãos)'
            : 'Autorização dos pais',
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

    // So conta como concluida DEPOIS que o organizador lanca a escala --
    // ter area nao basta, porque quem anuncia a escala e a reuniao.
    stages.push({
      id: 'scale',
      label: 'Escala de trabalho',
      status: workflowData.nao_sera_escalado
        ? 'rejeitado'
        : workflowData.escalado ? 'ok' : 'pendente',
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
    naoSeraEscalado: !!workflowData?.nao_sera_escalado,
    escalaLancada: !!workflowData?.escala_lancada,
    pago: !!workflowData?.pago,
    aprovacao: workflowData?.aprovacao ?? null,
    workflowStages: getWorkflowStages(),
    entregueEmMaos: !!workflowData?.autorizacao_entregue_maos,
    autorizacaoConferida: !!workflowData?.autorizacao_conferida,
    conferidaPor: workflowData?.autorizacao_conferida_por ?? null,
    declararEntrega,
    isLoading,
    error,
    updateStage,
    uploadFile,
    refresh: fetchWorkflow
  };
};