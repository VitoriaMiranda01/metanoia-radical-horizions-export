import React from 'react';
import { Church, Crown } from 'lucide-react';
import { tituloPastor, ehPastorDiretor } from '@/utils/pastor';
import { cn } from '@/lib/utils';

/**
 * Iconezinho ao lado do nome de quem e pastor(a) ou pastor(a) auxiliar
 * (Patrick, 13/10/2026). Ao parar o mouse: "Pastor", "Pastora", "Pastor
 * auxiliar" ou "Pastora auxiliar". Vem do "Cargo na Igreja" da ficha (ver
 * utils/pastor.js). Quem nao e pastor: nada aparece.
 */
// Pastor(a) Diretor(a) (14/10/2026): coroa dourada no lugar da igreja azul.
const SeloPastor = ({ pessoa, className }) => {
  const titulo = tituloPastor(pessoa);
  if (!titulo) return null;
  const diretor = ehPastorDiretor(pessoa);
  return (
    <span data-dica={titulo} aria-label={titulo} role="img"
      className={cn('inline-flex shrink-0', diretor ? 'text-amber-400' : 'text-sky-400', className)}>
      {diretor ? <Crown className="h-3.5 w-3.5" fill="currentColor" /> : <Church className="h-3.5 w-3.5" />}
    </span>
  );
};

export default SeloPastor;
