import React, { useMemo } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import BotaoOrdenar from '@/components/common/BotaoOrdenar';
import { cn } from '@/lib/utils';

/**
 * Cabecalho de coluna com o funil de filtro (marca um ou mais valores) e a
 * seta de ordenar -- o mesmo das tabelas de Gerenciar Inscricoes, para
 * telas que nao tem um ColumnHeader proprio (Pagamentos).
 *
 * valorDe(item, chave) devolve o texto da coluna, o mesmo usado para
 * filtrar e para ordenar (utils/ordenacao.js).
 */
const CabecalhoFiltroOrdem = ({ titulo, chave, dados, valorDe, filtros, onFiltrar, ordem, onOrdenar }) => {
  const marcados = filtros[chave] || [];
  const ativo = marcados.length > 0;

  const valores = useMemo(() => {
    const set = new Set();
    dados.forEach((item) => {
      const v = valorDe(item, chave);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [dados, chave, valorDe]);

  const alternar = (valor) => {
    onFiltrar(chave, marcados.includes(valor)
      ? marcados.filter((v) => v !== valor)
      : [...marcados, valor]);
  };

  return (
    <div className="flex items-center h-full">
      <span className="text-gray-300 font-medium whitespace-nowrap">{titulo}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-dica={`Filtrar a lista por ${titulo}.`}
            variant="ghost" size="sm"
            className={cn(
              'h-6 w-6 md:h-8 md:w-8 p-0 ml-1 md:ml-2 relative transition-colors',
              ativo ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'
            )}
          >
            <Filter className="h-3 w-3 md:h-4 md:w-4" />
            {ativo && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 md:h-3 md:w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] md:text-[9px] font-bold text-white ring-1 md:ring-2 ring-slate-900">
                {marcados.length}
              </span>
            )}
            <span className="sr-only">Filtrar {titulo}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-black border-white/20 max-h-80 overflow-y-auto z-50 p-1 shadow-xl">
          <DropdownMenuLabel className="flex justify-between items-center text-white px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filtrar por {titulo}</span>
            {ativo && (
              <Button
                variant="ghost" size="sm"
                onClick={(e) => { e.preventDefault(); onFiltrar(chave, []); }}
                className="h-5 text-[10px] text-red-300 hover:text-red-200 hover:bg-black/20 px-2 rounded-full"
              >
                Limpar
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10 my-1" />
          {valores.length === 0 ? (
            <div className="p-4 text-xs text-white/40 text-center italic">Sem opções disponíveis</div>
          ) : (
            <div className="space-y-0.5">
              {valores.map((valor) => (
                <DropdownMenuCheckboxItem
                  key={valor}
                  checked={marcados.includes(valor)}
                  onCheckedChange={() => alternar(valor)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-white/90 text-sm focus:text-white focus:bg-white/10 rounded-sm cursor-pointer data-[state=checked]:bg-blue-500/20 data-[state=checked]:text-blue-200 pl-8"
                >
                  {valor}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <BotaoOrdenar titulo={titulo} chave={chave} ordem={ordem} onOrdenar={onOrdenar} />
    </div>
  );
};

export default CabecalhoFiltroOrdem;
