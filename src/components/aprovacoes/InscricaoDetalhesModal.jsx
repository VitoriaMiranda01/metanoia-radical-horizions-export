import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

const getStatusBadge = (status) => {
  if (!status) return <Badge variant="secondary">Pendente</Badge>;
  const variants = {
    pendente: 'secondary',
    aprovado: 'default',
    aprovada: 'default',
    rejeitado: 'destructive',
    rejeitada: 'destructive',
    negado: 'destructive',
    negada: 'destructive'
  };
  const labels = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    aprovada: 'Aprovado',
    rejeitado: 'Negado',
    rejeitada: 'Negado',
    negado: 'Negado',
    negada: 'Negado'
  };
  return <Badge variant={variants[status.toLowerCase()] || 'secondary'}>{labels[status.toLowerCase()] || status}</Badge>;
};

const formatarData = (dataString) => {
  if (!dataString) return '-';
  return new Date(dataString).toLocaleDateString('pt-BR', {
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric'
  });
};

const formatarDataHora = (dataString) => {
  if (!dataString) return '-';
  return new Date(dataString).toLocaleDateString('pt-BR', {
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
  });
};

const InscricaoDetalhesModal = ({ inscricao, onClose, onAprovar, onRejeitar }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="bg-slate-900 border border-white/10 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <h3 className="text-xl font-bold text-white">Detalhes do Equipante</h3>
        <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">×</Button>
      </div>
      
      <div className="space-y-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
          <div><span className="text-white/50 text-sm block">Nome Completo</span><p className="font-medium text-lg">{inscricao.nome}</p></div>
          <div><span className="text-white/50 text-sm block">CPF</span><p className="font-medium">{inscricao.cpf || 'N/A'}</p></div>
          
          <div><span className="text-white/50 text-sm block">Tipo</span><p className="capitalize font-medium text-blue-300">Equipante</p></div>
          <div>
            <span className="text-white/50 text-sm block">Idade</span>
            <p className="font-medium">{inscricao.idade} anos</p>
          </div>
          
          <div><span className="text-white/50 text-sm block">Email</span><p className="font-medium">{inscricao.email || 'N/A'}</p></div>
          <div><span className="text-white/50 text-sm block">Telefone/WhatsApp</span><p className="font-medium">{inscricao.telefone}</p></div>
          
          <div><span className="text-white/50 text-sm block">Cidade/Estado</span><p className="font-medium">{inscricao.cidade}/{inscricao.estado}</p></div>
          <div><span className="text-white/50 text-sm block">Endereço</span><p className="font-medium">{inscricao.endereco}, {inscricao.numero}</p></div>

          <div><span className="text-white/50 text-sm block">Igreja</span><p className="font-medium">{inscricao.igreja}</p></div>
          <div><span className="text-white/50 text-sm block">Pastor</span><p className="font-medium">{inscricao.pastor}</p></div>
        </div>

        {/* Informações Específicas */}
        <div className="bg-white/5 p-4 rounded-lg space-y-3">
           <h4 className="font-semibold text-blue-200 mb-2">Informações da Equipe</h4>
           
           <div><span className="text-white/50 text-sm">Área de Trabalho Principal:</span> <span className="font-medium ml-2">{inscricao.areaTrabalho}</span></div>
           <div><span className="text-white/50 text-sm">Já trabalhou antes:</span> <span className="font-medium ml-2">{inscricao.ja_trabalhou_equipe ? 'Sim' : 'Não'}</span></div>
           
           {inscricao.motivacao && (
             <div><span className="text-white/50 text-sm block mb-1">Detalhes:</span><p className="bg-black/20 p-2 rounded text-sm">{inscricao.motivacao}</p></div>
           )}
           {inscricao.experienciaAnterior && (
             <div><span className="text-white/50 text-sm block mb-1">Histórico:</span><p className="bg-black/20 p-2 rounded text-sm">{inscricao.experienciaAnterior}</p></div>
           )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-white/20">
          <div className="flex items-center gap-2"><span className="text-white/50 text-sm">Status Atual:</span> {getStatusBadge(inscricao.status)}</div>
          <div className="text-right">
            <span className="text-white/50 text-sm block">Data da Inscrição</span>
            <p className="font-medium">{formatarDataHora(inscricao.dataInscricao)}</p>
          </div>
        </div>

        {inscricao.status === 'pendente' && (
          <div className="flex space-x-4 pt-4 border-t border-white/20">
            <Button onClick={() => { onAprovar(inscricao.id); onClose(); }} className="flex-1 bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />Aprovar
            </Button>
            <Button onClick={() => { onRejeitar(inscricao.id); onClose(); }} variant="destructive" className="flex-1">
              <XCircle className="w-4 h-4 mr-2" />Rejeitar
            </Button>
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

export default InscricaoDetalhesModal;