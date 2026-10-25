import React from 'react';
import { CalendarDays } from 'lucide-react';

/**
 * Etiqueta "Só Domingo" (20261025c): acompanha, a edicao inteira, o equipante
 * que vai so no domingo -- inscricao, aprovacao, pagamentos, portaria.
 */
export const AREA_SO_DOMINGO = 'Vão somente no domingo';

const TagSoDomingo = ({ className = '' }) => (
  <span
    title="Vai só no domingo: não entra na escala; taxa de 50%"
    className={`inline-flex items-center gap-1 rounded-full border border-orange-400/50 bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-200 whitespace-nowrap ${className}`}
  >
    <CalendarDays className="h-3 w-3" /> Só Domingo
  </span>
);

export default TagSoDomingo;
