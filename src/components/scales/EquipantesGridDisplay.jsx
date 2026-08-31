import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCPF } from '@/utils/formatters';
import { User, Download } from 'lucide-react';

const EquipantesGridDisplay = ({ equipantes = [], areaName, onExport }) => {
  if (!equipantes || equipantes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-white/5 rounded-md border border-white/5 border-dashed">
        <User className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhum equipante alocado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {onExport && (
        <div className="flex justify-end">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onExport(areaName, equipantes)}
            className="h-8 text-xs bg-white/5 border-white/20 text-white hover:bg-white/10"
          >
            <Download className="mr-2 h-3 w-3" />
            Exportar
          </Button>
        </div>
      )}
      
      <div className="rounded-md border border-white/10 overflow-hidden bg-black/20">
        <Table>
          <TableHeader className="bg-white/5 hover:bg-white/5">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-gray-300 w-[45%]">Nome</TableHead>
              <TableHead className="text-gray-300 w-[30%] hidden sm:table-cell">CPF</TableHead>
              <TableHead className="text-gray-300 w-[25%] hidden md:table-cell">Igreja</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipantes.map((eq, index) => (
              <TableRow 
                key={eq.id || index} 
                className="border-white/10 hover:bg-white/5 transition-colors"
              >
                <TableCell className="font-medium text-gray-200">
                  <div className="flex flex-col">
                    <span>{eq.nome}</span>
                    <span className="text-xs text-gray-500 sm:hidden">{formatCPF(eq.cpf)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-400 hidden sm:table-cell font-mono text-xs">
                  {formatCPF(eq.cpf)}
                </TableCell>
                <TableCell className="text-gray-400 hidden md:table-cell text-sm">
                  {eq.igreja || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EquipantesGridDisplay;