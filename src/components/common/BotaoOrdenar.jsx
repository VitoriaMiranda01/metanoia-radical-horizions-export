import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { proximaOrdem } from '@/utils/ordenacao';

/**
 * Seta de ordenar ao lado do filtro de cada coluna (ver utils/ordenacao.js):
 * crescente (seta para cima) -> decrescente (seta para baixo) -> sem ordem.
 */
const BotaoOrdenar = ({ titulo, chave, ordem, onOrdenar }) => {
  if (!onOrdenar) return null;
  const ativa = ordem?.chave === chave;
  const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
  const dica = !ativa
    ? `Ordenar por ${titulo} (crescente).`
    : ordem.direcao === 'asc'
      ? `Ordenado por ${titulo}, crescente. Clique para decrescente.`
      : `Ordenado por ${titulo}, decrescente. Clique para tirar a ordenação.`;
  return (
    <Button
      type="button" variant="ghost" size="sm"
      onClick={() => onOrdenar(proximaOrdem(ordem, chave))}
      data-dica={dica}
      aria-label={dica}
      className={cn(
        'h-6 w-6 md:h-8 md:w-8 p-0 ml-0.5 transition-colors',
        ativa ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'
      )}
    >
      <Icone className="h-3 w-3 md:h-4 md:w-4" />
    </Button>
  );
};

export default BotaoOrdenar;
