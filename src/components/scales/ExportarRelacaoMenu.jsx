import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  MODOS_RELACAO, montarLinhasRelacao, agruparRelacao, exportarRelacaoPdf, exportarRelacaoExcel
} from '@/utils/relacaoNominal';

/**
 * Exportar da Geracao de Escalas (17/10/2026, Patrick): a RELAÇÃO NOMINAL no
 * modelo da planilha oficial (Nome / Igreja / Área), de 3 jeitos -- geral, por
 * igreja e por área --, cada um em PDF ou Excel. A planilha detalhada antiga
 * (uma aba por área, com as 3 opções da inscrição) continua no fim do menu.
 */
const ExportarRelacaoMenu = ({ allocations, ehLider, onPlanilhaDetalhada, disabled }) => {
  const { toast } = useToast();
  const [gerando, setGerando] = useState(null);

  const exportar = async (modo, formato) => {
    setGerando(`${modo}-${formato}`);
    try {
      const linhas = montarLinhasRelacao(allocations, ehLider);
      if (linhas.length === 0) throw new Error('Ninguém escalado para exportar.');
      const grupos = agruparRelacao(linhas, modo);
      const total = formato === 'pdf'
        ? await exportarRelacaoPdf(grupos, modo)
        : await exportarRelacaoExcel(grupos, modo);
      toast({
        title: `${MODOS_RELACAO[modo].rotulo} em ${formato === 'pdf' ? 'PDF' : 'Excel'} gerado`,
        description: `${total} ${total === 1 ? 'linha' : 'linhas'}.`,
        className: 'bg-green-600 text-white'
      });
    } catch (e) {
      toast({ title: 'Não foi possível exportar', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-dica="Baixar a relação nominal (geral, por igreja ou por área) em PDF ou Excel." disabled={disabled || !!gerando}
          variant="outline" className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/40 hover:text-green-300">
          {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-zinc-950 border-white/10 text-gray-100">
        <DropdownMenuLabel className="text-xs text-gray-400 font-normal">
          Relação nominal (Nome / Igreja / Área), em ordem alfabética
        </DropdownMenuLabel>
        {Object.entries(MODOS_RELACAO).map(([modo, info], i) => (
          <React.Fragment key={modo}>
            {i > 0 && <DropdownMenuSeparator className="bg-white/10" />}
            <DropdownMenuLabel className="text-sm text-white">{i + 1}. {info.rotulo}</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-1 px-1 pb-1">
              <DropdownMenuItem onSelect={() => exportar(modo, 'pdf')}
                className="cursor-pointer justify-center gap-1.5 border border-white/10 focus:bg-red-500/15">
                <FileText className="h-4 w-4 text-red-300" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportar(modo, 'excel')}
                className="cursor-pointer justify-center gap-1.5 border border-white/10 focus:bg-green-500/15">
                <FileSpreadsheet className="h-4 w-4 text-green-300" /> Excel
              </DropdownMenuItem>
            </div>
          </React.Fragment>
        ))}
        {onPlanilhaDetalhada && (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onSelect={onPlanilhaDetalhada} className="cursor-pointer gap-2 text-gray-300">
              <Table2 className="h-4 w-4" /> Planilha detalhada (uma aba por área, com as 3 opções)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportarRelacaoMenu;
