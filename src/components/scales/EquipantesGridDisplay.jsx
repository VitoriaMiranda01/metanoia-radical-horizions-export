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
import { User, Download, Loader2, Star } from 'lucide-react';
import { WORK_AREAS } from '@/constants/workAreas';
import { cn } from '@/lib/utils';

const EquipantesGridDisplay = ({
  equipantes = [],
  areaName,
  onExport,
  onRealocar,
  realocarAreaChoice = {},
  onRealocarAreaChoiceChange,
  realocando = {},
  // Atuacoes possiveis NESTA area, na ordem do banco (a primeira e a
  // padrao, que todo mundo recebe ao ser alocado).
  atuacoes = [],
  onDefinirAtuacao,
  salvandoAtuacao = {}
}) => {
  if (!equipantes || equipantes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-white/5 rounded-md border border-white/5 border-dashed">
        <User className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhum equipante alocado.</p>
      </div>
    );
  }

  // So faz sentido mostrar a coluna quando a area tem mais de uma opcao --
  // em Estacionamento ou Secretaria, por exemplo, a atuacao e uma so.
  const mostrarAtuacao = onDefinirAtuacao && atuacoes.length > 1;
  const ehLider = (valor) => atuacoes.some(a => a.atuacao === valor && a.ehLider);

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
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[24%]">Nome</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[14%] hidden sm:table-cell">CPF</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[22%] hidden md:table-cell">Igreja</TableHead>
              {mostrarAtuacao && <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[18%]">Atuação</TableHead>}
              {onRealocar && <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[22%]">Ação</TableHead>}
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
                    <span className="flex items-center gap-1.5">
                      {formatNomeExibicao(eq.nome)}
                      {ehLider(eq.atuacao) && (
                        <Star className="h-3 w-3 text-amber-400 shrink-0" fill="currentColor" title="Líder da área" />
                      )}
                    </span>
                    <span className="text-xs text-gray-500 sm:hidden">{formatCPF(eq.cpf)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-400 hidden sm:table-cell font-mono text-xs">
                  {formatCPF(eq.cpf)}
                </TableCell>
                <TableCell className="text-gray-400 hidden md:table-cell text-[12.5px] max-w-[220px] truncate" title={eq.igreja || '-'}>
                  {eq.igreja || '-'}
                </TableCell>
                {mostrarAtuacao && (
                  <TableCell>
                    <Select
                      value={eq.atuacao || ''}
                      onValueChange={(val) => onDefinirAtuacao(eq.id, val, areaName)}
                      disabled={!!salvandoAtuacao[eq.id]}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-full sm:w-[170px] bg-black/40 border-white/20 text-xs",
                          ehLider(eq.atuacao) ? "text-amber-300 border-amber-500/40" : "text-white"
                        )}
                      >
                        {salvandoAtuacao[eq.id]
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <SelectValue placeholder="Definir..." />}
                      </SelectTrigger>
                      <SelectContent>
                        {atuacoes.map(a => (
                          <SelectItem key={a.atuacao} value={a.atuacao}>
                            {a.ehLider ? `★ ${a.atuacao}` : a.atuacao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {onRealocar && (
                  <TableCell>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Select
                        value={realocarAreaChoice[eq.id] || ''}
                        onValueChange={(val) => onRealocarAreaChoiceChange(eq.id, val)}
                      >
                        <SelectTrigger className="h-8 w-full sm:w-[150px] bg-black/40 border-white/20 text-white text-xs">
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
