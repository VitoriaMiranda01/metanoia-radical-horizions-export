import React from 'react';
import { motion } from 'framer-motion';
import { useEquipanteWorkflow } from '@/hooks/useEquipanteWorkflow';
import { CheckCircle2, Clock, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ParentalAuthUpload from './ParentalAuthUpload';
import { Button } from '@/components/ui/button';

const EquipanteWorkflowStatus = ({ equipanteId, age, dono, onProceedToPayment }) => {
  const {
    isMinor,
    workflowStages,
    isLoading,
    uploadFile,
    workflowData,
    podePagar,
    escalado,
    pago,
    aprovacao
  } = useEquipanteWorkflow(equipanteId, age, dono);

  if (isLoading) {
    return <div className="text-white text-center py-8">Carregando status...</div>;
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': 
      case 'concluído':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'em_processo': 
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'rejeitado':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pendente': default: 
        return <AlertCircle className="w-5 h-5 text-red-500" />;
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

  // O que falta, em uma frase, para a pessoa saber o que esperar.
  const oQueFalta = () => {
    if (pago) return null;
    if (aprovacao === 'rejeitado') return 'Sua inscrição não foi aprovada pela sua igreja. Procure a organização.';
    if (aprovacao !== 'aprovado') return 'Sua igreja ainda precisa aprovar a sua inscrição. Assim que isso acontecer, esta tela avisa.';
    if (isMinor && !hasUploadedAuth) return 'Falta anexar a autorização dos seus responsáveis, aqui embaixo.';
    if (!escalado) return 'Tudo certo até aqui. Agora é aguardar a escala: as áreas são divulgadas na reunião de equipe. Quando você for escalado, o pagamento da taxa de alimentação abre nesta tela.';
    return null;
  };
  const falta = oQueFalta();

  return (
    <div className="space-y-6">
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Acompanhamento da Inscrição</h2>
        <p className="text-gray-400 mb-6">
          Acompanhe as etapas necessárias para finalizar sua participação como Equipante.
          O <strong className="text-gray-200">pagamento da taxa de alimentação é a última etapa</strong>,
          e abre depois que você for escalado em uma área.
        </p>

        {pago && (
          <div className="mb-6 bg-green-500/10 border border-green-500/25 p-4 rounded-lg">
            <p className="text-green-300 text-sm flex items-start">
              <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
              Inscrição concluída. Nos vemos no Radical!
            </p>
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
        </div>

        {isMinor && !hasUploadedAuth && (
          <div className="mt-8">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg mb-4">
              <p className="text-red-400 text-sm flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                Como você tem menos de 18 anos, é obrigatório anexar a autorização dos responsáveis antes de prosseguir para o pagamento.
              </p>
            </div>
            <ParentalAuthUpload
              equipanteId={equipanteId}
              onUploadSuccess={uploadFile}
            />
          </div>
        )}

        {/* O botao so existe quando o servidor libera. Antes ele aparecia
            desabilitado, o que fazia parecer que faltava alguma coisa a
            fazer -- quando na verdade e so aguardar a escala. */}
        {canProceedToPayment && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <Button
              onClick={() => onProceedToPayment?.({ nome: workflowData?.nome })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              Pagar a taxa de alimentação <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipanteWorkflowStatus;