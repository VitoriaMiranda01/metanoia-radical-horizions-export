import React from 'react';
import { Church } from 'lucide-react';
import { tituloPastor } from '@/utils/pastor';
import { cn } from '@/lib/utils';

/**
 * Iconezinho ao lado do nome de quem e pastor(a) ou pastor(a) auxiliar
 * (Patrick, 13/10/2026). Ao parar o mouse: "Pastor", "Pastora", "Pastor
 * auxiliar" ou "Pastora auxiliar". Vem do "Cargo na Igreja" da ficha (ver
 * utils/pastor.js). Quem nao e pastor: nada aparece.
 */
const SeloPastor = ({ pessoa, className }) => {
  const titulo = tituloPastor(pessoa);
  if (!titulo) return null;
  return (
    <span data-dica={titulo} aria-label={titulo} role="img"
      className={cn('inline-flex shrink-0 text-violet-300', className)}>
      <Church className="h-3.5 w-3.5" />
    </span>
  );
};

export default SeloPastor;
