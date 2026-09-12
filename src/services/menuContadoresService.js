import { supabase } from '@/services/supabaseClient';

/**
 * Os numeros dos selos vermelhos no cabecalho.
 *
 * Uma unica chamada devolve os tres: aprovacoes de equipante esperando,
 * cobrancas PIX travadas e pedidos de senha de parceiro em aberto. A conta e
 * feita no banco (contadores_do_menu, migration 20260912s) -- o cabecalho
 * aparece em toda tela do organizador e se atualiza sozinho, entao baixar as
 * listas inteiras so para contar seria desperdicio a cada minuto.
 *
 * Nao usa reenvio de proposito: se falhar, o proximo ciclo tenta de novo. Um
 * selo que demora um minuto a mais nao atrapalha ninguem; insistir na hora,
 * sim.
 */
export const fetchContadoresDoMenu = async () => {
  const { data, error } = await supabase.rpc('contadores_do_menu');
  if (error) throw error;
  return {
    aprovacoes: Number(data?.aprovacoes) || 0,
    pagamentos: Number(data?.pagamentos) || 0,
    senhas: Number(data?.senhas) || 0,
  };
};
