import { useEffect, useState } from 'react';
import { fetchOpcoesDeIgreja } from '@/services/publicDataService';

/**
 * O que o formulario precisa saber sobre igrejas alem da lista fixa do site
 * (src/constants/igrejas.js), vindo do banco (opcoes_de_igreja):
 *
 *  - novas: igrejas criadas pela organizacao, ja no formato "166 - NOME";
 *  - extras: igrejas acrescentadas sem codigo;
 *  - permiteOutra / permiteDiversos: OUTRA (equipante) e "84 - DIVERSOS"
 *    (acampante) so valem ate a virada de edicao.
 *
 * Falha na consulta nao derruba a tela: sem isso a pessoa ainda tem a lista do
 * site, e o servidor confere as duas opcoes de qualquer jeito.
 */

const PADRAO = { novas: [], extras: [], permiteOutra: true, permiteDiversos: true };

let emAndamento = null;

export const limparOpcoesDeIgreja = () => { emAndamento = null; };

const carregar = () => {
  if (!emAndamento) {
    emAndamento = fetchOpcoesDeIgreja()
      .then((r) => ({
        novas: Array.isArray(r?.novas) ? r.novas : [],
        extras: Array.isArray(r?.extras) ? r.extras : [],
        permiteOutra: r?.permite_outra !== false,
        permiteDiversos: r?.permite_diversos !== false,
      }))
      .catch((erro) => {
        console.error('opcoes de igreja', erro?.message || erro);
        emAndamento = null;
        return PADRAO;
      });
  }
  return emAndamento;
};

export const useOpcoesDeIgreja = () => {
  const [opcoes, setOpcoes] = useState(PADRAO);
  useEffect(() => {
    let vivo = true;
    carregar().then((r) => { if (vivo) setOpcoes(r); });
    return () => { vivo = false; };
  }, []);
  return opcoes;
};
