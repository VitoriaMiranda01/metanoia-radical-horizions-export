import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Save, AlertCircle, Edit2, X } from 'lucide-react';
import { getOcupacaoArea } from '@/services/limiteAreasService';
import { cn } from '@/lib/utils';

// Selo com barra de progresso pro limite de mulheres/homens da area --
// substitui as duas linhas empilhadas "Limite Mulheres: X/Y" / "Limite
// Homens: X/Y" que ocupavam mais altura vertical sem mostrar a ocupacao
// de forma visual.
const GenderLimitPill = ({ label, current, max, isOver }) => {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border",
        isOver ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-white/10 bg-white/5 text-gray-300"
      )}
    >
      <span>{label}</span>
      <span className={cn("font-semibold", isOver ? "text-red-300" : "text-gray-100")}>{current}/{max}</span>
      <span className="w-9 h-1 rounded-full bg-white/10 overflow-hidden inline-block">
        <span
          className={cn("block h-full rounded-full", isOver ? "bg-red-400" : "bg-blue-400")}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
};

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
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] text-gray-400">Total</span>
                <Input type="number" min="1" max="200" value={localLimit} onChange={e => setLocalLimit(e.target.value)} className="h-7 text-xs bg-black/40 text-white w-full [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" autoFocus />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] text-gray-400">Mulheres</span>
                <Input type="number" min="0" value={localMulheres} onChange={e => setLocalMulheres(e.target.value)} placeholder="Opcional" className="h-7 text-xs bg-black/40 text-white w-full [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] text-gray-400">Homens</span>
                <Input type="number" min="0" value={localHomens} onChange={e => setLocalHomens(e.target.value)} placeholder="Opcional" className="h-7 text-xs bg-black/40 text-white w-full [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <Button size="sm" variant="ghost" className="h-7 hover:bg-green-600/20 hover:text-green-400" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 hover:bg-red-600/20 hover:text-red-400" onClick={handleCancel} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            </div>
          </div> : <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-white/60">
            {limitObj.limiteMulheres !== null || limitObj.limiteHomens !== null ? (
              <div className="flex items-center gap-2 flex-wrap">
                {limitObj.limiteMulheres !== null && (
                  <GenderLimitPill
                    label="Mulheres"
                    current={currentMulheres}
                    max={limitObj.limiteMulheres}
                    isOver={currentMulheres > limitObj.limiteMulheres}
                  />
                )}
                {limitObj.limiteHomens !== null && (
                  <GenderLimitPill
                    label="Homens"
                    current={currentHomens}
                    max={limitObj.limiteHomens}
                    isOver={currentHomens > limitObj.limiteHomens}
                  />
                )}
              </div>
            ) : (
              // Nenhum limite por genero configurado pra essa area -- deixa
              // isso explicito (em vez de um espaco vazio do lado do
              // "Alterar"), pro organizador nao estranhar achando que
              // sumiu informacao.
              <span className="italic text-gray-500">Sem limite por gênero</span>
            )}
            {isOrganizer && <Button variant="ghost" size="sm" className="h-6 px-2 hover:text-white hover:bg-white/10 shrink-0" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-3 h-3 mr-1" />
                <span className="text-[10px]">Alterar</span>
              </Button>}
          </div>}
      </div>
    </div>;
};
export default AreaLimitHeader;