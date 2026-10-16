import { useSyncExternalStore } from 'react';
import { supabase } from '@/services/supabaseClient';
import { marcarPresencaOrganizador } from '@/services/scalesService';

/**
 * A chamada da reuniao de escala, na tela da Geracao de Escalas (16/10/2026).
 *
 * Um lugar so: a tabela de cada area (icone ao lado do nome), a janela
 * "Chamada · area" e o quadro da chamada leem e escrevem aqui -- e tudo vem
 * da mesma tabela do banco (chamada_escala) que o lider e o responsavel pela
 * reuniao usam no celular. Marcou num lugar, muda em todos; o que os lideres
 * marcam chega a cada 30 s.
 *
 * mapa: { [escala_id]: 'p|marcado por' | 'a|marcado por' }   (sem chave =
 * chamada nao registrada). `ativa` = escala provisoria lancada.
 */
let ativa = false;
let podeMarcar = false;
let mapa = {};
const ouvintes = new Set();
const aoMudar = new Set();

const avisar = () => ouvintes.forEach((f) => f());
const assinar = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };

export const configurarChamada = (opcoes) => {
  if (opcoes.ativa === ativa && opcoes.podeMarcar === podeMarcar) return;
  ativa = !!opcoes.ativa;
  podeMarcar = !!opcoes.podeMarcar;
  if (!ativa) mapa = {};
  avisar();
};

export const carregarChamada = async () => {
  if (!ativa) return;
  try {
    const { data, error } = await supabase.rpc('chamada_mapa');
    if (error || !data || typeof data !== 'object') return;
    const novo = {};
    Object.entries(data).forEach(([id, [presente, por]]) => {
      novo[id] = `${presente ? 'p' : 'a'}|${por || ''}`;
    });
    mapa = novo;
    avisar();
  } catch {
    // Sem a chamada a tela funciona igual, so sem os icones atualizados.
  }
};

// Marcacao feita em outro lugar da tela (a janela da area).
export const registrarChamadaLocal = (escalaId, presente, por = '') => {
  if (presente === null || presente === undefined) delete mapa[escalaId];
  else mapa = { ...mapa, [escalaId]: `${presente ? 'p' : 'a'}|${por}` };
  mapa = { ...mapa };
  avisar();
  aoMudar.forEach((f) => f());
};

// Marcar pela tabela. Muda na hora; se o servidor recusar, volta ao que ele tem.
export const marcarChamada = async (escalaId, presente) => {
  const antes = mapa[escalaId];
  registrarChamadaLocal(escalaId, presente, 'você (organização)');
  const r = await marcarPresencaOrganizador(escalaId, presente);
  if (!r.success) {
    if (antes) mapa = { ...mapa, [escalaId]: antes }; else { mapa = { ...mapa }; delete mapa[escalaId]; }
    avisar();
    return r;
  }
  registrarChamadaLocal(escalaId, presente, r.data?.marcado_por || 'organização');
  return r;
};

// A pagina escuta para atualizar os numeros do quadro da chamada.
export const aoMudarChamada = (f) => { aoMudar.add(f); return () => aoMudar.delete(f); };

// null = escala ainda nao lancada (sem icone). '' = nao registrada.
export const useChamada = (escalaId) =>
  useSyncExternalStore(assinar, () => (ativa && escalaId ? (mapa[escalaId] ?? '') : null));

export const usePodeMarcarChamada = () => useSyncExternalStore(assinar, () => podeMarcar);
