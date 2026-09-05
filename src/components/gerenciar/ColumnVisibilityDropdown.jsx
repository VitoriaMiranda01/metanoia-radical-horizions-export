import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersHorizontal, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  COLUMN_DEFINITIONS, 
  LOCKED_COLUMNS,
  selectAllColumns, 
  clearAllColumns, 
  toggleColumn 
} from '@/utils/columnVisibility';

const ColumnVisibilityDropdown = ({ 
  type, 
  currentColumns, 
  onApply 
}) => {
  const definitions = COLUMN_DEFINITIONS[type] || [];
  
  // Group definitions
  const groupedDefinitions = definitions.reduce((acc, def) => {
    if (!acc[def.group]) acc[def.group] = [];
    acc[def.group].push(def);
    return acc;
  }, {});

  const handleToggle = (key) => {
    const newColumns = toggleColumn(currentColumns, key);
    onApply(newColumns);
  };

  const handleSelectAll = () => {
    onApply(selectAllColumns(type));
  };

  const handleClearAll = () => {
    onApply(clearAllColumns());
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-white/5 text-white hover:bg-white/10 hover:text-white border-white/20"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0 bg-neutral-900 border-white/20 text-white shadow-xl">
         <div className="p-3 border-b border-white/10 flex justify-between items-center bg-neutral-900/50">
            <span className="text-sm font-medium text-gray-200">Visualizar Colunas</span>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={handleSelectAll} 
                className="h-6 text-[10px] text-gray-400 hover:text-white px-2 hover:bg-white/10"
              >
                Todos
              </Button>
              <Button 
                variant="ghost" 
                size="xs" 
                onClick={handleClearAll} 
                className="h-6 text-[10px] text-gray-400 hover:text-white px-2 hover:bg-white/10"
              >
                Limpar
              </Button>
            </div>
         </div>
         <ScrollArea className="h-[300px]">
           <div className="p-3 space-y-4">
             {Object.entries(groupedDefinitions).map(([group, items]) => (
               <div key={group} className="space-y-2">
                 <h4 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider pl-1 border-b border-white/5 pb-1 mb-2">
                   {group}
                 </h4>
                 <div className="space-y-0.5">
                   {items.map((col) => {
                     const isLocked = LOCKED_COLUMNS.includes(col.key);
                     return (
                       <div 
                         key={col.key} 
                         className={cn(
                           "flex items-center space-x-3 rounded-md p-2 transition-colors group",
                           isLocked ? "cursor-default" : "hover:bg-neutral-800 cursor-pointer"
                         )}
                         onClick={() => !isLocked && handleToggle(col.key)}
                       >
                         <Checkbox 
                           id={`col-${col.key}`} 
                           checked={currentColumns.includes(col.key)}
                           onCheckedChange={() => !isLocked && handleToggle(col.key)}
                           disabled={isLocked}
                           className="border-white/30 data-[state=checked]:bg-gray-200 data-[state=checked]:text-slate-900 data-[state=checked]:border-gray-200 h-4 w-4 disabled:opacity-100 disabled:cursor-default"
                         />
                         <Label 
                           htmlFor={`col-${col.key}`}
                           className={cn(
                             "text-sm font-normal select-none flex-1 flex items-center gap-1.5",
                             isLocked ? "text-gray-400 cursor-default" : "text-gray-300 group-hover:text-white cursor-pointer"
                           )}
                         >
                           {col.label}
                           {isLocked && <Lock className="w-3 h-3 text-gray-500" aria-label="Coluna obrigatória" />}
                         </Label>
                       </div>
                     );
                   })}
                 </div>
               </div>
             ))}
           </div>
         </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnVisibilityDropdown;