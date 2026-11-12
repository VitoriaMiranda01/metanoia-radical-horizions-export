import { supabase } from '@/services/supabaseClient';

/**
 * Permissoes por organizador (03/11/2026, migration 20261103b).
 *
 * O login Desenvolvedores marca o que cada organizador pode fazer. Quem
 * decide de verdade e o BANCO (org_pode): aqui e so para montar o menu e
 * esconder botoes. Configuracoes, Saude, Backup, Portaria, Recepcao (com
 * Crachas e Onibus) e Senhas dos parceiros nao tem caixa: so Desenvolvedores.
 */
export const PERMISSOES = [
  { chave: 'gerenciar_inscricoes', rotulo: 'Gerenciar inscrições',
    descricao: 'Lista de acampantes e equipantes: ver, editar, exportar, camisas, avisos, vínculos e grupos de trilha dos acampantes.' },
  { chave: 'inscricao_manual', rotulo: 'Inscrição manual',
    descricao: 'Cadastrar na hora o equipante que chegou sem inscrição.' },
  { chave: 'aprovacao_equipe', rotulo: 'Aprovação da equipe',
    descricao: 'Aprovar ou recusar equipantes, aprovação em lote e liberação dos menores de idade.' },
  { chave: 'geracao_escala', rotulo: 'Geração de escala',
    descricao: 'Montar a escala: alocar, tirar, fixos, áreas especiais, cores, chamada e ausentes.' },
  { chave: 'responsavel_reuniao', rotulo: 'Responsável pela reunião',
    descricao: 'Definir quem conduz a reunião da escala no lugar do líder.' },
  { chave: 'troca_diaria', rotulo: 'Troca diária',
    descricao: 'Trocar alguém de área depois que a escala foi lançada.' },
  { chave: 'lancamento_escala', rotulo: 'Lançamento da escala oficial',
    descricao: 'Lançar e desfazer a escala provisória e a oficial.' },
  { chave: 'pagamentos', rotulo: 'Pagamentos',
    descricao: 'Confirmar e desfazer pagamentos, cobranças, agendamentos e débitos.' },
  { chave: 'ocorrencias', rotulo: 'Ocorrências anteriores',
    descricao: 'Módulo em Configurações: quem recebe o comunicado e o asterisco vermelho, e as declarações de ciência.' },
  { chave: 'solicitacoes_fichas', rotulo: 'Solicitações de fichas',
    descricao: 'Aprovar ou recusar os pedidos de fichas das igrejas parceiras (aprovar soma ao limite da igreja) e mandar a mensagem no WhatsApp.' },
];

// Telas da Escala: entra quem tem qualquer uma destas.
export const PERMISSOES_DA_ESCALA = [
  'geracao_escala', 'responsavel_reuniao', 'troca_diaria', 'lancamento_escala', 'inscricao_manual',
];

export const fetchMinhasPermissoes = async () => {
  const { data, error } = await supabase.rpc('minhas_permissoes');
  if (error) throw error;
  return {
    maximo: data?.maximo === true,
    permissoes: Array.isArray(data?.permissoes) ? data.permissoes : [],
  };
};

export const definirPermissoesOrganizador = async (nome, permissoes) => {
  const { data, error } = await supabase.rpc('definir_permissoes_organizador', {
    p_nome: nome, p_permissoes: permissoes,
  });
  if (error) throw error;
  return data;
};
