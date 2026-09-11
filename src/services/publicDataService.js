import { supabase } from '@/services/supabaseClient';

/**
 * Acesso publico ao banco, via funcoes controladas (RPC).
 *
 * POR QUE ESTA CAMADA EXISTE
 * --------------------------
 * Ate aqui, o visitante DESLOGADO falava direto com as tabelas para se
 * inscrever, conferir se ja tinha cadastro, ver o preco e validar cupom.
 * Isso obrigava a chave anonima (publica, visivel no bundle JS) a ter acesso
 * amplo -- e era por isso que a base inteira ficava legivel por qualquer um.
 *
 * Agora cada uma dessas quatro coisas passa por uma funcao no servidor que
 * devolve SO o necessario:
 *
 *   antes                                      agora
 *   ------------------------------------------ --------------------------
 *   select('*') em acampantes pra checar CPF -> { existe, pago, id, nome }
 *   select('*') em cupons                    -> { valido, desconto }
 *   baixar todos os acampantes pra contar    -> { igreja: quantidade }
 *   select em configuracoes (com CPFs)       -> config sem as colunas de CPF
 *   insert direto na tabela                  -> servidor manda nos campos
 *                                               sensiveis e devolve so o id
 *
 * As funcoes estao em
 * database/migrations/schema-update-20260911b-rpcs-publicas.sql
 *
 * Nota: as telas de organizador continuam lendo as tabelas direto -- elas
 * precisam do dado completo, e vao ser liberadas por RLS pelo papel de quem
 * esta logado.
 */

const chamar = async (funcao, args = undefined) => {
  const { data, error } = await supabase.rpc(funcao, args);
  if (error) throw error;
  return data;
};

/**
 * Configuracao publica do evento: preco, datas e se as inscricoes estao
 * abertas. Nao traz cpfs_area_guia / cpfs_area_inimigo /
 * cpfs_area_espirito_santo, que sao listas internas e hoje vazam junto.
 */
export const fetchConfigPublica = async () => chamar('config_publica');

/**
 * Responde "essa pessoa ja tem inscricao?" sem devolver a ficha dela.
 * Quando ja pagou, devolve so { existe: true, pago: true } -- nem o nome.
 * Quando nao pagou, devolve tambem id e nome, porque a tela leva a pessoa
 * direto para o pagamento pendente.
 */
export const verificarInscricaoPublica = async ({ tipo, cpf = null, nome = null }) =>
  chamar('verificar_inscricao', { p_tipo: tipo, p_cpf: cpf, p_nome: nome });

/** { "NOME DA IGREJA": quantidade } -- sem baixar a base de acampantes. */
export const fetchOcupacaoIgrejas = async () => chamar('ocupacao_igrejas');

/** { valido, desconto } -- sem permitir listar os cupons. */
export const validarCupomPublico = async (codigo) =>
  chamar('validar_cupom', { p_codigo: codigo });

/**
 * Cria a inscricao. Recebe o mesmo objeto ja mapeado que o site sempre
 * montou; o servidor e que passa a decidir status de pagamento, dados de
 * transacao, aprovacao e grupo de trilha. Devolve so o id.
 */
export const criarInscricaoPublica = async (tipo, dados) =>
  chamar('criar_inscricao', { p_tipo: tipo, p_dados: dados });
