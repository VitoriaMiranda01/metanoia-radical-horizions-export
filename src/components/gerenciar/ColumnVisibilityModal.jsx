import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  COLUMN_DEFINITIONS, 
  selectAllColumns, 
  clearAllColumns, 
  toggleColumn 
} from '@/lib/columnVisibilityHelpers';

const ColumnVisibilityModal = ({ 
  isOpen, 
  onClose, 
  type, 
  currentColumns, 
  onApply 
}) => {
  const [selectedColumns, setSelectedColumns] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedColumns(currentColumns || []);
    }
  }, [isOpen, currentColumns]);

  const handleToggle = (key) => {
    setSelectedColumns(prev => toggleColumn(prev, key));
  };

  const handleSelectAll = () => {
    setSelectedColumns(selectAllColumns(type));
  };

  const handleClearAll = () => {
    setSelectedColumns(clearAllColumns());
  };

  const handleSave = () => {
    onApply(selectedColumns);
    onClose();
  };

  const definitions = COLUMN_DEFINITIONS[type] || [];
  
  // Group definitions by 'group' property
  const groupedDefinitions = definitions.reduce((acc, def) => {
    if (!acc[def.group]) acc[def.group] = [];
    acc[def.group].push(def);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle>Gerenciar Colunas</DialogTitle>
          <DialogDescription className="text-gray-400">
            Selecione quais colunas você deseja visualizar na tabela. O "Nome" é fixo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-end space-x-2 my-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs h-8 text-blue-300 hover:text-blue-200">
            Selecionar Todos
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs h-8 text-red-300 hover:text-red-200">
            Limpar Todos
          </Button>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedDefinitions).map(([group, items]) => (
              <div key={group} className="space-y-3">
                <h4 className="font-medium text-sm text-gray-400 uppercase tracking-wider border-b border-white/10 pb-1">
                  {group}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {items.map((col) => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`col-${col.key}`} 
                        checked={selectedColumns.includes(col.key)}
                        onCheckedChange={() => handleToggle(col.key)}
                        className="border-white/50 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <Label 
                        htmlFor={`col-${col.key}`}
                        className="text-sm font-normal cursor-pointer text-gray-200"
                      >
                        {col.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4 pt-4 border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            Aplicar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnVisibilityModal;