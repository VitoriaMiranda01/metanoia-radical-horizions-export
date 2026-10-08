import { useEffect, useState } from 'react';
import { fetchOpcoesDeIgreja } from '@/services/publicDataService';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';

/**
 * O que o formulario precisa saber sobre igrejas, vindo do banco
 * (opcoes_de_igreja):
 *
 *  - parceiras: TODAS as igrejas com codigo, "NN - NOME", na ordem do codigo.
 *    Desde 08/10/2026 a organizacao edita codigo e nome e cadastra igrejas em
 *    Configuracoes, entao a lista vem do banco. A constante do site
 *    (src/constants/igrejas.js) so vale enquanto o banco nao respondeu ou se
 *    ele falhar;
 *  - novas: igrejas criadas pela organizacao (ja estao em `parceiras`);
 *  - extras: igrejas acrescentadas sem codigo;
 *  - permiteOutra / permiteDiversos: OUTRA (equipante) e "84 - DIVERSOS"
 *    (acampante) so valem ate a virada de edicao.
 *
 * Falha na consulta nao derruba a tela: sem isso a pessoa ainda tem a lista do
 * site, e o servidor confere as duas opcoes de qualquer jeito.
 */

const PADRAO = { parceiras: IGREJAS_PARCEIRAS, novas: [], extras: [], permiteOutra: true, permiteDiversos: true };

let emAndamento = null;
const ouvintes = new Set();

export const limparOpcoesDeIgreja = () => { emAndamento = null; };

const carregar = () => {
  if (!emAndamento) {
    emAndamento = fetchOpcoesDeIgreja()
      .then((r) => {
        const novas = Array.isArray(r?.novas) ? r.novas : [];
        return {
          parceiras: Array.isArray(r?.lista) && r.lista.length > 0 ? r.lista : [...IGREJAS_PARCEIRAS, ...novas],
          novas,
          extras: Array.isArray(r?.extras) ? r.extras : [],
          permiteOutra: r?.permite_outra !== false,
          permiteDiversos: r?.permite_diversos !== false,
        };
      })
      .catch((erro) => {
        console.error('opcoes de igreja', erro?.message || erro);
        emAndamento = null;
        return PADRAO;
      });
  }
  return emAndamento;
};

// Depois de editar ou cadastrar igreja: busca de novo e atualiza todas as
// telas abertas que usam a lista (o quadro de limites, por exemplo).
export const recarregarOpcoesDeIgreja = async () => {
  emAndamento = null;
  const r = await carregar();
  ouvintes.forEach((avisar) => avisar(r));
  return r;
};

export const useOpcoesDeIgreja = () => {
  const [opcoes, setOpcoes] = useState(PADRAO);
  useEffect(() => {
    let vivo = true;
    const avisar = (r) => { if (vivo) setOpcoes(r); };
    ouvintes.add(avisar);
    carregar().then(avisar);
    return () => { vivo = false; ouvintes.delete(avisar); };
  }, []);
  return opcoes;
};
