import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Ruler } from 'lucide-react';

const AcampantesDetailModal = ({ isOpen, onClose, title, acampantes = [] }) => {
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
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {acampantes.length > 0 ? (
                acampantes.map((acampante, idx) => (
                  <div 
                    key={acampante.id || idx} 
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 rounded-full bg-blue-500/20 text-blue-400 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-white font-medium truncate">{acampante.nome}</span>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
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
                      <div className="flex items-center gap-1 text-xs font-mono bg-white/10 px-2 py-1 rounded text-purple-300 whitespace-nowrap">
                        <Ruler className="w-3 h-3" />
                        {acampante.tamanho_camiseta}
                      </div>
                    )}
                  </div>
                ))
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