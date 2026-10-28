import React from 'react';

/**
 * Presenca automatica de quem mora em outra cidade (WhatsApp com DDD 22 ou
 * 24) -- 28/10/2026, Patrick, migration 20261028e. O banco grava a presenca
 * com este "marcado por"; se o lider marcar ausente, vale a marcacao dele.
 * O texto tem que ser IGUAL ao de _marca_presenca_automatica() no banco.
 */
export const MARCA_PRESENCA_AUTOMATICA = 'Automático · mora em outra cidade (DDD 22/24)';

// 28/10/2026 (migration 20261028f): pagamento manual (baixa da Raquel/portaria)
// tambem gera presenca automatica. Texto IGUAL ao de _marca_presenca_pagamento_manual().
export const MARCA_PRESENCA_PAGAMENTO = 'Automático · pagamento manual confirmado';

export const ehPresencaPorPagamento = (p) =>
  p?.presente === true && p?.marcado_por === MARCA_PRESENCA_PAGAMENTO;

export const ehPresencaAutomatica = (p) =>
  p?.presente === true
  && (p?.marcado_por === MARCA_PRESENCA_AUTOMATICA || p?.marcado_por === MARCA_PRESENCA_PAGAMENTO);

export const DICA_PRESENCA_PAGAMENTO = 'Presença marcada automaticamente: o pagamento manual foi confirmado. '
  + 'Se a pessoa não vai servir, marque Ausente: vale a sua marcação.';

export const DICA_PRESENCA_AUTOMATICA = 'Presença marcada automaticamente: o WhatsApp é DDD 22 ou 24 '
  + '(mora em outra cidade). Se a pessoa não vai servir, marque Ausente: vale a sua marcação.';

const SeloOutraCidade = ({ p }) => {
  if (!ehPresencaAutomatica(p)) return null;
  const porPagamento = ehPresencaPorPagamento(p);
  const dica = porPagamento ? DICA_PRESENCA_PAGAMENTO : DICA_PRESENCA_AUTOMATICA;
  return (
    <span title={dica} data-dica={dica}
      className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-500/30">
      {porPagamento ? 'presente (pagou)' : 'presente (outra cidade)'}
    </span>
  );
};

export default SeloOutraCidade;
