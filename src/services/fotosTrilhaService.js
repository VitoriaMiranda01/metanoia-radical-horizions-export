import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';
import { formatEventDateRange } from '@/utils/eventDateFormat';
import { quebrarDatas } from '@/utils/arteTrilha';

/**
 * Fotos da equipe de trilha (24/10/2026, Patrick) -- migration 20261024p.
 * Banco de fotos por ficha (equipantes.id), bucket PRIVADO
 * "fotos-equipe-trilha", só organizadores. A foto fica mesmo para quem não
 * está escalado (vale nas próximas edições) e sai junto com a ficha (LGPD).
 * Trocar/remover: o arquivo antigo vai para a fila da LGPD pelo gatilho e é
 * apagado na rotina das 03:30 -- a tela não apaga arquivo.
 */
const BUCKET = 'fotos-equipe-trilha';

export const listarFotosTrilha = async () => {
  const { data, error } = await comReenvio(() => supabase.rpc('fotos_trilha_lista'), { rotulo: 'fotos-trilha' });
  if (error) throw new Error(error.message);
  return data || [];
};

export const buscarFichasParaFoto = async (texto) => {
  const { data, error } = await supabase.rpc('fotos_trilha_buscar', { p_texto: texto });
  if (error) throw new Error(error.message);
  return data || [];
};

// Links temporários (1 h) para mostrar as fotos na tela.
export const linksDasFotos = async (caminhos) => {
  const lista = [...new Set((caminhos || []).filter(Boolean))];
  if (lista.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(lista, 3600);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
};

// O arquivo em si (para desenhar a arte sem problema de CORS no canvas).
export const baixarFoto = async (caminho) => {
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error) throw new Error(error.message);
  return data;
};

export const salvarFoto = async (equipanteId, blob, nomeArte) => {
  const caminho = `${equipanteId}/${Date.now()}.jpg`;
  const { error: e1 } = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from('fotos_trilha')
    .upsert({ equipante_id: equipanteId, caminho, nome_arte: nomeArte ?? null }, { onConflict: 'equipante_id' });
  if (e2) {
    // a linha não entrou: o arquivo novo não serve para nada
    await supabase.storage.from(BUCKET).remove([caminho]);
    throw new Error(e2.message);
  }
  return caminho;
};

export const salvarNomeArte = async (equipanteId, nomeArte) => {
  const { error } = await supabase.from('fotos_trilha').update({ nome_arte: nomeArte || null }).eq('equipante_id', equipanteId);
  if (error) throw new Error(error.message);
};

export const removerFoto = async (equipanteId) => {
  const { error } = await supabase.from('fotos_trilha').delete().eq('equipante_id', equipanteId);
  if (error) throw new Error(error.message);
};

// "36ª EDIÇÃO" + datas da edição, para o cabeçalho da arte.
export const dadosDaEdicaoParaArte = async () => {
  const { data } = await supabase.from('configuracoes')
    .select('edicao_numero, data_evento_inicio, data_evento_fim').limit(1).maybeSingle();
  const datas = formatEventDateRange(data?.data_evento_inicio, data?.data_evento_fim);
  return {
    titulo: data?.edicao_numero ? `${data.edicao_numero}ª EDIÇÃO` : '',
    datas: quebrarDatas(datas)
  };
};
