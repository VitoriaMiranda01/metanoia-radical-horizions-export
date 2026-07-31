import React from 'react';
import { useEdition } from '@/contexts/EditionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarRange } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
const EditionSelector = ({
  variant = 'default',
  showLabel = false
}) => {
  const {
    selectedEdition,
    setSelectedEdition,
    availableEditions,
    loading
  } = useEdition();
  const {
    toast
  } = useToast();
  const handleEditionChange = val => {
    setSelectedEdition(val);
    toast({
      title: "Edição Alterada",
      description: `Visualizando dados da Edição ${val}`,
      className: "bg-blue-600 text-white"
    });
  };
  if (loading) {
    return <div className="flex items-center space-x-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {showLabel && <span>Carregando...</span>}
      </div>;
  }
  if (availableEditions.length === 0) {
    return null; // Don't show if no editions exist
  }
  return <div className="flex items-center space-x-2">
      {showLabel && <span className="text-sm font-medium text-gray-300 flex items-center gap-1"><CalendarRange className="w-4 h-4" /></span>}
      <Select value={selectedEdition?.toString()} onValueChange={handleEditionChange}>
        <SelectTrigger className={`h-8 ${variant === 'ghost' ? 'bg-transparent border-white/20 text-white w-[110px]' : 'bg-white/5 border-white/10 text-white w-[130px]'}`}>
          <SelectValue placeholder="Edição" />
        </SelectTrigger>
        <SelectContent className="bg-gray-900 border-gray-800 text-white">
          {availableEditions.map(edition => <SelectItem key={edition} value={edition.toString()} className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
              Edição {edition}
            </SelectItem>)}
        </SelectContent>
      </Select>
    </div>;
};
export default EditionSelector;