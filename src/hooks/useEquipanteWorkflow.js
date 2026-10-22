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

  // silencioso: atualiza sem trocar a tela por "Carregando..." (que
  // desmontava a relacao do lider no meio da chamada).
  const fetchWorkflow = useCallback(async (silencioso = false) => {
    if (!equipante_id) return;
    try {
      if (!silencioso) setIsLoading(true);
      const data = await getEquipanteWorkflow(equipante_id, dono);
      setWorkflowData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silencioso) setIsLoading(false);
    }
  }, [equipante_id, dono.cpf, dono.nome, dono.nascimento]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Estaveis entre desenhos: a relacao do lider recebe refreshSilencioso e,
  // se ele mudasse a cada desenho, todas as linhas da lista redesenhariam.
  const refresh = useCallback(() => fetchWorkflow(false), [fetchWorkflow]);
  const refreshSilencioso = useCallback(() => fetchWorkflow(true), [fetchWorkflow]);

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

    // Escala PROVISORIA (05/10 e 15/10/2026): fica "em processo" ate a
    // presenca ser confirmada na reuniao de escala; confirmada, conclui com
    // "presenca confirmada". A escala OFICIAL ganha uma linha propria.
    const provisoriaLabel = workflowData.presenca === 'presente'
      ? 'Escala de trabalho (provisória) — presença confirmada'
      : 'Escala de trabalho (provisória) - Confirme sua presença';
    stages.push({
      id: 'scale',
      label: workflowData.escalado ? provisoriaLabel : 'Escala de trabalho',
      status: workflowData.nao_sera_escalado
        ? 'rejeitado'
        : workflowData.escalado
          ? (workflowData.presenca === 'presente' ? 'ok' : 'em_processo')
          : 'pendente',
    });

    stages.push({
      id: 'payment',
      // Combinado com a organizacao (19/10/2026): mostra a data e segue pendente.
      label: !workflowData.pago && workflowData.pagamento_agendado?.agendado_para
        ? `Pagamento da taxa de alimentação — agendado para ${String(workflowData.pagamento_agendado.agendado_para).slice(0, 10).split('-').reverse().join('/')}`
        : 'Pagamento da taxa de alimentação',
      status: workflowData.pago ? 'ok' : 'pendente',
    });

    // Escala oficial abaixo da taxa de alimentacao (21/10/2026, Patrick); a area
    // e o grupo dela aparecem logo abaixo da lista (GrupoAcompanhamento).
    // A linha aparece sempre (21/10/2026): pendente ate a oficial sair; concluida
    // para quem esta nela; pendente com aviso para quem ficou fora.
    const naOficial = workflowData.escalado && workflowData.escala_oficial;
    stages.push({
      id: 'scale_oficial',
      label: workflowData.nao_sera_escalado
        ? 'Você não foi escalado na escala oficial'
        : naOficial ? 'Escala oficial lançada' : 'Escala oficial',
      status: naOficial && !workflowData.nao_sera_escalado ? 'ok' : 'pendente',
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
    escalaOficial: !!workflowData?.escala_oficial,
    reuniaoLeituraPassou: !!workflowData?.reuniao_leitura_passou,
    // Areas em que a pessoa e lider (so depois da provisoria) e como ficou
    // a chamada dela na reuniao de escala: 'presente' | 'ausente' | null.
    liderDe: workflowData?.lider_de || [],
    // Responsavel pela reuniao de alguma equipe e lider de area extra.
    delegadoDe: workflowData?.delegado_de || [],
    liderExtraDe: workflowData?.lider_extra_de || [],
    presenca: workflowData?.presenca ?? null,
    // Com que lideranca a pessoa se reune na Leitura de Escala (Marcador ->
    // Invisível, Perseguidos -> Selva). So vem depois que ela viu a area.
    reuniaoCom: workflowData?.reuniao_com || [],
    // Responsavel(is) pela reuniao da equipe, se ja definido(s) (18/10/2026).
    responsaveisReuniao: workflowData?.responsaveis_reuniao || [],
    pago: !!workflowData?.pago,
    // Problemas na ficha que a propria pessoa corrige (igreja que faltou,
    // WhatsApp fora do padrao) e se ela ja viu a area revelada.
    pendencias: workflowData?.pendencias || [],
    areaVista: !!workflowData?.area_vista,
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
    refresh,
    refreshSilencioso
  };
};