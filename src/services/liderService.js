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

/**
 * Link do WhatsApp para um numero cadastrado. Numero brasileiro (10 ou 11
 * digitos) ganha o 55; quem ja veio com 55 ou e estrangeiro vai como esta.
 */
export const linkWhatsApp = (telefone, estrangeiro = false, texto = '') => {
  // Brasileiro: sem o 0 / +55 antes do DDD de numero antigo (digitosTelefone).
  let d = estrangeiro ? String(telefone || '').replace(/\D/g, '') : digitosTelefone(telefone);
  if (!d) return null;
  if (!estrangeiro && (d.length === 10 || d.length === 11)) d = `55${d}`;
  if (d.length < 10) return null;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};
