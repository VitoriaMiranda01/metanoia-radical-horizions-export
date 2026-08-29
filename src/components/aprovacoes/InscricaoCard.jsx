import React from 'react';
import { Eye, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const InscricaoCard = ({ 
  inscricao, 
  statusBadge, 
  onSelect, 
  onAprovar, 
  onRejeitar, 
  showActions 
}) => {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col gap-4 relative overflow-hidden transition-all hover:bg-white/10">
      {/* Header: Name and Status */}
      <div className="flex justify-between items-start gap-3">
        <h3 className="font-semibold text-white text-lg leading-tight break-words">
          {inscricao.nome}
        </h3>
        <div className="shrink-0 mt-0.5">
          {statusBadge}
        </div>
      </div>

      {/* Key Information */}
      <div className="flex flex-col gap-2 text-sm text-gray-400">
        {inscricao.email && (
          <div className="flex justify-between items-center gap-2">
            <span className="font-medium text-gray-500 shrink-0">Email:</span>
            <span className="text-gray-300 truncate text-right">{inscricao.email}</span>
          </div>
        )}
        <div className="flex justify-between items-center gap-2">
          <span className="font-medium text-gray-500 shrink-0">Telefone:</span>
          <span className="text-gray-300 text-right">{inscricao.telefone || inscricao.whatsapp || 'Não informado'}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="font-medium text-gray-500 shrink-0">Cidade:</span>
          <span className="text-gray-300 text-right truncate">{inscricao.cidade || 'Não informada'}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="font-medium text-gray-500 shrink-0">Igreja:</span>
          <span className="text-gray-300 text-right truncate">{inscricao.igreja || inscricao.nome_igreja || 'Não informada'}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-white/10 flex gap-2 mt-auto">
        <Button 
          variant="outline" 
          onClick={() => onSelect(inscricao)} 
          className="flex-1 h-11 bg-transparent border-white/10 text-blue-300 hover:text-white hover:bg-blue-500/20 transition-colors"
        >
          <Eye className="w-4 h-4 mr-2" /> 
          Detalhes
        </Button>
        
        {showActions && (
          <>
            <Button 
              onClick={() => onAprovar(inscricao.id)} 
              className="h-11 px-4 bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/30 transition-colors"
              aria-label="Aprovar"
            >
              <CheckCircle className="w-5 h-5" />
            </Button>
            <Button 
              onClick={() => onRejeitar(inscricao.id)} 
              className="h-11 px-4 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 transition-colors"
              aria-label="Rejeitar"
            >
              <XCircle className="w-5 h-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default InscricaoCard;