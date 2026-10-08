import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Nome do grupo de trilha com a cor dele (Patrick, 08/10/2026): bolinha +
 * palavra na cor do grupo. Classes escritas por extenso de proposito -- o
 * Tailwind so gera as classes que aparecem inteiras no codigo.
 */
const CORES = {
  Vermelho: { tag: 'bg-red-500/15 text-red-300 border-red-500/50', bolinha: 'bg-red-500' },
  Amarelo: { tag: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/50', bolinha: 'bg-yellow-400' },
  Verde: { tag: 'bg-green-500/15 text-green-300 border-green-500/50', bolinha: 'bg-green-500' },
  Azul: { tag: 'bg-blue-500/15 text-blue-300 border-blue-500/50', bolinha: 'bg-blue-500' },
  Roxo: { tag: 'bg-purple-500/15 text-purple-300 border-purple-500/50', bolinha: 'bg-purple-500' },
};

export const corDoGrupo = (grupo) => CORES[grupo] || null;

const GrupoTrilhaTag = ({ grupo, className }) => {
  if (!grupo) return <span className="text-gray-600">—</span>;
  const cor = CORES[grupo];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        cor ? cor.tag : 'bg-white/10 text-gray-300 border-white/20',
        className
      )}
    >
      <span className={cn('w-2 h-2 rounded-full', cor ? cor.bolinha : 'bg-gray-400')} />
      {grupo}
    </span>
  );
};

export default GrupoTrilhaTag;
