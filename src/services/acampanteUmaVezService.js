import { supabase } from '@/services/supabaseClient';

/**
 * Acampante so uma vez (04/11/2026, migration 20261104b).
 *
 * A virada guarda a "impressao digital" do CPF de quem ficou presente na
 * recepcao; esse CPF nao se inscreve de novo como acampante. So a conta
 * Desenvolvedores ve o resumo e libera um CPF (com motivo). Para os outros
 * logins o banco devolve { ok: false } e o quadro nem aparece.
 */
const rpc = async (nome, args) => {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw error;
  return data;
};

export const fetchBloqueioAcampantes = () => rpc('acampantes_bloqueio_resumo');

export const liberarCpfAcampante = (cpf, motivo) =>
  rpc('liberar_cpf_acampante', { p_cpf: String(cpf || '').replace(/\D/g, ''), p_motivo: motivo });

export const desfazerLiberacaoAcampante = (id) =>
  rpc('desfazer_liberacao_acampante', { p_id: id });
