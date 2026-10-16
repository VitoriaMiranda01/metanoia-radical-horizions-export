import React from 'react';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatCPF } from '@/utils/formatters';
import { formatarTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';

/**
 * Resumo de uma ficha de equipante (_ficha_resumo no banco), usado nos
 * pedidos de acesso e nos possiveis duplicados de Gerenciar Inscricoes.
 */
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : null);

const Etiqueta = ({ children, cor = 'gray' }) => {
  const cores = {
    gray: 'border-white/15 text-gray-300',
    green: 'border-green-500/40 text-green-300',
    amber: 'border-amber-500/40 text-amber-300',
    sky: 'border-sky-500/40 text-sky-300'
  };
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', cores[cor])}>{children}</span>;
};

const FichaResumo = ({ f, destaque = false, children }) => {
  if (!f) return null;
  const pago = ['pago', 'confirmado', 'completed'].includes(String(f.status_pagamento || '').toLowerCase());
  return (
    <div className={cn('rounded-md border p-3 space-y-1.5 text-sm', destaque ? 'border-sky-400/60 bg-sky-500/10' : 'border-white/10 bg-black/30')}>
      <p className="text-white font-medium">{f.nome}</p>
      <div className="flex flex-wrap gap-1">
        {f.inscrito ? <Etiqueta cor="green">inscrito nesta edição</Etiqueta> : <Etiqueta>edição anterior</Etiqueta>}
        {f.manual && <Etiqueta cor="amber">inscrição manual</Etiqueta>}
        {pago && <Etiqueta cor="green">pago</Etiqueta>}
        {f.pagamentos > 0 && !pago && <Etiqueta cor="sky">tem pagamento</Etiqueta>}
      </div>
      <p className="text-xs text-gray-400">
        CPF: <span className="text-gray-200">{f.cpf ? formatCPF(f.cpf) : 'sem CPF'}</span>
        {' · '}Nascimento: <span className="text-gray-200">{dataBR(f.data_nascimento) || '—'}</span>
      </p>
      <p className="text-xs text-gray-400 truncate">
        {f.whatsapp ? formatarTelefone(f.whatsapp) : 'sem WhatsApp'} · {nomeDaIgreja(f) || 'sem igreja'}
      </p>
      <p className="text-xs text-gray-400">
        Escala: <span className="text-gray-200">{f.areas?.length ? f.areas.join(', ') : 'nenhuma área'}</span>
      </p>
      {children}
    </div>
  );
};

export default FichaResumo;
