import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';
import { digitosTelefone } from '@/utils/telefone';

/**
 * Relacao do lider (pedido do Patrick, 05/10/2026).
 *
 * Depois que a escala PROVISORIA e lancada, quem esta como lider na escala
 * abre, no proprio acompanhamento, a relacao da sua area (ou da sua cor):
 * nome, igreja e telefone de cada um, a chamada da reuniao de escala e o
 * convite do grupo de WhatsApp.
 *
 * Toda chamada leva a prova de dono do acompanhamento (CPF, ou nome +
 * nascimento) -- quem decide tudo e o servidor (relacao_lider e companhia).
 * Sem codigo de lider e sem puxar ninguem pelo CPF: decisao do Patrick,
 * 05/10/2026. Quem manda gente para a area sao os organizadores.
 */

const credenciais = (equipanteId, dono = {}) => ({
  p_id: equipanteId,
  p_cpf: dono.cpf ?? null,
  p_nome: dono.nome ?? null,
  p_nascimento: dono.nascimento ?? null
});

const chamar = async (funcao, params, rotulo) => {
  const { data, error } = await comReenvio(() => supabase.rpc(funcao, params), { rotulo });
  if (error) return { ok: false, erro: 'Sem conexão com o servidor agora. Tente de novo em instantes.' };
  return data || { ok: false, erro: 'Resposta vazia do servidor.' };
};

export const fetchRelacaoLider = (equipanteId, dono) =>
  chamar('relacao_lider', credenciais(equipanteId, dono), 'relação do líder');

// So a assinatura do estado das equipes (62 bytes): o celular compara e so
// baixa a relacao inteira quando mudou (18/10/2026, migration 20261018c).
// Sem reenvio: se falhar, a proxima conferencia tenta de novo.
export const fetchAssinaturaRelacao = async (equipanteId, dono) => {
  const { data, error } = await supabase.rpc('relacao_lider_assinatura', credenciais(equipanteId, dono));
  if (error || !data) return { ok: false };
  return data;
};

// presente: true | false | null (desmarca)
export const marcarPresenca = (equipanteId, dono, escalaId, presente) =>
  chamar('lider_marcar_presenca', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId,
    p_presente: presente
  }, 'chamada');

export const salvarGrupoLider = (equipanteId, dono, escalaLider, link) =>
  chamar('lider_salvar_grupo', {
    ...credenciais(equipanteId, dono),
    p_escala_lider: escalaLider,
    p_link: link
  }, 'link do grupo');

export const marcarConviteLider = (equipanteId, dono, escalaId) =>
  chamar('lider_marcar_convite', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId
  }, 'convite do grupo');

// Primeiro clique em "ver a lista da equipe": lider/responsavel ja ficam presentes
// (so se ainda nao tinham chamada; ele pode retirar depois). 21/10/2026.
export const presencaPropriaLider = (equipanteId, dono) =>
  chamar('lider_presenca_propria', credenciais(equipanteId, dono), 'presença do líder');

// "Ja esta no grupo", marcado a mao pelo lider/responsavel (valor false desmarca).
export const marcarNoGrupo = (equipanteId, dono, escalaId, valor) =>
  chamar('lider_marcar_no_grupo', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId,
    p_valor: valor
  }, 'marcação do grupo');

// Fotografos no grupo da trilha da cor (27/10/2026): acao 'convite',
// 'no_grupo' ou 'fora_do_grupo'. O convite conta no mesmo limite de envios.
export const grupoTrilhaFotografo = (equipanteId, dono, escalaId, acao) =>
  chamar('lider_grupo_trilha_fotografo', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId,
    p_acao: acao
  }, 'grupo da trilha do fotógrafo');

/**
 * Link do WhatsApp para um numero cadastrado. Numero brasileiro (10 ou 11
 * digitos) ganha o 55; quem ja veio com 55 ou e estrangeiro vai como esta.
 */
export const numeroWhatsApp = (telefone, estrangeiro = false) => {
  // Brasileiro: sem o 0 / +55 antes do DDD de numero antigo (digitosTelefone).
  let d = estrangeiro ? String(telefone || '').replace(/\D/g, '') : digitosTelefone(telefone);
  if (!d) return null;
  if (!estrangeiro && (d.length === 10 || d.length === 11)) d = `55${d}`;
  if (d.length < 10) return null;
  return d;
};

export const linkWhatsApp = (telefone, estrangeiro = false, texto = '') => {
  const d = numeroWhatsApp(telefone, estrangeiro);
  if (!d) return null;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};

// ---- Lider v2 (15/10/2026) ----------------------------------------------

// So o lider, em areas com 2+ atuacoes alem do lider (menos Guia).
export const trocarAtuacaoLider = (equipanteId, dono, escalaId, atuacao) =>
  chamar('lider_trocar_atuacao', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId,
    p_atuacao: atuacao
  }, 'troca de atuação');

// So o lider da Fotografia. cor = null tira a cor.
export const definirCorLider = (equipanteId, dono, escalaId, cor) =>
  chamar('lider_definir_cor', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId,
    p_cor: cor || null
  }, 'cor');

// Responsavel pela reuniao da escala: alguem da equipe. null desfaz.
export const delegarReuniao = (equipanteId, dono, area, cor, delegadoId) =>
  chamar('lider_delegar_reuniao', {
    ...credenciais(equipanteId, dono),
    p_area: area,
    p_cor: cor || null,
    p_equipante_id: delegadoId || null
  }, 'responsável pela reunião');

// Lider de area extra: puxar gente para a lista.
export const buscarParaAreaExtra = (equipanteId, dono, area, termo) =>
  chamar('lider_extra_buscar', {
    ...credenciais(equipanteId, dono),
    p_area: area,
    p_termo: termo
  }, 'busca');

export const incluirNaAreaExtra = (equipanteId, dono, area, pessoaId) =>
  chamar('lider_extra_incluir', {
    ...credenciais(equipanteId, dono),
    p_area: area,
    p_equipante_id: pessoaId
  }, 'inclusão na área extra');

// Lider da Recepcao Igreja (23/10/2026, migration 20261023c): gerencia as cinco
// areas do modulo (Recepcao Igreja, Cozinha Igreja, Som / Multimidia,
// Estacionamento, Mesa cracha) -- inclui e tira gente da escala nelas.
export const buscarParaModulo = (equipanteId, dono, area, termo) =>
  chamar('lider_modulo_buscar', {
    ...credenciais(equipanteId, dono),
    p_area: area,
    p_termo: termo
  }, 'busca');

export const incluirNoModulo = (equipanteId, dono, area, pessoaId) =>
  chamar('lider_modulo_incluir', {
    ...credenciais(equipanteId, dono),
    p_area: area,
    p_equipante_id: pessoaId
  }, 'inclusão na área');

export const removerDoModulo = (equipanteId, dono, escalaId) =>
  chamar('lider_modulo_remover', {
    ...credenciais(equipanteId, dono),
    p_escala_id: escalaId
  }, 'remoção da área');

export const removerDaAreaExtra = (equipanteId, dono, area, pessoaId) =>
  chamar('lider_extra_remover', {
    ...credenciais(equipanteId, dono),
    p_area: area,
    p_equipante_id: pessoaId
  }, 'remoção da área extra');
