import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Remover acampante (20/10/2026, Patrick). Antes o botao Excluir apagava a
 * linha direto, sem guardar nada. Agora sao duas saidas, e quem decide tudo e
 * o banco (migration 20261020a):
 *  - desistencia: a ficha muda para o arquivo de desistentes (some de todas
 *    as telas, da para restaurar na mesma edicao; dados pessoais e endereco
 *    voltam preenchidos numa inscricao futura; o arquivo apaga sozinho 180
 *    dias depois da inscricao);
 *  - exclusao completa: nao sobra nome, CPF nem ficha.
 * Quem ja pagou nao sai; PIX ainda valido tambem trava.
 */
const chamar = async (funcao, params, rotulo) => {
  const { data, error } = await comReenvio(() => supabase.rpc(funcao, params), { rotulo });
  if (error) return { ok: false, erro: error.message || 'Sem conexão com o servidor agora.' };
  return data || { ok: false, erro: 'Resposta vazia do servidor.' };
};

export const desistirAcampante = (id, observacao) =>
  chamar('desistir_acampante', { p_id: id, p_observacao: observacao || null }, 'desistência do acampante');

export const excluirAcampanteDefinitivo = (id, confirmacao, motivo) =>
  chamar('excluir_acampante_definitivo', { p_id: id, p_confirmacao: confirmacao, p_motivo: motivo }, 'exclusão do acampante');

export const listarDesistentes = () => chamar('listar_desistentes', {}, 'lista de desistentes');

export const restaurarDesistente = (id) => chamar('restaurar_desistente', { p_id: id }, 'restaurar desistente');

export const apagarDesistente = (id, confirmacao, motivo) =>
  chamar('apagar_desistente', { p_id: id, p_confirmacao: confirmacao, p_motivo: motivo }, 'apagar desistente');

/** Mesma regra do banco, so para a tela avisar antes de a pessoa tentar. */
export const bloqueioDeSaida = (a) => {
  const pago = ['pago', 'confirmado', 'completed'].includes(String(a?.status_pagamento || '').toLowerCase());
  if (!pago) return null;
  return ['manual', 'isento'].includes(String(a?.metodo_pagamento || '').toLowerCase())
    ? 'Este acampante já tem pagamento confirmado. Desfaça o pagamento em Pagamentos antes.'
    : 'Este acampante pagou pelo PIX, e esse pagamento não pode ser desfeito pela tela. Fale com os Desenvolvedores.';
};
