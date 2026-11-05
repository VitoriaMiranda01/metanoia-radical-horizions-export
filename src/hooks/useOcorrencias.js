import { useEffect, useState } from 'react';
import { fetchMarcasOcorrencia } from '@/services/ocorrenciasService';

/**
 * Asterisco das ocorrencias anteriores: uma leitura so por tela, compartilhada
 * entre todas as linhas. Quando a ultima linha sai da tela o cache e apagado,
 * entao outra conta no mesmo navegador (parceiro, por exemplo) nao herda a
 * lista: o banco so responde a organizadores e ao Apoio da portaria.
 */
const VAZIO = { porFicha: new Map(), total: 0 };

let estado = VAZIO;
let promessa = null;
const ouvintes = new Set();

const montar = (marcas) => {
  const porFicha = new Map();
  (marcas || []).forEach((m) => (m.fichas || []).forEach((id) => porFicha.set(id, m)));
  return { porFicha, total: (marcas || []).length };
};

export const recarregarOcorrencias = () => {
  promessa = fetchMarcasOcorrencia()
    .then((r) => { estado = montar(r?.ok ? r.marcas : []); })
    .catch((err) => {
      console.error('ocorrencias_marcas', err?.message || err);
      estado = VAZIO;
    })
    .then(() => { ouvintes.forEach((f) => f()); });
  return promessa;
};

export const useOcorrencias = () => {
  const [, forcar] = useState(0);

  useEffect(() => {
    const aoMudar = () => forcar((n) => n + 1);
    ouvintes.add(aoMudar);
    if (!promessa) recarregarOcorrencias();
    return () => {
      ouvintes.delete(aoMudar);
      if (ouvintes.size === 0) {
        estado = VAZIO;
        promessa = null;
      }
    };
  }, []);

  return {
    total: estado.total,
    marcaDe: (id) => estado.porFicha.get(id) || null,
    temMarca: (id) => estado.porFicha.has(id),
  };
};
