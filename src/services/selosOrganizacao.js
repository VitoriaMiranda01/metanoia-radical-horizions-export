import { useSyncExternalStore } from 'react';
import { supabase } from '@/services/supabaseClient';

/**
 * Selos da organizacao (15/10/2026): Pastor(a) Diretor(a), Diretoria e Dev.
 *
 * NAO fazem parte da ficha do equipante (Patrick: "é somente um indicador
 * nosso") -- moram na tabela selos_organizacao e so organizador le
 * (selos_organizacao_listar). Carregados uma vez por pagina e guardados aqui;
 * o SeloPastor consulta pelo id do equipante.
 *
 * { [equipante_id]: 'pastor_diretor' | 'diretor' | 'dev' }
 */
let selos = {};
let carregou = false;
const ouvintes = new Set();

const carregar = async () => {
  carregou = true;
  try {
    const { data, error } = await supabase.rpc('selos_organizacao_listar');
    if (error || !data || typeof data !== 'object') return;
    selos = data;
    ouvintes.forEach((f) => f());
  } catch {
    // Sem os selos a tela funciona igual, so sem os icones.
  }
};

const assinar = (f) => {
  ouvintes.add(f);
  if (!carregou) carregar();
  return () => ouvintes.delete(f);
};

// O selo da pessoa (ou undefined). Re-renderiza quando a lista chega.
export const useSeloOrganizacao = (equipanteId) =>
  useSyncExternalStore(assinar, () => (equipanteId ? selos[equipanteId] : undefined));

// Leitura direta (fora de componente). Pode estar vazia antes de carregar.
export const seloOrganizacao = (equipanteId) => (equipanteId ? selos[equipanteId] : undefined);

// Garante que a lista esteja carregada (ex.: antes de filtrar o Alocar em lote).
export const carregarSelosOrganizacao = () => (carregou ? Promise.resolve() : carregar());
