import React from 'react';
import { Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Iconezinho ao lado do nome de quem foi colocado pelo "Alocar automático"
 * (Patrick, 14/10/2026). So aparece para organizador (o banco so devolve a
 * lista para eles) e some se a pessoa foi mexida a mao (trocou de area).
 */
const SeloAutomatico = ({ className }) => (
  <span data-dica="Alocado pelo Alocar automático" aria-label="Alocado pelo Alocar automático" role="img"
    className={cn('inline-flex shrink-0 text-violet-400', className)}>
    <Wand2 className="h-3.5 w-3.5" />
  </span>
);

export default SeloAutomatico;
