import React, { useMemo } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import BotaoOrdenar from '@/components/common/BotaoOrdenar';
import MenuFiltroColuna from '@/components/common/MenuFiltroColuna';
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
              'h-6 w-6 md:h-7 md:w-7 p-0 ml-1 relative transition-colors',
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
        <MenuFiltroColuna
          titulo={titulo}
          valores={valores}
          marcados={marcados}
          onAlternar={alternar}
          onLimpar={() => onFiltrar(chave, [])}
          className="bg-black"
        />
      </DropdownMenu>
      <BotaoOrdenar titulo={titulo} chave={chave} ordem={ordem} onOrdenar={onOrdenar} />
    </div>
  );
};

export default CabecalhoFiltroOrdem;
