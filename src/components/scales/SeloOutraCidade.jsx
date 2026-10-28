import React from 'react';

/**
 * Presenca automatica de quem mora em outra cidade (WhatsApp com DDD 22 ou
 * 24) -- 28/10/2026, Patrick, migration 20261028e. O banco grava a presenca
 * com este "marcado por"; se o lider marcar ausente, vale a marcacao dele.
 * O texto tem que ser IGUAL ao de _marca_presenca_automatica() no banco.
 */
export const MARCA_PRESENCA_AUTOMATICA = 'Automático · mora em outra cidade (DDD 22/24)';

export const ehPresencaAutomatica = (p) =>
  p?.presente === true && p?.marcado_por === MARCA_PRESENCA_AUTOMATICA;

export const DICA_PRESENCA_AUTOMATICA = 'Presença marcada automaticamente: o WhatsApp é DDD 22 ou 24 '
  + '(mora em outra cidade). Se a pessoa não vai servir, marque Ausente: vale a sua marcação.';

const SeloOutraCidade = ({ p }) => (ehPresencaAutomatica(p) ? (
  <span title={DICA_PRESENCA_AUTOMATICA} data-dica={DICA_PRESENCA_AUTOMATICA}
    className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-500/30">
    presente (outra cidade)
  </span>
) : null);

export default SeloOutraCidade;
