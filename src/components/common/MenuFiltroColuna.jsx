import React, { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { casaBusca } from '@/utils/busca';
import { cn } from '@/lib/utils';

/**
 * Conteudo do funil de filtro das colunas (Gerenciar Inscricoes, Aprovacoes,
 * Pagamentos): marca um ou mais valores.
 *
 * Tem um campo de busca no topo (pedido de 07/10/2026): colunas como Igreja
 * tem mais de 100 opcoes e achar uma rolando a lista era lento. A busca nao
 * liga para maiuscula nem acento e tambem acha pelo numero ("17" acha
 * "17 - ..."). O que esta marcado continua valendo mesmo quando some da
 * lista por causa da busca. Ao fechar o menu a busca zera.
 */
const MenuFiltroColuna = ({ titulo, valores, marcados, onAlternar, onLimpar, className }) => {
  const [busca, setBusca] = useState('');
  const campoRef = useRef(null);
  const ativo = marcados.length > 0;

  const visiveis = useMemo(
    () => valores.filter((v) => casaBusca(busca, [v])),
    [valores, busca]
  );

  return (
    <DropdownMenuContent
      align="start"
      // O menu foca a si mesmo ao abrir; aqui o foco vai direto para a busca.
      onOpenAutoFocus={(e) => { e.preventDefault(); campoRef.current?.focus(); }}
      onCloseAutoFocus={() => setBusca('')}
      className={cn('w-64 border-white/20 max-h-80 overflow-y-auto z-50 p-1 pt-0 shadow-xl', className)}
    >
      <div className="sticky top-0 z-10 bg-inherit pt-1">
        <DropdownMenuLabel className="flex justify-between items-center text-white px-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filtrar por {titulo}</span>
          {ativo && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => { e.preventDefault(); onLimpar(); }}
              className="h-5 text-[10px] text-red-300 hover:text-red-200 hover:bg-red-500/20 px-2 rounded-full"
            >
              Limpar
            </Button>
          )}
        </DropdownMenuLabel>
        {valores.length > 0 && (
          <div className="relative px-1 pb-1">
            <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-[60%] pointer-events-none" />
            <input
              ref={campoRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              // Sem isto o menu usa as letras digitadas para pular entre os
              // itens e tira o foco do campo. Esc continua fechando o menu.
              onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}
              placeholder={`Buscar ${titulo.toLowerCase()}...`}
              aria-label={`Buscar opção de ${titulo}`}
              className="w-full h-8 rounded-md bg-white/5 border border-white/15 pl-7 pr-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400/60"
            />
          </div>
        )}
        <DropdownMenuSeparator className="bg-white/10 my-1" />
      </div>
      {valores.length === 0 ? (
        <div className="p-4 text-xs text-white/40 text-center italic">Sem opções disponíveis</div>
      ) : visiveis.length === 0 ? (
        <div className="p-4 text-xs text-white/40 text-center italic">Nenhuma opção encontrada</div>
      ) : (
        <div className="space-y-0.5">
          {visiveis.map((valor) => (
            <DropdownMenuCheckboxItem
              key={valor}
              checked={marcados.includes(valor)}
              onCheckedChange={() => onAlternar(valor)}
              onSelect={(e) => e.preventDefault()}
              className="text-white/90 text-sm focus:text-white focus:bg-white/10 rounded-sm cursor-pointer data-[state=checked]:bg-blue-500/20 data-[state=checked]:text-blue-200 pl-8"
            >
              {valor}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      )}
    </DropdownMenuContent>
  );
};

export default MenuFiltroColuna;
