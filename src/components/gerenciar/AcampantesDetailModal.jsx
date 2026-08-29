import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Ruler, HeartPulse, Activity } from 'lucide-react';

const AcampantesDetailModal = ({ isOpen, onClose, title, acampantes = [] }) => {
  // Normalize title to check which card is being viewed
  const normalizedTitle = title ? title.toUpperCase().trim() : '';
  const isProblemasSaudeCard = normalizedTitle === 'PROBLEMAS DE SAÚDE' || normalizedTitle.includes('SAÚDE');
  const isMedicamentosCard = normalizedTitle === 'USO DE MEDICAMENTOS' || normalizedTitle.includes('MEDICAMENTO');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {title}
            <span className="text-sm font-normal text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
              {acampantes.length}
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Lista detalhada dos acampantes nesta categoria
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {acampantes.length > 0 ? (
                acampantes.map((acampante, idx) => {
                  // Determine if we should show health section for this specific camper based on the card type
                  const hasProblemaData = acampante.tem_problema_saude || acampante.tem_restricao_alimentar || acampante.esta_gravida;
                  const hasMedicamentoData = acampante.usa_medicamento;
                  
                  const showHealthSection = 
                    (isProblemasSaudeCard && hasProblemaData) || 
                    (isMedicamentosCard && hasMedicamentoData);

                  return (
                    <div 
                      key={acampante.id || idx} 
                      className="flex flex-col p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 rounded-full bg-blue-500/20 text-blue-400 shrink-0 mt-1">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-white font-medium truncate text-lg">{acampante.nome}</span>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-1">
                              {acampante.cpf && (
                                <span className="opacity-75">CPF: {acampante.cpf}</span>
                              )}
                              {acampante.whatsapp && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {acampante.whatsapp}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {acampante.tamanho_camiseta && (
                          <div className="flex items-center gap-1 text-xs font-mono bg-white/10 px-2 py-1 rounded text-purple-300 whitespace-nowrap shrink-0">
                            <Ruler className="w-3 h-3" />
                            {acampante.tamanho_camiseta}
                          </div>
                        )}
                      </div>

                      {/* Conditionally rendered Health Information Section */}
                      {showHealthSection && (
                        <div className="bg-red-950/20 border border-red-900/50 rounded-md p-3 mt-1 text-sm">
                          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2 border-b border-red-900/50 pb-2">
                            <Activity className="w-4 h-4" />
                            {isMedicamentosCard ? 'Informações de Saúde' : 'Informações de Saúde'}
                          </div>
                          <div className="space-y-2 mt-2">
                            
                            {/* Dados exclusivos do card PROBLEMAS DE SAÚDE */}
                            {isProblemasSaudeCard && (
                              <>
                                {acampante.tem_problema_saude && (
                                  <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] gap-2 items-start">
                                    <span className="text-gray-400">Condições médicas:</span>
                                    <span className="text-red-200">{acampante.condicoes_medicas || 'Não especificado'}</span>
                                  </div>
                                )}
                                {acampante.tem_restricao_alimentar && (
                                  <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] gap-2 items-start">
                                    <span className="text-gray-400">Restrições alimentares:</span>
                                    <span className="text-yellow-200">{acampante.restricoes_alimentares || 'Não especificado'}</span>
                                  </div>
                                )}
                                {acampante.esta_gravida && (
                                  <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] gap-2 items-start">
                                    <span className="text-gray-400">Gestante:</span>
                                    <span className="text-purple-300 font-medium">Sim</span>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Dados exclusivos do card USO DE MEDICAMENTOS */}
                            {isMedicamentosCard && acampante.usa_medicamento && (
                              <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] gap-2 items-start">
                                <span className="text-gray-400">Medicamentos:</span>
                                <span className="text-orange-200">{acampante.medicamentos || 'Não especificado'}</span>
                              </div>
                            )}

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Nenhum acampante encontrado nesta categoria.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AcampantesDetailModal;