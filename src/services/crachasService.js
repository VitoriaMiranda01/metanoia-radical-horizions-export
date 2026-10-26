import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';
import { fetchSaudeAcampantes } from '@/services/saudeService';

/**
 * Crachas dos acampantes (26/10/2026, migration 20261026c). So organizador.
 * A lista e a mesma da recepcao e dos onibus; o banco guarda so o que saiu no
 * ultimo cracha impresso de cada um (nome, cor, numero), para a tela saber
 * quem falta imprimir e quem mudou depois de impresso.
 */
export const fetchCrachas = async () => {
  const { data, error } = await comReenvio(() => supabase.rpc('crachas_lista'), { rotulo: 'crachás' });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar os crachás.');
  return data.pessoas || [];
};

/**
 * Ficha de saude de quem tem cracha (relacao de saude, 26/10/2026): mapa
 * 'tipo:id' -> ficha. Acampantes pela saude_acampantes() (a mesma da tela
 * Saude); equipe da trilha direto da ficha do equipante (organizador le).
 */
export const fetchSaudeDosCrachas = async (pessoas) => {
  const mapa = new Map();
  const ids = new Set(pessoas.filter((p) => p.tipo === 'acampante').map((p) => p.id));
  (await fetchSaudeAcampantes()).filter((a) => ids.has(a.id)).forEach((a) => mapa.set(`acampante:${a.id}`, a));

  const equipe = pessoas.filter((p) => p.tipo === 'equipante').map((p) => p.id);
  for (let i = 0; i < equipe.length; i += 100) {
    const { data, error } = await comReenvio(
      () => supabase.from('equipantes')
        .select('id, tem_problema_saude, condicoes_medicas, tem_restricao_alimentar, restricoes_alimentares')
        .in('id', equipe.slice(i, i + 100)),
      { rotulo: 'saúde da equipe' }
    );
    if (error) throw error;
    (data || []).forEach((e) => mapa.set(`equipante:${e.id}`, e));
  }
  return mapa;
};

const gravar = async (funcao, args, falha) => {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || falha);
  return data;
};

// itens: [{ tipo, id, nome, grupo, numero }] -- exatamente o que foi impresso.
export const marcarCrachasImpressos = (itens) =>
  gravar('crachas_marcar_impressos', { p_itens: itens }, 'Não foi possível marcar os crachás como impressos.');

export const desmarcarCrachaImpresso = (tipo, id) =>
  gravar('crachas_desmarcar_impresso', { p_tipo: tipo, p_id: id }, 'Não foi possível desmarcar o crachá.');
