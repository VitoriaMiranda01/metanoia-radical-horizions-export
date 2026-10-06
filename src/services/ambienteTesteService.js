import { supabase } from '@/services/supabaseClient';

/**
 * Ambiente de teste (migration 20261006i): fichas de teste que seguem o
 * fluxo de verdade -- cadastro, aprovacao, escala, PIX real -- mas ficam
 * fora de tudo o que e oficial (listas, contagens, igrejas, escala real).
 *
 * So as contas Raquel e Desenvolvedores usam; para os outros logins o banco
 * devolve null no painel e recusa as acoes.
 */

const ERROS = {
  SEM_PERMISSAO: 'Só as contas Raquel e Desenvolvedores mexem no ambiente de teste.',
  NAO_E_FICHA_DE_TESTE: 'Essa ficha não é de teste. Atualize o painel.',
  AREA_INVALIDA: 'Essa área não existe na escala.',
  STATUS_INVALIDO: 'Situação inválida.',
  TIPO_INVALIDO: 'Tipo inválido.',
};

const chamar = async (fn, params) => {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) {
    const codigo = Object.keys(ERROS).find((c) => String(error.message || '').includes(c));
    throw new Error(codigo ? ERROS[codigo] : 'Não foi possível concluir. Tente de novo.');
  }
  return data;
};

/** { perfil, escala_teste_em, escala_lancada_em, links, equipantes, acampantes, areas } ou null. */
export const fetchPainelTeste = () => chamar('teste_painel');

export const gerarLinkTeste = (tipo) => chamar('teste_gerar_link', { p_tipo: tipo });
export const desativarLinkTeste = (chave) => chamar('teste_desativar_link', { p_chave: chave });
export const decidirFichaTeste = (id, status) => chamar('teste_decidir', { p_id: id, p_status: status });
export const escalarFichaTeste = (id, area, atuacao) =>
  chamar('teste_escalar', { p_id: id, p_area: area || null, p_atuacao: atuacao || null });
export const lancarEscalaTeste = (lancar) => chamar('teste_lancar_escala', { p_lancar: lancar });
export const pagamentoFichaTeste = (tipo, id, pago) =>
  chamar('teste_pagamento', { p_tipo: tipo, p_id: id, p_pago: pago });
export const apagarFichaTeste = (tipo, id) => chamar('teste_apagar', { p_tipo: tipo, p_id: id });

/** Link do formulario publico que cria ficha de teste. */
export const linkDeCadastroTeste = (tipo, chave) =>
  `${window.location.origin}/${tipo}?chave=${encodeURIComponent(chave)}`;
