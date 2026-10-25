import { supabase } from '@/services/supabaseClient';

/**
 * Apagamento automatico da LGPD do equipante (migration 20261024n).
 *
 * Quem apaga e o banco, sozinho, todo dia as 03:30 (pg_cron). O site so le a
 * situacao: proximos prazos, a ultima execucao e o registro do que saiu (so o
 * codigo interno -- sem nome nem CPF). Para qualquer login que nao seja a
 * conta "Desenvolvedores", lgpd_situacao devolve null.
 */
export const fetchSituacaoLgpd = async () => {
  const { data, error } = await supabase.rpc('lgpd_situacao');
  if (error) throw error;
  return data || null;
};

export const ROTULO_TIPO_LGPD = {
  dados_da_edicao: 'Dados da edição',
  cadastro: 'Cadastro inteiro',
  arquivo_autorizacao: 'Arquivo da autorização',
};
