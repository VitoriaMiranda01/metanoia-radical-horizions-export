import { listaDeResponsaveis } from '@/utils/formatters';
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEquipanteWorkflow } from '@/hooks/useEquipanteWorkflow';
import { CheckCircle2, Clock, AlertCircle, XCircle, ArrowRight, Hand, Undo2, Sparkles, ChevronUp, Eye, CalendarClock, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ParentalAuthUpload from './ParentalAuthUpload';
import { Button } from '@/components/ui/button';
import CorrecaoCadastroDialog from './CorrecaoCadastroDialog';
import RevelarAreaDialog from './RevelarAreaDialog';
import { TEXTO_PRESENCA_APOS_REUNIAO } from '@/constants/textosPresenca';
import RelacaoLider from './RelacaoLider';
import AreaOficial from './AreaOficial';
import GrupoAcompanhamento from './GrupoAcompanhamento';
import { presencaPropriaLider } from '@/services/liderService';
import TagSoDomingo from '@/components/common/TagSoDomingo';

// onSair: "Não sou eu" -- a janela de cadastro não fecha, então precisa ter saída.
// onDonoAtualizado: o que a pessoa acabou de gravar (CPF, nascimento) e que
// passa a servir de prova de dono nas próximas chamadas.
// "dos Invisíveis" / "da Selva"
export const textoLideranca = (area) => (area === 'Invisível' ? 'dos Invisíveis' : `da ${area}`);

const EquipanteWorkflowStatus = ({ equipanteId, age, dono, onProceedToPayment, onVerConfirmacao, onSair, onDonoAtualizado }) => {
  const {
    isMinor,
    workflowStages,
    isLoading,
    uploadFile,
    workflowData,
    podePagar,
    soDomingo,
    escalado,
    naoSeraEscalado,
    pago,
    aprovacao,
    entregueEmMaos,
    autorizacaoConferida,
    conferidaPor,
    declararEntrega,
    pendencias,
    areaVista,
    escalaOficial,
    concluidaServidor,
    confirmacaoVisivel,
    liderDe,
    delegadoDe,
    liderExtraDe,
    presenca,
    reuniaoLeituraPassou,
    reuniaoCom,
    responsaveisReuniao,
    error,
    refresh,
    refreshSilencioso
  } = useEquipanteWorkflow(equipanteId, age, dono);
  // Quem decide e o servidor (_inscricao_concluida, 20261022c): aprovado +
  // pago + estar na escala oficial. Sem a oficial lancada ninguem conclui.
  // A conta local so vale se o servidor for antigo.
  const concluida = concluidaServidor ?? (pago && escalaOficial && escalado && !naoSeraEscalado);
  // Botao "Confirmar inscricao" (22/10/2026): aparece a partir do dia seguinte
  // a reuniao de leitura (ou com a oficial lancada). Enquanto nao conclui, fica
  // cinza dizendo o que falta -- so taxa de alimentacao e escala oficial.
  const pendenciasConfirmacao = soDomingo
    // So no domingo (20261025c): sem escala; aprovada + paga conclui.
    ? [aprovacao !== 'aprovado' ? 'Aprovação da sua igreja' : null, !pago ? 'Taxa de alimentação' : null].filter(Boolean)
    : [
      // Mesmo texto da etapa "Escala oficial" na lista (useEquipanteWorkflow).
      naoSeraEscalado || (escalaOficial && !escalado) ? 'Você não foi escalado na escala oficial'
        : !escalaOficial ? 'Escala oficial' : null,
      !pago ? 'Taxa de alimentação' : null,
    ].filter(Boolean);

  // So o proprio equipante (que provou ser dono) ve a janela de correcao
  // sozinha; o organizador abrindo a ficha pela tela dele, nao.
  const ehOProprio = !!(dono && (dono.cpf || dono.nome));
  const [correcao, setCorrecao] = useState(null);   // null | { antesDeRevelar, pendencias? }
  const [completou, setCompletou] = useState(false);
  const [revelando, setRevelando] = useState(false);
  const [revelouAgora, setRevelouAgora] = useState(false);
  const [verOficial, setVerOficial] = useState(false);
  const [irParaEquipe, setIrParaEquipe] = useState(false);

  // "Ver a lista da minha equipe" na revelacao: fecha e desce ate o quadro
  // "Você é líder" (ele so monta depois que a pessoa viu a area, entao espera
  // aparecer).
  useEffect(() => {
    if (!irParaEquipe) return undefined;
    let tentativas = 0;
    const t = setInterval(() => {
      const alvo = document.getElementById('relacao-lider');
      tentativas += 1;
      if (alvo || tentativas > 20) {
        clearInterval(t);
        setIrParaEquipe(false);
        alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    return () => clearInterval(t);
  }, [irParaEquipe]);

  // Ao entrar no acompanhamento: se ha pendencia, abre a janela de cadastro.
  // Ela NAO fecha enquanto sobrar pendencia (a pessoa completa ou sai) -- e
  // antes de revelar a area ela volta, porque sem corrigir o servidor nao
  // revela.
  useEffect(() => {
    if (ehOProprio && pendencias.length > 0 && !correcao && !completou) {
      setCorrecao({ antesDeRevelar: false });
    }
  }, [ehOProprio, pendencias, correcao, completou]);

  const abrirRevelacao = () => {
    if (ehOProprio && pendencias.length > 0) {
      setCorrecao({ antesDeRevelar: true });
      return;
    }
    setRevelando(true);
  };

  const aoCorrigir = async (sobraram, salvo) => {
    const revelarDepois = correcao?.antesDeRevelar;
    if (salvo && (salvo.cpf || salvo.nascimento || salvo.nome)) onDonoAtualizado?.(salvo);
    if (sobraram.length > 0) {
      // O servidor deixou algo pendente: a janela continua, so com o que falta.
      setCorrecao({ antesDeRevelar: !!revelarDepois, pendencias: sobraram });
      return;
    }
    setCompletou(true);
    setCorrecao(null);
    await refreshSilencioso();
    if (revelarDepois) {
      if (escalaOficial) setVerOficial(true); else setRevelando(true);
    }
  };

  if (isLoading) {
    return <div className="text-white text-center py-8">Carregando status...</div>;
  }

  // Sem resposta do servidor a tela NAO monta o acompanhamento. Antes ela
  // montava: com workflowData nulo, `aprovacao` virava null, e a frase
  // "Sua igreja ainda precisa aprovar" aparecia como se fosse fato. Alguem
  // ja aprovado e liberado para pagar era informado de que estava travado.
  // Chute apresentado como informacao e pior que erro nenhum.
  if (!workflowData) {
    return (
      <div className="bg-black/40 border border-amber-500/30 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold mb-1">
              Não consegui carregar a situação da sua inscrição
            </h3>
            <p className="text-gray-300 text-sm">
              {error || 'Tente de novo em instantes.'} Se continuar assim, procure a organização —
              a sua inscrição não foi perdida.
            </p>
          </div>
        </div>
        <Button onClick={refresh} variant="outline" className="border-white/20 text-white">
          Tentar de novo
        </Button>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': 
      case 'concluído':
        return <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />;
      case 'em_processo': 
        return <Clock className="w-5 h-5 shrink-0 text-blue-500" />;
      case 'rejeitado':
        return <XCircle className="w-5 h-5 shrink-0 text-red-500" />;
      case 'pendente': default: 
        return <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ok':
      case 'concluído':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">Concluído</Badge>;
      case 'em_processo':
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">Em Processo</Badge>;
      case 'rejeitado':
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">Rejeitado</Badge>;
      case 'pendente': default:
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">Pendente</Badge>;
    }
  };

  const hasUploadedAuth = workflowData?.autorizacao_pais_enviada;

  // NAO se calcula mais "todas as etapas estao ok" aqui: com a lista vazia
  // (consulta que falhou), [].every() e true em JavaScript e o botao abria
  // sozinho -- era assim que a pessoa ia parar no pagamento logo depois de
  // se inscrever. Quem autoriza e o servidor, em situacao_inscricao.
  const canProceedToPayment = podePagar;
  // Pagamento combinado com a organizacao: { agendado_para, observacao } ou null.
  const agendado = workflowData?.pagamento_agendado || null;
  const dataCurta = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return d && m ? `${d}/${m}${a ? `/${a}` : ''}` : iso; };

  const viuArea = areaVista || revelouAgora;
  const ehLider = liderDe.length > 0;
  // A relacao (chamada, areas extras) so aparece DEPOIS que a pessoa viu a
  // propria area -- antes disso ela entregaria a surpresa (15/10/2026).
  const conduzEquipe = liderDe.length > 0 || delegadoDe.length > 0 || liderExtraDe.length > 0;
  const mostrarRelacao = ehOProprio && conduzEquipe && (viuArea || !escalado);

  const abrirOficial = () => {
    if (verOficial) { setVerOficial(false); return; }
    if (ehOProprio && pendencias.length > 0) {
      setCorrecao({ antesDeRevelar: true });
      return;
    }
    setVerOficial(true);
  };

  // O que falta, em uma frase, para a pessoa saber o que esperar.
  const oQueFalta = () => {
    // Concluida so com pagamento + presenca confirmada (19/10/2026): quem
    // pagou antes da chamada continua vendo o que falta.
    if (concluida) return null;
    // A Direcao decidiu que esta pessoa nao entra na escala (excesso de
    // gente, por exemplo). So aparece depois do lancamento -- antes disso
    // nada foi anunciado.
    if (naoSeraEscalado) return null;
    if (aprovacao === 'rejeitado') return 'Sua inscrição não foi aprovada pela sua igreja. Procure a organização.';
    if (aprovacao !== 'aprovado') return 'Sua igreja ainda precisa aprovar a sua inscrição. Assim que isso acontecer, esta tela avisa.';
    if (isMinor && !hasUploadedAuth) return 'Falta a autorização dos seus responsáveis: anexe o arquivo aqui embaixo, ou marque que você já entregou a carta na sua igreja.';
    if (soDomingo) return pago ? null : 'Tudo certo! Você vai somente no domingo. Agora falta só a taxa de alimentação (50% do valor do dia), no botão abaixo.';
    // Oficial lancada e a pessoa fora dela: nao ha mais escala para aguardar.
    if (!escalado && escalaOficial) return 'Seu nome não saiu na escala oficial. Procure a coordenação do projeto.';
    if (!escalado) return 'Tudo certo até aqui. Agora é aguardar a escala: as áreas são divulgadas na reunião de equipe. Quando você for escalado, o pagamento da taxa de alimentação abre nesta tela.';
    // Escala PROVISORIA: a area ja aparece e o pagamento ja abre (decisao
    // do Patrick, 05/10/2026); falta a chamada da reuniao de escala.
    if (!escalaOficial) {
      if (presenca === 'ausente') return 'Você ficou como ausente na chamada da reunião de escala. Procure o líder da sua área ou a organização.';
      if (presenca === 'presente') return null;
      if (!viuArea) return 'A escala provisória saiu! Veja a sua área no botão abaixo. Depois, na reunião de escala, confirme sua presença.';
      if (ehLider) return 'Você é líder: confirme a sua própria presença na lista da sua equipe, aqui embaixo (botão "Presente" ao lado do seu nome). A chamada só fica aberta no dia da reunião de leitura da escala; depois disso, peça à organização.';
      // Passado o dia da reuniao a chamada fechou (19/10/2026).
      if (reuniaoLeituraPassou) return TEXTO_PRESENCA_APOS_REUNIAO;
      // Marcadores se reunem com a lideranca dos Invisiveis; Perseguidos, com a
      // da Selva (17/10/2026).
      if (responsaveisReuniao.length > 0) return `Esta é a escala provisória. Confirme sua presença com o(a) ${listaDeResponsaveis(responsaveisReuniao)} na reunião da sua área. Quando marcar, esta etapa fica concluída.`;
      const com = reuniaoCom.find((r) => r.com)?.com;
      if (com) return `Na reunião de leitura de escala, procure a liderança ${textoLideranca(com)} para confirmar a sua presença. Quando marcarem, esta etapa fica concluída.`;
      return 'Confirme sua presença com o líder da sua área na reunião de escala. Quando ele marcar, esta etapa fica concluída.';
    }
    // Oficial lancada: presenca nao conta mais (22/10/2026); quem esta nela so
    // tem o pagamento pela frente, e o botao ja mostra isso.
    return null;
  };
  const falta = oQueFalta();

  return (
    <div className="space-y-6">
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2 flex-wrap">
          Acompanhamento da Inscrição {soDomingo && <TagSoDomingo />}
        </h2>
        {soDomingo ? (
          <p className="text-gray-400 mb-6">
            Sua inscrição é para ir <strong className="text-gray-200">somente no domingo</strong>.
            Depois da aprovação da sua igreja, abre o pagamento da taxa de alimentação (50% do valor do dia).
          </p>
        ) : (
          <p className="text-gray-400 mb-6">
            Acompanhe as etapas necessárias para finalizar sua participação como Equipante.
            O <strong className="text-gray-200">pagamento da taxa de alimentação é a última etapa</strong>,
            e abre depois que você for escalado em uma área.
          </p>
        )}

        {naoSeraEscalado && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
            <p className="text-red-300 text-sm flex items-start">
              <XCircle className="w-5 h-5 mr-2 shrink-0" />
              <span>
                <strong>Seu nome não saiu na escala {escalaOficial ? 'oficial' : 'preliminar'}, procure a coordenação do projeto.</strong>
              </span>
            </p>
          </div>
        )}

        {concluida && (
          <div className="mb-6 bg-green-500/10 border border-green-500/25 p-4 rounded-lg">
            <p className="text-green-300 text-sm flex items-start">
              <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
              Inscrição concluída. Nos vemos no Radical!
            </p>
            {ehOProprio && onVerConfirmacao && confirmacaoVisivel && (
              <Button onClick={onVerConfirmacao} className="mt-4 w-full bg-green-700 hover:bg-green-600 text-white">
                <BadgeCheck className="w-4 h-4 mr-2" /> Ver confirmação da inscrição
              </Button>
            )}
          </div>
        )}

        {/* Mesmo lugar, cinza e desabilitado enquanto falta algo: a pessoa ve
            o que precisa fazer aqui e na lista de etapas. */}
        {!concluida && ehOProprio && onVerConfirmacao && confirmacaoVisivel && (
          <div className="mb-6">
            <Button disabled aria-disabled="true"
              className="w-full h-auto py-3 flex-col gap-1 whitespace-normal bg-zinc-700 text-gray-300 disabled:opacity-100 cursor-not-allowed">
              <span className="flex items-center font-semibold">
                <BadgeCheck className="w-4 h-4 mr-2" /> Confirmar inscrição
              </span>
              <span className="text-xs font-normal text-gray-400">
                Pendente: {pendenciasConfirmacao.length ? pendenciasConfirmacao.join(' · ') : 'procure a organização'}
              </span>
            </Button>
          </div>
        )}

        {falta && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/25 p-4 rounded-lg">
            <p className="text-amber-200 text-sm flex items-start">
              <Clock className="w-5 h-5 mr-2 shrink-0" />
              {falta}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {workflowStages.map((stage, idx) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                  stage.status === 'ok' || stage.status === 'concluído' ? 'border-green-500/30 bg-green-500/5' :
                  stage.status === 'em_processo' ? 'border-blue-500/30 bg-blue-500/5' :
                  stage.status === 'rejeitado' ? 'border-red-500/30 bg-red-500/5' :
                    'border-white/5 bg-white/5'
                }`}
            >
              <div className="flex items-center space-x-4">
                {getStatusIcon(stage.status)}
                <span className="text-white font-medium">{stage.label}</span>
              </div>
              {getStatusBadge(stage.status)}
            </motion.div>
          ))}
          {/* Escala oficial (ultima etapa): a area de trabalho, as extras e o
              grupo, direto abaixo da etapa -- uma vez so (antes a area saia
              aqui e de novo no botao "Ver minha area oficial"). */}
          {escalado && escalaOficial && ehOProprio && (
            // key: depois de corrigir o cadastro, busca a area de novo (com
            // pendencia o servidor nao revela e o quadro ficaria carregando).
            <AreaOficial key={`oficial-${completou}`} equipanteId={equipanteId} dono={dono}
              onVisto={() => setRevelouAgora(true)}
              onPendencias={(lista) => setCorrecao({ antesDeRevelar: false, pendencias: lista })} />
          )}
        </div>

        {isMinor && !hasUploadedAuth && (
          <div className="mt-8">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg mb-4">
              <p className="text-red-400 text-sm flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                Como você tem menos de 18 anos, é obrigatório entregar a autorização dos
                responsáveis antes de prosseguir para o pagamento. Escolha um dos dois
                caminhos abaixo.
              </p>
            </div>

            {/* Caminho 2: a carta em papel, entregue na igreja. A maioria faz
                assim -- entrega o papel assinado ao lider e nao tem como
                anexar arquivo nenhum. Marcar aqui conclui a etapa na hora; a
                igreja confere depois. */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    Já entreguei a carta na minha igreja
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Se você entregou o papel assinado em mãos, marque aqui — não
                    precisa anexar nada. Sua igreja confere depois.
                  </p>
                </div>
                <Button
                  onClick={() => declararEntrega(true)}
                  disabled={isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Hand className="w-4 h-4 mr-2" /> Já entregue
                </Button>
              </div>
            </div>

            <ParentalAuthUpload
              equipanteId={equipanteId}
              onUploadSuccess={uploadFile}
            />
          </div>
        )}

        {/* Etapa concluida pela entrega em maos: mostra em que pe esta a
            conferencia da igreja, e deixa desfazer enquanto ninguem conferiu
            (marcou sem querer, ou vai anexar o arquivo em vez disso). */}
        {isMinor && entregueEmMaos && !autorizacaoConferida && (
          <div className="mt-8">
            <div className={`p-4 rounded-lg border ${autorizacaoConferida
              ? 'bg-green-500/10 border-green-500/25'
              : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-sm flex items-start flex-1 text-gray-200">
                  <CheckCircle2 className={`w-5 h-5 mr-2 shrink-0 ${autorizacaoConferida ? 'text-green-400' : 'text-emerald-400'}`} />
                  <span>
                    {autorizacaoConferida ? (
                      <>
                        <strong className="text-white">Autorização conferida</strong>
                        {conferidaPor ? ` por ${conferidaPor}` : ''}. Não precisa fazer mais nada.
                      </>
                    ) : (
                      <>
                        <strong className="text-white">Autorização entregue em mãos.</strong>{' '}
                        Esta etapa está concluída. Sua igreja ainda vai conferir a carta —
                        se ela não encontrar, esta etapa volta a ficar pendente.
                      </>
                    )}
                  </span>
                </p>
                {!autorizacaoConferida && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => declararEntrega(false)}
                    disabled={isLoading}
                    className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white shrink-0"
                  >
                    <Undo2 className="w-4 h-4 mr-2" /> Não entreguei ainda
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* O botao so existe quando o servidor libera. Antes ele aparecia
            desabilitado, o que fazia parecer que faltava alguma coisa a
            fazer -- quando na verdade e so aguardar a escala. */}
        {/* Revelacao da area: aparece quando a escala foi lancada e a pessoa
            esta nela. O pagamento so abre depois que ela viu a area. */}
        {escalado && !escalaOficial && (
          <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
            {!viuArea && (
              <p className="text-center text-gray-300 text-sm">A escala provisória saiu e você está nela!</p>
            )}
            <Button
              onClick={abrirRevelacao}
              className={`w-full py-6 text-lg ${viuArea
                ? 'bg-transparent border border-white/20 text-gray-200 hover:bg-white/10'
                : 'bg-gradient-to-r from-red-700 to-green-700 hover:from-red-600 hover:to-green-600 text-white shadow-lg shadow-red-900/30'}`}
            >
              <Sparkles className="mr-2 w-5 h-5" />
              {viuArea ? 'Ver minha área de novo' : 'Ver qual área fui escalado'}
            </Button>
            {/* Grupo de WhatsApp (21/10/2026): so depois de ver a area (ela e surpresa)
                e so para quem esta presente. */}
            {viuArea && ehOProprio && (
              <GrupoAcompanhamento equipanteId={equipanteId} dono={dono} modo="provisoria" recarregarCom={`${presenca}-${revelouAgora}`} />
            )}
          </div>
        )}

        {/* Escala OFICIAL (15/10/2026): mostra direto, sem o misterio. Se a
            pessoa mudou de area depois da provisoria, aparece a nova. */}
        {/* So o organizador (abrindo a ficha) ve o botao; o proprio equipante
            ja ve a area direto abaixo da etapa "Escala oficial". */}
        {escalado && escalaOficial && !ehOProprio && (
          <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
            <p className="text-center text-gray-300 text-sm">A escala oficial foi lançada!</p>
            <Button onClick={abrirOficial}
              className="w-full py-6 text-lg bg-gradient-to-r from-red-700 to-green-700 hover:from-red-600 hover:to-green-600 text-white">
              {verOficial ? <ChevronUp className="mr-2 w-5 h-5" /> : <Eye className="mr-2 w-5 h-5" />}
              {verOficial ? 'Esconder minha área oficial' : 'Ver minha área oficial'}
            </Button>
            {verOficial && (
              <AreaOficial equipanteId={equipanteId} dono={dono}
                onVisto={() => setRevelouAgora(true)}
                onPendencias={(lista) => { setVerOficial(false); setCorrecao({ antesDeRevelar: true, pendencias: lista }); }} />
            )}
          </div>
        )}

        {canProceedToPayment && (viuArea || !ehOProprio || soDomingo) && (
          <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
            {/* Pagamento combinado com a organizacao (19/10/2026): a etapa
                continua pendente ate pagar. */}
            {agendado?.agendado_para && (
              <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-4 text-sm text-violet-100 flex items-start gap-2">
                <CalendarClock className="w-5 h-5 shrink-0 text-violet-300" />
                <span>
                  Seu pagamento está <strong>agendado para {dataCurta(agendado.agendado_para)}</strong>.
                  Realize o pagamento até essa data — enquanto não pagar, a etapa continua pendente.
                  {agendado.observacao ? <span className="block mt-1 text-violet-200/80">Combinado: {agendado.observacao}</span> : null}
                </span>
              </div>
            )}
            <Button
              onClick={() => onProceedToPayment?.({ nome: workflowData?.nome })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              Pagar a taxa de alimentação <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Relacao da equipe, para quem esta como lider. So o proprio (que
          provou ser dono) -- o organizador abrindo a ficha nao precisa. */}
      {mostrarRelacao && (
        <RelacaoLider equipanteId={equipanteId} dono={dono} liderDe={liderDe}
          delegadoDe={delegadoDe} liderExtraDe={liderExtraDe}
          onPresencaPropria={refreshSilencioso} />
      )}

      <AnimatePresence>
        {correcao && (
          <CorrecaoCadastroDialog
            key="correcao"
            equipanteId={equipanteId}
            dono={dono}
            pendencias={correcao.pendencias || pendencias}
            antesDeRevelar={correcao.antesDeRevelar}
            onSair={onSair}
            onCorrigido={aoCorrigir}
          />
        )}
        {revelando && (
          <RevelarAreaDialog
            key="revelar"
            equipanteId={equipanteId}
            dono={dono}
            podePagar={canProceedToPayment}
            provisoria={!escalaOficial}
            reuniaoPassou={reuniaoLeituraPassou}
            temEquipe={ehOProprio && conduzEquipe}
            // Lider/responsavel ficam presentes no primeiro clique aqui (21/10/2026).
            onVerEquipe={ehOProprio ? async () => {
              setRevelando(false); setRevelouAgora(true); setIrParaEquipe(true);
              await presencaPropriaLider(equipanteId, dono);
              refreshSilencioso();
            } : undefined}
            onPagar={() => { setRevelando(false); onProceedToPayment?.({ nome: workflowData?.nome }); }}
            // As pendencias que o servidor acabou de devolver valem mais que as
            // da ultima leitura do acompanhamento.
            onPendencias={(lista) => { setRevelando(false); setCorrecao({ antesDeRevelar: true, pendencias: lista }); }}
            // So libera o pagamento se a area chegou a aparecer (fechar no meio
            // da busca ou num erro nao conta como "viu").
            onClose={(viu) => { setRevelando(false); if (viu) setRevelouAgora(true); refreshSilencioso(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EquipanteWorkflowStatus;