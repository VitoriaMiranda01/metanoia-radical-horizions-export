import React from 'react';
import { Baby, UserCheck } from 'lucide-react';

/**
 * Etiquetas do equipante menor de idade (20261105a): "Menor de idade" ao lado
 * do nome em toda a tela de aprovacao, e "Acompanhante de ..." em quem foi
 * indicado como acompanhante de um menor.
 */
const TagMenor = ({ liberado = false, className = '' }) => (
  <span
    title={liberado
      ? 'Menor de idade: a autorização do responsável já foi confirmada'
      : 'Menor de idade: para aprovar, confirme a autorização do responsável'}
    className={`inline-flex items-center gap-1 rounded-full border border-pink-400/50 bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold text-pink-200 whitespace-nowrap ${className}`}
  >
    <Baby className="h-3 w-3" /> Menor de idade{liberado ? ' ✓' : ''}
  </span>
);

export const TagAcompanhanteDe = ({ menores = [], className = '' }) => {
  if (!menores.length) return null;
  const nomes = menores.map((m) => m.nome).join(', ');
  return (
    <span
      title={`Indicado como acompanhante de ${nomes} durante o projeto`}
      className={`inline-flex items-center gap-1 rounded-full border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-200 max-w-full ${className}`}
    >
      <UserCheck className="h-3 w-3 shrink-0" />
      <span className="truncate">Acompanhante de {nomes}</span>
    </span>
  );
};

export default TagMenor;
