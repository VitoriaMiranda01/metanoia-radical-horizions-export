import { supabase } from '@/services/supabaseClient';
import { ehFalhaPassageira } from '@/services/serviceHelpers';

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

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma falha de REDE nao e uma resposta -- e a ausencia dela.
 *
 * Num teste, a home apareceu uma vez com "Data nao configurada" e "Valores
 * indisponiveis" porque a chamada simplesmente nao completou. Cinquenta
 * tentativas seguidas depois nao reproduziram: foi um tropeco passageiro.
 * Mas no dia da abertura, com centenas de pessoas entrando ao mesmo tempo,
 * um tropeco desses vai acontecer com alguem -- e essa pessoa veria o evento
 * "sem data e sem valor" e poderia desistir achando que o sistema esta
 * errado.
 *
 * Por isso: erro sem resposta do servidor (queda de rede, timeout, CORS por
 * falha de borda) ou erro 5xx sao tentados de novo. Erro com resposta --
 * permissao negada, dado invalido, regra de negocio -- nao sao: tentar de
 * novo daria o mesmo resultado e so atrasaria a pessoa.
 */
// A regra de "vale tentar de novo?" mora em serviceHelpers.js, para as telas
// publicas e as do organizador seguirem exatamente o mesmo criterio.
const valeTentarDeNovo = ehFalhaPassageira;

const chamar = async (funcao, args = undefined, { tentativas = 3, esperaBase = 600 } = {}) => {
  let ultimoErro;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const { data, error } = await supabase.rpc(funcao, args);
    if (!error) return data;

    ultimoErro = error;
    if (tentativa === tentativas || !valeTentarDeNovo(error)) break;

    // Espera crescente, para não insistir em cima de um servidor já ocupado.
    await espera(esperaBase * 2 ** (tentativa - 1) + Math.random() * 200);
    console.warn(`[dados públicos] ${funcao}: tentativa ${tentativa} falhou, tentando de novo`);
  }

  throw ultimoErro;
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
/**
 * Sem reenvio automatico aqui, de proposito.
 *
 * Se a rede cair no meio de uma criacao, nao da para saber se a inscricao
 * entrou ou nao. Repetir por conta propria poderia gravar a mesma pessoa
 * duas vezes -- e, pior, consumir duas vagas da igreja. O reenvio controlado
 * dessa operacao fica em inscricoesService.js, que sabe distinguir erro
 * passageiro de erro de regra (CPF duplicado, limite da igreja).
 */
export const criarInscricaoPublica = async (tipo, dados) =>
  chamar('criar_inscricao', { p_tipo: tipo, p_dados: dados }, { tentativas: 1 });

/**
 * Status de UMA cobranca PIX, pelo txid.
 *
 * A tela de pagamento nao tinha como saber que o dinheiro entrou -- ficava
 * parada no QR Code para sempre, mesmo depois do pagamento confirmado. Com
 * isto ela consegue perguntar de tempos em tempos e mostrar a confirmacao.
 *
 * Devolve so { encontrado, status, pago, inscricao_liberada, expirado }.
 */
export const consultarStatusPix = async (txid) =>
  chamar('status_pagamento_pix', { p_txid: txid });
