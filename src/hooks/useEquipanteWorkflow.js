import { useState, useEffect, useCallback } from 'react';
import {
  getEquipanteWorkflow,
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

  // silencioso: atualiza sem trocar a tela por "Carregando..." (que
  // desmontava a relacao do lider no meio da chamada).
  // ignorarErro: a conferencia automatica nao troca a tela por erro numa
  // falha passageira de rede -- tenta de novo na proxima.
  const fetchWorkflow = useCallback(async (silencioso = false, ignorarErro = false) => {
    if (!equipante_id) return;
    try {
      if (!silencioso) setIsLoading(true);
      const data = await getEquipanteWorkflow(equipante_id, dono);
      // Sem mudanca, mantem o mesmo objeto: a conferencia automatica (abaixo)
      // nao redesenha a tela a cada poucos segundos.
      setWorkflowData((antes) => (antes && JSON.stringify(antes) === JSON.stringify(data) ? antes : data));
    } catch (err) {
      if (!ignorarErro) setError(err.message);
    } finally {
      if (!silencioso) setIsLoading(false);
    }
  }, [equipante_id, dono.cpf, dono.nome, dono.nascimento]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // Conferencia automatica (24/10/2026, Patrick): o pagamento pode acontecer
  // fora desta tela -- na portaria (dinheiro/Pix/cartao) ou pelo PIX ja pago
  // em outra aba -- e o acompanhamento tem de mostrar a taxa concluida sem a
  // pessoa recarregar. Confere a cada 10 s com a tela visivel e na hora em
  // que ela volta para a tela. Consulta leve (situacao_inscricao, ~5 ms).
  useEffect(() => {
    if (!equipante_id) return undefined;
    const conferir = () => { if (document.visibilityState === 'visible') fetchWorkflow(true, true); };
    const t = setInterval(conferir, 10000);
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', conferir);
      window.removeEventListener('focus', conferir);
    };
  }, [equipante_id, fetchWorkflow]);

  // Estaveis entre desenhos: a relacao do lider recebe refreshSilencioso e,
  // se ele mudasse a cada desenho, todas as linhas da lista redesenhariam.
  const refresh = useCallback(() => fetchWorkflow(false), [fetchWorkflow]);
  const refreshSilencioso = useCallback(() => fetchWorkflow(true), [fetchWorkflow]);

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

    stages.push({
      id: 'pastoral_auth',
      label: 'Aprovação da sua igreja',
      status: workflowData.aprovacao === 'aprovado'
        ? 'ok'
        : workflowData.aprovacao === 'rejeitado'
          ? 'rejeitado'
          : 'pendente',
    });

    if (workflowData.menor_de_idade) {
      // Sem carta (20261105a): o pastor da igreja (ou a organizacao) fala com
      // o responsavel e libera o menor na aprovacao. Sem isso nao paga.
      stages.push({
        id: 'parental_auth',
        label: workflowData.menor_liberado
          ? `Autorização do responsável confirmada${workflowData.menor_liberado_por ? ` por ${workflowData.menor_liberado_por}` : ' pela igreja'}`
          : 'Autorização do responsável (o pastor da sua igreja confirma com ele)',
        status: workflowData.menor_liberado ? 'ok' : 'pendente',
      });
    }

    // So no domingo (20261025c): nao ha escala. Aprovada, a pessoa ja esta em
    // "Vão somente no domingo"; depois e so a taxa (50% do lote).
    if (workflowData.so_domingo) {
      stages.push({
        id: 'area_domingo',
        label: 'Área: Vão somente no domingo',
        status: workflowData.aprovacao === 'aprovado' ? 'ok' : 'pendente',
      });
      stages.push({
        id: 'payment',
        label: !workflowData.pago && workflowData.pagamento_agendado?.agendado_para
          ? `Pagamento da taxa de alimentação (domingo) — agendado para ${String(workflowData.pagamento_agendado.agendado_para).slice(0, 10).split('-').reverse().join('/')}`
          : 'Pagamento da taxa de alimentação (domingo)',
        status: workflowData.pago ? 'ok' : 'pendente',
      });
      return stages;
    }

    // Escala PROVISORIA (05/10 e 15/10/2026): fica "em processo" ate a
    // presenca ser confirmada na reuniao de escala; confirmada, conclui com
    // "presenca confirmada". A escala OFICIAL ganha uma linha propria.
    const provisoriaLabel = workflowData.presenca === 'presente'
      ? 'Escala de trabalho (provisória) — presença confirmada'
      : 'Escala de trabalho (provisória) - Confirme sua presença';
    // Com a oficial lancada a provisoria vira historico: a presenca ja foi
    // usada para montar a oficial e nao e mais pedida (22/10/2026).
    const oficial = workflowData.escala_oficial;
    stages.push({
      id: 'scale',
      label: !workflowData.escalado
        ? 'Escala de trabalho'
        : oficial ? 'Escala de trabalho (provisória)' : provisoriaLabel,
      status: workflowData.nao_sera_escalado
        ? 'rejeitado'
        : workflowData.escalado
          ? (oficial || workflowData.presenca === 'presente' ? 'ok' : 'em_processo')
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
    // e o grupo dela aparecem logo abaixo da lista (AreaOficial).
    // A linha aparece sempre (21/10/2026): pendente ate a oficial sair; concluida
    // para quem esta nela; pendente com aviso para quem ficou fora.
    // Fora da oficial: no "Nao sera escalado" ou sem escala nenhuma depois dela.
    const naOficial = workflowData.escalado && workflowData.escala_oficial;
    const foraDaOficial = workflowData.nao_sera_escalado
      || (workflowData.escala_oficial && !workflowData.escalado);
    stages.push({
      id: 'scale_oficial',
      label: foraDaOficial
        ? 'Você não foi escalado na escala oficial'
        : naOficial ? 'Escala oficial lançada' : 'Escala oficial',
      status: naOficial && !foraDaOficial ? 'ok' : 'pendente',
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
    soDomingo: !!workflowData?.so_domingo,
    escalado: !!workflowData?.escalado,
    naoSeraEscalado: !!workflowData?.nao_sera_escalado,
    escalaLancada: !!workflowData?.escala_lancada,
    escalaOficial: !!workflowData?.escala_oficial,
    // Regra do servidor (_inscricao_concluida) e quando o botao "Confirmar
    // inscricao" aparece (dia seguinte a reuniao de leitura; 20261022b).
    concluidaServidor: workflowData?.concluida,
    confirmacaoVisivel: !!workflowData?.confirmacao_visivel,
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
    menorLiberado: !!workflowData?.menor_liberado,
    menorLiberadoPor: workflowData?.menor_liberado_por ?? null,
    isLoading,
    error,
    updateStage,
    refresh,
    refreshSilencioso
  };
};