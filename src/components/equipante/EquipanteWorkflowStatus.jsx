import React from 'react';
import { motion } from 'framer-motion';
import { useEquipanteWorkflow } from '@/hooks/useEquipanteWorkflow';
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ParentalAuthUpload from './ParentalAuthUpload';
import { Button } from '@/components/ui/button';

const EquipanteWorkflowStatus = ({ equipanteId, age, onProceedToPayment }) => {
  const {
    age: resolvedAge,
    isMinor,
    workflowStages,
    isLoading,
    uploadFile,
    workflowData
  } = useEquipanteWorkflow(equipanteId, age);

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
      case 'pendente': default:
        return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">Pendente</Badge>;
    }
  };

  const hasUploadedAuth = workflowData?.parental_auth_file_url;
  
  // Verify if all stages prior to payment have status 'ok' or 'concluído'
  const canProceedToPayment = workflowStages
    .filter(stage => stage.id !== 'payment')
    .every(stage => stage.status === 'ok' || stage.status === 'concluído');

  return (
    <div className="space-y-6">
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Acompanhamento da Inscrição</h2>
        <p className="text-gray-400 mb-6">
          Acompanhe as etapas necessárias para finalizar sua participação como Equipante.
          {isMinor && " (Requer Autorização dos Pais/Responsáveis)"}
        </p>

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

        <div className="mt-8 pt-6 border-t border-white/10">
          <Button
            onClick={onProceedToPayment}
            disabled={!canProceedToPayment}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg disabled:opacity-50"
          >
            Ir para Pagamento <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          {!canProceedToPayment && (
            <p className="text-xs text-center text-gray-500 mt-2">
              Você precisa completar as pendências obrigatórias acima antes de prosseguir para o pagamento.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquipanteWorkflowStatus;