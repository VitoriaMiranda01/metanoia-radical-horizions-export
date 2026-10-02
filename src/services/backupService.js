import { supabase } from '@/services/supabaseClient';

/**
 * Situacao do backup diario (migration 20261002a).
 *
 * Quem roda o backup e o GitHub Actions, as 03:00, fora do site. O site so
 * le o registro de cada execucao para avisar a conta "Desenvolvedores"
 * quando algo deu errado. A decisao de quem ve e do banco: para qualquer
 * outro login, situacao_backup devolve null.
 *
 * Sem reenvio de proposito, como os selos do menu: se falhar, o proximo
 * ciclo tenta de novo.
 */
export const fetchSituacaoBackup = async () => {
  const { data, error } = await supabase.rpc('situacao_backup');
  if (error) throw error;
  return data || null;
};

/** "Estou ciente" de uma queda brusca. Nao apaga nada, so tira o aviso. */
export const reconhecerAlertaBackup = async (id) => {
  const { error } = await supabase.rpc('reconhecer_alerta_backup', { p_id: id });
  if (error) throw error;
};

const fmtData = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** "equipantes 729 → 50, acampantes 300 → 12" */
export const descreverQuedas = (quedas) =>
  (quedas || []).map((q) => `${q.tabela} ${q.antes} → ${q.agora}`).join(', ');

export const dataDoBackup = fmtData;
