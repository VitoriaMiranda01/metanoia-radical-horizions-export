import React from 'react';
import { ESPECIALIDADE_OUTRO } from '@/constants/especialidadesSaude';
import { cn } from '@/lib/utils';

// Cor de cada especialidade da lista (as que entrarem depois pelo "Tornar
// fixa" usam a cor neutra).
const COR = {
  'Técnico de enfermagem': 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  Enfermagem: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
  'Médico': 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  Socorrista: 'border-orange-500/40 bg-orange-500/15 text-orange-200',
  Fisioterapeuta: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
  Bombeiro: 'border-red-500/40 bg-red-500/15 text-red-200',
};

/**
 * Especialidade da Saude ao lado do nome (18/10/2026, pedido do Patrick):
 * opcao da lista vira TAG colorida; o que a pessoa escreveu em "Outro"
 * aparece como texto, do jeito que ela escreveu ("Patrick - Biomedicina").
 * semEspecialidade: mostra o aviso de que falta (so na tela da Saude).
 * adicionais (24/10/2026): as demais especialidades, uma tag para cada.
 */
const Tag = ({ nome, className }) => (
  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
    COR[nome] || 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200', className)}>
    {nome}
  </span>
);

const TagEspecialidade = ({ especialidade, outro, adicionais, semEspecialidade = false, className }) => {
  if (!especialidade) {
    return semEspecialidade
      ? <span className={cn('text-[11px] text-amber-300/90 italic', className)}>sem especialidade</span>
      : null;
  }
  const extras = (adicionais || []).filter((x) => x && x !== especialidade).map((x) => <Tag key={x} nome={x} className={className} />);
  if (especialidade === ESPECIALIDADE_OUTRO) {
    return (
      <>
        {outro ? <span className={cn('text-gray-300 font-normal', className)}> - {outro}</span> : null}
        {extras}
      </>
    );
  }
  return <><Tag nome={especialidade} className={className} />{extras}</>;
};

export default TagEspecialidade;
