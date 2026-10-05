import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Relacao do lider (pedido do Patrick, 05/10/2026).
 *
 * Depois que a escala PROVISORIA e lancada, quem esta como lider na escala
 * abre, no proprio acompanhamento, a relacao da sua area (ou da sua cor):
 * nome, igreja e telefone de cada um, a chamada da reuniao de escala, a
 * inclusao por CPF de quem ainda esta sem area e o convite do grupo de
 * WhatsApp.
 *
 * Toda chamada leva a prova de dono (CPF, ou nome + nascimento) MAIS o
 * codigo de 6 digitos que a organizacao entrega ao lider -- quem decide
 * tudo e o servidor (relacao_lider e companhia). Cinco codigos errados
 * seguidos travam por 15 minutos.
 */

const credenciais = (equipanteId, dono = {}, codigo) => ({
  p_id: equipanteId,
  p_cpf: dono.cpf ?? null,
  p_nome: dono.nome ?? null,
  p_nascimento: dono.nascimento ?? null,
  p_codigo: codigo ?? null
});

const chamar = async (funcao, params, rotulo) => {
  const { data, error } = await comReenvio(() => supabase.rpc(funcao, params), { rotulo });
  if (error) return { ok: false, erro: 'Sem conexão com o servidor agora. Tente de novo em instantes.' };
  return data || { ok: false, erro: 'Resposta vazia do servidor.' };
};

export const fetchRelacaoLider = (equipanteId, dono, codigo) =>
  chamar('relacao_lider', credenciais(equipanteId, dono, codigo), 'relação do líder');

// presente: true | false | null (desmarca)
export const marcarPresenca = (equipanteId, dono, codigo, escalaId, presente) =>
  chamar('lider_marcar_presenca', {
    ...credenciais(equipanteId, dono, codigo),
    p_escala_id: escalaId,
    p_presente: presente
  }, 'chamada');

export const buscarPorCpfLider = (equipanteId, dono, codigo, cpf) =>
  chamar('lider_buscar_cpf', {
    ...credenciais(equipanteId, dono, codigo),
    p_cpf_busca: cpf
  }, 'busca por CPF');

export const adicionarPorCpfLider = (equipanteId, dono, codigo, escalaLider, cpf) =>
  chamar('lider_adicionar_por_cpf', {
    ...credenciais(equipanteId, dono, codigo),
    p_escala_lider: escalaLider,
    p_cpf_busca: cpf
  }, 'inclusão na equipe');

export const salvarGrupoLider = (equipanteId, dono, codigo, escalaLider, link) =>
  chamar('lider_salvar_grupo', {
    ...credenciais(equipanteId, dono, codigo),
    p_escala_lider: escalaLider,
    p_link: link
  }, 'link do grupo');

export const marcarConviteLider = (equipanteId, dono, codigo, escalaId) =>
  chamar('lider_marcar_convite', {
    ...credenciais(equipanteId, dono, codigo),
    p_escala_id: escalaId
  }, 'convite do grupo');

/**
 * Link do WhatsApp para um numero cadastrado. Numero brasileiro (10 ou 11
 * digitos) ganha o 55; quem ja veio com 55 ou e estrangeiro vai como esta.
 */
export const linkWhatsApp = (telefone, estrangeiro = false, texto = '') => {
  let d = String(telefone || '').replace(/\D/g, '');
  if (!d) return null;
  if (!estrangeiro && (d.length === 10 || d.length === 11)) d = `55${d}`;
  if (d.length < 10) return null;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};
