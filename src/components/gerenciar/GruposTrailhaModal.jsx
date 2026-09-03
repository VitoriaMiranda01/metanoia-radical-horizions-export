import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getGroupColor, GROUPS } from '@/utils/gruposTrailha';
import { User, MapPin, Phone, Loader2, ArrowRightLeft, Save } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Realocacao manual de grupo de trilha (organizador corrige quem ja esta
// alocado -- ex: juntar amigos/familia no mesmo grupo). Mesmo padrao de UI
// usado pra realocacao de area de trabalho de equipante (CpfsAreaEspecial-
// Manager.jsx / botao "Alocar Áreas Especiais"): seleciona o novo valor e
// confirma com um botao dedicado, sem precisar sair do card.
const AcampanteItem = ({ acampante, onRealocar, onSalvarObservacao }) => {
  const isMale = acampante.sexo?.toLowerCase() === 'masculino';
  const [novoGrupo, setNovoGrupo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Observacao breve do organizador sobre este acampante (coluna
  // acampantes.observacoes_organizador). lastSavedObs guarda o valor que
  // realmente esta salvo no banco, pra habilitar o botao de salvar so
  // quando o texto digitado difere do que ja foi persistido.
  const [observacao, setObservacao] = useState(acampante.observacoes_organizador || '');
  const [lastSavedObs, setLastSavedObs] = useState(acampante.observacoes_organizador || '');
  const [isSavingObs, setIsSavingObs] = useState(false);

  const outrosGrupos = GROUPS.filter(g => g !== acampante.grupo_trailha);

  const handleRealocar = async () => {
    if (!novoGrupo || !onRealocar) return;
    setIsSaving(true);
    try {
      await onRealocar(acampante, novoGrupo);
      setNovoGrupo('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalvarObservacao = async () => {
    if (!onSalvarObservacao || observacao === lastSavedObs) return;
    setIsSavingObs(true);
    try {
      await onSalvarObservacao(acampante, observacao);
      setLastSavedObs(observacao);
    } finally {
      setIsSavingObs(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center justify-between">
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

      {onRealocar && (
        <div className="flex items-center gap-2 pl-11">
          <Select value={novoGrupo} onValueChange={setNovoGrupo} disabled={isSaving}>
            <SelectTrigger className="h-8 bg-white/5 border-white/10 text-white text-xs flex-1">
              <SelectValue placeholder="Novo grupo..." />
            </SelectTrigger>
            <SelectContent>
              {outrosGrupos.map(grupo => (
                <SelectItem key={grupo} value={grupo}>{grupo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRealocar}
            disabled={!novoGrupo || isSaving}
            className="h-8 border-dashed border-white/20 text-black hover:bg-white/10 hover:text-white hover:border-white/40 whitespace-nowrap"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />}
            {!isSaving && 'Realocar'}
          </Button>
        </div>
      )}

      {onSalvarObservacao && (
        <div className="flex items-start gap-2 pl-11">
          <Textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            disabled={isSavingObs}
            rows={2}
            placeholder="Observações sobre este acampante..."
            className="h-auto min-h-0 resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-xs flex-1 py-1.5"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleSalvarObservacao}
            disabled={observacao === lastSavedObs || isSavingObs}
            className="h-8 w-8 shrink-0 border-dashed border-white/20 text-black hover:bg-white/10 hover:text-white hover:border-white/40"
            aria-label="Salvar observação"
          >
            {isSavingObs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
};

const GruposTrailhaModal = ({ isOpen, onClose, groupName, groupData = [], onRealocar, onSalvarObservacao }) => {
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
                  <AcampanteItem key={acampante.id || idx} acampante={acampante} onRealocar={onRealocar} onSalvarObservacao={onSalvarObservacao} />
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