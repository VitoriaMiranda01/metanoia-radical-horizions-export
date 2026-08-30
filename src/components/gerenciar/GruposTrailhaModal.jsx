import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getGroupColor } from '@/utils/gruposTrailha';
import { User, MapPin, Phone } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const AcampanteItem = ({ acampante }) => {
  const isMale = acampante.sexo?.toLowerCase() === 'masculino';
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`p-2 rounded-full ${isMale ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>
          <User className="w-4 h-4" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-white font-medium truncate">{acampante.nome}</span>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {acampante.cidade && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {acampante.cidade}
              </span>
            )}
            {acampante.whatsapp && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {acampante.whatsapp}
              </span>
            )}
          </div>
        </div>
      </div>
      <Badge variant="outline" className={`${isMale ? 'border-blue-500/30 text-blue-400' : 'border-pink-500/30 text-pink-400'} whitespace-nowrap`}>
        {isMale ? 'Masculino' : 'Feminino'}
      </Badge>
    </div>
  );
};

const GruposTrailhaModal = ({ isOpen, onClose, groupName, groupData = [] }) => {
  const colors = getGroupColor(groupName);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className={`text-2xl flex items-center gap-3 ${colors.text}`}>
            <span className={`w-3 h-8 rounded-full ${colors.bg.replace('/10', '')} block`}></span>
            Grupo {groupName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Lista de membros alocados ({groupData.length} participantes)
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {groupData.length > 0 ? (
                groupData.map((acampante, idx) => (
                  <AcampanteItem key={acampante.id || idx} acampante={acampante} />
                ))
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Nenhum acampante alocado neste grupo ainda.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GruposTrailhaModal;