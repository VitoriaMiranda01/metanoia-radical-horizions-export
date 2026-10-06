/**
 * Ordenacao das tabelas de inscricao pelas colunas (Patrick, 06/10/2026):
 * a seta ao lado do filtro alterna crescente -> decrescente -> sem ordem.
 *
 * Compara como gente le: sem diferenca de maiuscula/acento, numeros pelo
 * valor ("2" antes de "10") e datas "dd/mm/aaaa" pela data de verdade.
 * Vazios ficam sempre no fim.
 */

const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})/;

const chaveDe = (valor) => {
  const t = String(valor ?? '').trim();
  const m = t.match(DATA_BR);
  return m ? `${m[3]}${m[2]}${m[1]}${t.slice(10)}` : t;
};

// ordem: null | { chave, direcao: 'asc' | 'desc' }
export const ordenarLista = (lista, ordem, valorDe) => {
  if (!ordem?.chave) return lista;
  const fator = ordem.direcao === 'desc' ? -1 : 1;
  return [...lista].sort((a, b) => {
    const va = chaveDe(valorDe(a, ordem.chave));
    const vb = chaveDe(valorDe(b, ordem.chave));
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return fator * va.localeCompare(vb, 'pt-BR', { numeric: true, sensitivity: 'base' });
  });
};

/** Proximo estado ao clicar na seta da coluna `chave`. */
export const proximaOrdem = (atual, chave) => {
  if (atual?.chave !== chave) return { chave, direcao: 'asc' };
  if (atual.direcao === 'asc') return { chave, direcao: 'desc' };
  return null;
};
