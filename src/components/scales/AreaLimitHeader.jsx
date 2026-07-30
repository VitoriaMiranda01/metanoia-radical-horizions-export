import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Save, AlertCircle, Edit2, X } from 'lucide-react';
import { getOcupacaoArea } from '@/lib/limiteAreasHelpers';
import { cn } from '@/lib/utils';
const AreaLimitHeader = ({
  areaName,
  currentCount,
  currentMulheres = 0,
  currentHomens = 0,
  limitObj,
  onSaveLimit,
  isOrganizer = true
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localLimit, setLocalLimit] = useState(limitObj.limiteMaximo);
  const [localMulheres, setLocalMulheres] = useState(limitObj.limiteMulheres || '');
  const [localHomens, setLocalHomens] = useState(limitObj.limiteHomens || '');
  const [saving, setSaving] = useState(false);
  const {
    toast
  } = useToast();
  useEffect(() => {
    if (!isEditing) {
      setLocalLimit(limitObj.limiteMaximo);
      setLocalMulheres(limitObj.limiteMulheres || '');
      setLocalHomens(limitObj.limiteHomens || '');
    }
  }, [limitObj, isEditing]);
  const occupancy = getOcupacaoArea(currentCount, limitObj.limiteMaximo);
  const isFull = occupancy.isFull;
  const handleSave = async () => {
    const numericLimit = parseInt(localLimit);
    const numMulheres = localMulheres !== '' ? parseInt(localMulheres) : null;
    const numHomens = localHomens !== '' ? parseInt(localHomens) : null;
    if (isNaN(numericLimit) || numericLimit < 1) {
      toast({
        title: "Valor inválido",
        description: "O limite deve ser pelo menos 1.",
        variant: "destructive"
      });
      return;
    }
    if (numMulheres !== null && numHomens !== null && numMulheres + numHomens > numericLimit) {
      toast({
        title: "Valor inválido",
        description: "A soma de homens e mulheres não pode exceder o total.",
        variant: "destructive"
      });
      return;
    }
    setSaving(true);
    try {
      await onSaveLimit(areaName, numericLimit, numMulheres, numHomens);
      setIsEditing(false);
      toast({
        title: "Limite atualizado",
        description: `Novo limite para ${areaName} salvo.`,
        className: "bg-green-600 text-white border-none"
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível atualizar.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => {
    setLocalLimit(limitObj.limiteMaximo);
    setLocalMulheres(limitObj.limiteMulheres || '');
    setLocalHomens(limitObj.limiteHomens || '');
    setIsEditing(false);
  };
  return <div className={cn("p-3 rounded-t-lg transition-colors duration-300", isFull ? "bg-red-900/60 text-red-100" : "bg-gray-800 text-gray-200")}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold text-sm truncate mr-2 flex-1" title={areaName}>
          {areaName}
        </span>
        <div className={cn("text-xs px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1", isFull ? "bg-red-950/50 text-red-200" : "bg-black/30 text-gray-300")}>
          {isFull && <AlertCircle className="w-3 h-3" />}
          <span>{currentCount}/{limitObj.limiteMaximo}</span>
        </div>
      </div>

      <div className="mt-2">
        {isEditing ? <div className="flex flex-col gap-2">
            <div className="flex gap-2 text-xs items-center">
              <span className="w-12">Total:</span>
              <Input type="number" min="1" max="200" value={localLimit} onChange={e => setLocalLimit(e.target.value)} className="h-7 text-xs bg-black/40 text-white w-20" autoFocus />
            </div>
            <div className="flex gap-2 text-xs items-center">
              <span className="w-12">Mulheres:</span>
              <Input type="number" min="0" value={localMulheres} onChange={e => setLocalMulheres(e.target.value)} placeholder="Opcional" className="h-7 text-xs bg-black/40 text-white w-20" />
            </div>
            <div className="flex gap-2 text-xs items-center">
              <span className="w-12">Homens:</span>
              <Input type="number" min="0" value={localHomens} onChange={e => setLocalHomens(e.target.value)} placeholder="Opcional" className="h-7 text-xs bg-black/40 text-white w-20" />
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <Button size="sm" variant="ghost" className="h-7 hover:bg-green-600/20 hover:text-green-400" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 hover:bg-red-600/20 hover:text-red-400" onClick={handleCancel} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            </div>
          </div> : <div className="flex flex-col gap-1 text-xs text-white/60">
            <div className="flex justify-between items-center">
              <span>Capacidade Total: {limitObj.limiteMaximo}</span>
              {isOrganizer && <Button variant="ghost" size="sm" className="h-6 px-2 hover:text-white hover:bg-white/10 ml-auto" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">Alterar</span>
                </Button>}
            </div>
            {limitObj.limiteMulheres !== null && <span className={cn("text-[10px]", currentMulheres > limitObj.limiteMulheres ? "text-red-400" : "")}>
                Limite Mulheres: {currentMulheres}/{limitObj.limiteMulheres}
              </span>}
            {limitObj.limiteHomens !== null && <span className={cn("text-[10px]", currentHomens > limitObj.limiteHomens ? "text-red-400" : "")}>
                Limite Homens: {currentHomens}/{limitObj.limiteHomens}
              </span>}
          </div>}
      </div>
    </div>;
};
export default AreaLimitHeader;