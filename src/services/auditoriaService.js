import { supabase } from '@/services/supabaseClient';

/**
 * Auditoria do que os organizadores mudam (migration 20261006g).
 *
 * Quem grava e o banco, sozinho, por gatilho -- o site so le. So a conta
 * "Desenvolvedores" le: para os outros logins auditoria_listar devolve null.
 *
 * Formato: { itens: [...], tem_mais, organizadores: [nomes], total }.
 * Cada item: { id, em, organizador, origem, tabela, operacao, registro_id,
 * registro, mudancas, qtd }. Em "alterou", mudancas e {campo: [antes, depois]};
 * em "incluiu"/"apagou", {campo: valor} com os campos preenchidos.
 */
export const fetchAuditoria = async ({ antes = null, organizador = null, tabela = null, busca = null, limite = 50 } = {}) => {
  const { data, error } = await supabase.rpc('auditoria_listar', {
    p_antes: antes,
    p_organizador: organizador,
    p_tabela: tabela,
    p_busca: busca,
    p_limite: limite,
  });
  if (error) throw error;
  return data || null;
};

export const ROTULO_TABELA = {
  acampantes: 'Acampante',
  equipantes: 'Equipante',
  escalas: 'Escala',
  chamada_escala: 'Chamada da escala',
  disponibilidade_extra: 'Disponibilidade extra',
  configuracoes: 'Configurações',
  cupons: 'Cupom',
  pagamentos: 'Pagamento',
  limites_areas: 'Limite de área',
  limites_igrejas: 'Limite de igreja',
  atuacoes_areas: 'Atuação de área',
  igrejas_parceiras: 'Igreja parceira',
  igrejas_extras: 'Outra igreja',
  organizadores_auth: 'Organizador',
  solicitacoes_senha: 'Pedido de senha',
  cobrancas_acampantes: 'Cobrança',
  grupo_whatsapp_enviado: 'Grupo do WhatsApp',
};

/** "rpc/trocar_area_escala" -> "trocar area escala"; tabela direta -> "edição direta". */
export const descreverOrigem = (origem) => {
  if (!origem) return null;
  if (origem.startsWith('rpc/')) return origem.slice(4).replace(/_/g, ' ');
  return 'edição direta';
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Valor guardado na auditoria, do jeito que a gente le. */
export const formatarValor = (v) => {
  if (v === null || v === undefined || v === '') return 'vazio';
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (typeof v === 'object') return JSON.stringify(v);
  const t = String(v);
  if (ISO.test(t)) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
  }
  const m = t.match(DATA);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
};

export const rotuloCampo = (campo) => campo.replace(/_/g, ' ');
