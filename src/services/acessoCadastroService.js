import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Acesso ao cadastro (16/10/2026, Patrick) -- substitui "Você foi inscrito
 * pela organização?". Ver migration 20261016d.
 *
 * Quem decide tudo e o servidor: a janela (dia da Reuniao de Leitura de
 * Escala, 15h-19h), o limite de 5 tentativas por aparelho e o que pode ser
 * dito ("achamos" / "nao achamos" -- nunca dado da ficha).
 */

// Um id por aparelho, so para contar as tentativas no servidor. Sem
// armazenamento (aba anonima), vale para esta aba.
let idDaAba = null;
export const idDoAparelho = () => {
  try {
    let id = localStorage.getItem('metanoia.aparelho');
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem('metanoia.aparelho', id);
    }
    return id;
  } catch {
    if (!idDaAba) idDaAba = `aba-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return idDaAba;
  }
};

const chamar = async (funcao, params, rotulo) => {
  const { data, error } = await comReenvio(() => supabase.rpc(funcao, params), { rotulo });
  if (error) return { ok: false, erro: 'Sem conexão com o servidor agora. Tente de novo em instantes.' };
  return data || { ok: false, erro: 'Resposta vazia do servidor.' };
};

export const situacaoAcessoCadastro = () => chamar('acesso_cadastro_situacao', {}, 'situação do acesso');

export const buscarCadastro = ({ cpf = null, nome = null }) =>
  chamar('acesso_cadastro_buscar', { p_dispositivo: idDoAparelho(), p_cpf: cpf, p_nome: nome }, 'busca do cadastro');

export const pedirAcessoCadastro = ({ nome, cpf, whatsapp, motivo }) =>
  chamar('acesso_cadastro_pedir', {
    p_dispositivo: idDoAparelho(), p_nome: nome, p_cpf: cpf || null, p_whatsapp: whatsapp, p_motivo: motivo
  }, 'pedido de acesso');

// ---- organizacao -------------------------------------------------------

export const listarPedidosAcesso = () => chamar('pedidos_acesso_listar', {}, 'pedidos de acesso');

// acao: 'vincular' | 'juntar' | 'recusar'
export const resolverPedidoAcesso = ({ pedido, acao, equipanteId = null, cpf = null, trocar = false, apagar = null, observacao = null }) =>
  chamar('pedido_acesso_resolver', {
    p_pedido: pedido, p_acao: acao, p_equipante_id: equipanteId, p_cpf: cpf,
    p_trocar: trocar, p_apagar: apagar, p_observacao: observacao
  }, 'pedido de acesso');

export const listarPossiveisDuplicados = () => chamar('possiveis_duplicados', {}, 'possíveis duplicados');

// acao: 'nao_e' | 'juntar' (fica `manter`, some o outro)
export const resolverDuplicado = (a, b, acao, manter = null) =>
  chamar('duplicado_resolver', { p_a: a, p_b: b, p_acao: acao, p_manter: manter }, 'cadastro duplicado');

export const definirDatasReunioes = (inscricao, leitura) =>
  chamar('definir_datas_reunioes', { p_inscricao: inscricao || null, p_leitura: leitura || null }, 'datas das reuniões');
