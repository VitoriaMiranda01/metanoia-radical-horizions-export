import { supabase } from '@/services/supabaseClient';

/**
 * Solicitacao de fichas de acampante (12/11/2026, migration 20261112a).
 *
 * O parceiro pede N fichas para a igreja; o organizador com a caixa
 * 'solicitacoes_fichas' aprova (soma ao limite da igreja) ou recusa e manda a
 * mensagem pronta no WhatsApp (envio manual). Quem decide e o banco.
 */

const resposta = (data, error) => {
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.erro || 'Não foi possível concluir.');
  return data;
};

// Parceiro
export const minhasSolicitacoesFichas = async () => {
  const { data, error } = await supabase.rpc('minhas_solicitacoes_fichas');
  if (error) throw error;
  return { igrejas: data?.igrejas || [], pedidos: data?.pedidos || [] };
};

export const solicitarFichas = async ({ igrejaCodigo, quantidade, contatoNome, contatoWhatsapp, observacao }) => {
  const { data, error } = await supabase.rpc('solicitar_fichas', {
    p_igreja_codigo: igrejaCodigo,
    p_quantidade: quantidade,
    p_contato_nome: contatoNome,
    p_contato_whatsapp: contatoWhatsapp,
    p_observacao: observacao || null,
  });
  return resposta(data, error);
};

export const cancelarSolicitacaoFichas = async (id) => {
  const { data, error } = await supabase.rpc('cancelar_solicitacao_fichas', { p_id: id });
  return resposta(data, error);
};

// Organizador
export const listarSolicitacoesFichas = async () => {
  const { data, error } = await supabase.rpc('listar_solicitacoes_fichas');
  if (error) throw error;
  return { config: data?.config || {}, itens: data?.itens || [] };
};

export const aprovarSolicitacaoFichas = async (id, quantidade) => {
  const { data, error } = await supabase.rpc('aprovar_solicitacao_fichas', { p_id: id, p_quantidade: quantidade });
  return resposta(data, error);
};

export const recusarSolicitacaoFichas = async (id, motivo) => {
  const { data, error } = await supabase.rpc('recusar_solicitacao_fichas', { p_id: id, p_motivo: motivo || null });
  return resposta(data, error);
};

export const marcarMensagemFichas = async (id) => {
  const { data, error } = await supabase.rpc('marcar_mensagem_fichas', { p_id: id });
  return resposta(data, error);
};

// Mensagem pronta para o organizador mandar depois de aprovar.
const dataBR = (iso) => {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : null;
};

export const mensagemFichasAprovadas = (item, config = {}, site = 'https://metanoiaradicalserra.com.br') => {
  const qtd = Number(item?.quantidade_aprovada) || 0;
  const codigo = String(item?.igreja || '').split(' - ')[0];
  const nomeIgreja = String(item?.igreja || '').replace(/^\s*\d+\s*-\s*/, '');
  const primeiro = String(item?.contato_nome || '').trim().split(/\s+/)[0] || '';
  const limite = dataBR(config.data_limite);
  const linhas = [
    `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é da organização do Metanoia Radical Serra${config.edicao ? ` (${config.edicao}ª edição)` : ''}.`,
    '',
    `A solicitação de *${qtd} ${qtd === 1 ? 'ficha' : 'fichas'}* da igreja *${nomeIgreja}* foi *aprovada*.`,
    '',
    'Para fazer a inscrição dos acampantes:',
    `1. Entre no link de inscrição de acampante: ${site}/acampante ;`,
    `2. Na "Igreja responsável pela inscrição", informe o código *${codigo}* (${nomeIgreja});`,
    '3. Preencha a ficha e faça o pagamento.',
  ];
  if (limite) linhas.push('', `Data limite para inscrição e pagamento: *${limite}*.`);
  linhas.push('', 'Qualquer dúvida, estamos à disposição. Deus abençoe!');
  return linhas.join('\n');
};
