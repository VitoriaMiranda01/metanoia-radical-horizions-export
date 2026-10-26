import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Recepcao dos acampantes na igreja (login Apoio "recepcao", 25/10/2026,
 * migration 20261025g). A conta de apoio nao le nenhuma tabela direto: a
 * chamada, os onibus e o "Encerrar chamada" passam pelas funcoes do banco,
 * que conferem quem esta logado. O organizador usa as mesmas funcoes (modulo
 * "Presenca dos Acampantes" e as Listas dos onibus).
 */
export const fetchRecepcaoLista = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('recepcao_lista'),
    { rotulo: 'lista da recepção' }
  );
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar a lista.');
  return {
    pessoas: data.pessoas || [],
    onibus: data.onibus || { numero: 4, lugares: [] },
    chamada: data.chamada || {},
    organizador: !!data.organizador,
  };
};

// "Assinatura" curta: a tela confere a cada poucos segundos e so baixa a
// lista inteira quando ela muda. null = sem acesso.
export const fetchRecepcaoVersao = async () => {
  const { data, error } = await supabase.rpc('recepcao_versao');
  if (error) throw error;
  return data ?? null;
};

// Faixa do painel dos organizadores: null = chamada aberta.
export const fetchAvisoChamada = async () => {
  const { data, error } = await supabase.rpc('recepcao_chamada_aviso');
  if (error) throw error;
  return data ?? null;
};

// Gravacoes: sem reenvio automatico.
const gravar = async (funcao, args, falha) => {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) throw error;
  if (!data?.ok) {
    const recusa = new Error(data?.erro || falha);
    recusa.recusadoPeloBanco = true;
    throw recusa;
  }
  return data;
};

export const marcarPresenca = (tipo, id, termo, responsavel = false) =>
  gravar('recepcao_marcar_presenca', { p_tipo: tipo, p_id: id, p_termo: termo, p_responsavel: responsavel },
    'Não foi possível marcar a presença.');

export const desfazerPresenca = (tipo, id) =>
  gravar('recepcao_desfazer_presenca', { p_tipo: tipo, p_id: id }, 'Não foi possível desfazer a presença.');

export const salvarObservacaoRecepcao = (tipo, id, texto) =>
  gravar('recepcao_salvar_observacao', { p_tipo: tipo, p_id: id, p_texto: texto },
    'Não foi possível salvar a observação.');

export const encerrarChamada = () =>
  gravar('recepcao_encerrar_chamada', {}, 'Não foi possível encerrar a chamada.');

export const reabrirChamada = () =>
  gravar('recepcao_reabrir_chamada', {}, 'Não foi possível reabrir a chamada.');

// ---- Onibus (so organizador) ----
const lugaresNumeros = (lugares, numero) =>
  Array.from({ length: numero }, (_, i) => Number(lugares?.[i]) || 0);

export const salvarConfigOnibus = (numero, lugares) =>
  gravar('onibus_salvar_config', { p_numero: numero, p_lugares: lugaresNumeros(lugares, numero) },
    'Não foi possível salvar o número de ônibus.');

// itens: [{ tipo, id, onibus }]
export const fecharDivisaoOnibus = (numero, lugares, itens) =>
  gravar('onibus_fechar_divisao', { p_numero: numero, p_lugares: lugaresNumeros(lugares, numero), p_itens: itens },
    'Não foi possível fechar a divisão.');

export const moverDeOnibus = (tipo, id, onibus) =>
  gravar('onibus_mover', { p_tipo: tipo, p_id: id, p_onibus: onibus }, 'Não foi possível mudar de ônibus.');

export const desfazerDivisaoOnibus = () =>
  gravar('onibus_desfazer_divisao', {}, 'Não foi possível desfazer a divisão.');
