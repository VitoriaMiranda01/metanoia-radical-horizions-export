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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCPF, formatNomeExibicao } from '@/utils/formatters';
import { User, Download, Loader2 } from 'lucide-react';
import { WORK_AREAS } from '@/constants/workAreas';

const EquipantesGridDisplay = ({
  equipantes = [],
  areaName,
  onExport,
  onRealocar,
  realocarAreaChoice = {},
  onRealocarAreaChoiceChange,
  realocando = {}
}) => {
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
            className="h-8 text-xs bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
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
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[26%]">Nome</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[16%] hidden sm:table-cell">CPF</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[26%] hidden md:table-cell">Igreja</TableHead>
              {onRealocar && <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[32%]">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipantes.map((eq, index) => (
              <TableRow 
                key={eq.id || index} 
                className="border-white/10 hover:bg-white/5 transition-colors"
              >
                <TableCell className="font-semibold text-white">
                  <div className="flex flex-col">
                    <span>{formatNomeExibicao(eq.nome)}</span>
                    <span className="text-xs text-gray-500 sm:hidden">{formatCPF(eq.cpf)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-400 hidden sm:table-cell font-mono text-xs">
                  {formatCPF(eq.cpf)}
                </TableCell>
                <TableCell className="text-gray-400 hidden md:table-cell text-[12.5px] max-w-[220px] truncate" title={eq.igreja || '-'}>
                  {eq.igreja || '-'}
                </TableCell>
                {onRealocar && (
                  <TableCell>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Select
                        value={realocarAreaChoice[eq.id] || ''}
                        onValueChange={(val) => onRealocarAreaChoiceChange(eq.id, val)}
                      >
                        <SelectTrigger className="h-8 w-full sm:w-[180px] bg-black/40 border-white/20 text-white text-xs">
                          <SelectValue placeholder="Nova área..." />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_AREAS.filter(area => area !== areaName).map(area => (
                            <SelectItem key={area} value={area}>{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => onRealocar(eq.id, eq.nome, areaName)}
                        disabled={!realocarAreaChoice[eq.id] || realocando[eq.id]}
                        className="h-8 text-xs font-semibold whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white disabled:bg-white/5 disabled:text-white/40 disabled:border disabled:border-white/20"
                      >
                        {realocando[eq.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Realocar'}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EquipantesGridDisplay;