import { useEffect, useState } from 'react';
import { meuDescontoAutomatico } from '@/services/publicDataService';

/**
 * Desconto automatico de pastor e infiltrado (19/10/2026): 50% do preco do
 * dia, sem cupom. Devolve null enquanto carrega, se nao houver desconto ou se
 * a consulta falhar (a tela fica como antes; quem cobra de verdade e o
 * servidor, que aplica o desconto de qualquer jeito).
 */
export const useDescontoAutomatico = (tipo, id, dono = {}) => {
  const [auto, setAuto] = useState(null);

  useEffect(() => {
    let vivo = true;
    setAuto(null);
    if (tipo !== 'equipante' || !id) return undefined;
    meuDescontoAutomatico({ tipo, id, ...dono })
      .then((r) => {
        if (vivo && r?.ok && Number(r.desconto) > 0) setAuto(r);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [tipo, id, dono.cpf, dono.nome, dono.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps

  return auto;
};

export const rotuloMotivoDesconto = (auto) => {
  if (!auto) return '';
  const pct = auto.percentual ? ` (${Number(auto.percentual)}%)` : '';
  if (auto.motivo === 'pastor') return `Desconto de pastor${pct}`;
  if (auto.motivo === 'infiltrado') return `Desconto de infiltrado${pct}`;
  return `Desconto${pct}`;
};
