// Helpers internos compartilhados entre os arquivos de src/services/.

export const handleSupabaseError = (error, context) => {
  if (error) {
    console.error(`Error in ${context}:`, error.message || error);
    throw new Error(error.message || 'Unknown error occurred');
  }
};

/**
 * Vale tentar de novo?
 *
 * Regra unica do projeto, usada tanto aqui quanto em publicDataService.js.
 *
 * Ter um CODIGO significa que o servidor RESPONDEU -- recusando por permissao
 * (42501), por dado invalido (22xxx), por regra de negocio levantada no banco
 * (P0001, como o limite de acampantes por igreja) ou pelo PostgREST
 * (PGRST301). Repetir daria exatamente a mesma resposta e so atrasaria a
 * pessoa.
 *
 * Reenvio existe para quando a resposta NAO CHEGOU: queda de rede, timeout,
 * ou erro 5xx do servidor.
 */
export const ehFalhaPassageira = (error) => {
  if (!error) return false;
  const status = Number(error?.status ?? error?.context?.status);
  if (Number.isFinite(status)) return status >= 500;
  if (error?.code) return false;
  return true;
};

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reenvio para chamadas do Supabase, que NAO lancam excecao -- devolvem
 * { data, error }.
 *
 * Era esse o furo do withRetry antigo: ele so reagia a excecao, e como o
 * supabase-js devolve o erro dentro do objeto, o reenvio nunca disparava.
 * Na pratica as telas do organizador nao tinham protecao nenhuma contra uma
 * falha passageira de rede -- e o sintoma era a tela abrir incompleta, sem
 * dizer por que.
 *
 * Devolve o mesmo { data, error } de sempre, entao quem chama nao muda.
 *
 * USE SO EM LEITURA E EM ESCRITA IDEMPOTENTE (atualizar um registro conhecido
 * para um valor fixo, apagar por id). NUNCA em insercao: se a rede cair no
 * meio, nao da para saber se gravou, e repetir criaria duplicata.
 */
export const comReenvio = async (operacao, { tentativas = 3, esperaBase = 600, rotulo = '' } = {}) => {
  let ultimo = { data: null, error: null };

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      ultimo = await operacao();
    } catch (erro) {
      // Algumas funcoes lancam em vez de devolver o erro; trata os dois casos.
      ultimo = { data: null, error: erro };
    }

    if (!ultimo?.error) return ultimo;
    if (tentativa === tentativas || !ehFalhaPassageira(ultimo.error)) return ultimo;

    await espera(esperaBase * 2 ** (tentativa - 1) + Math.random() * 200);
    console.warn(`[reenvio]${rotulo ? ' ' + rotulo : ''}: tentativa ${tentativa} falhou, tentando de novo`);
  }

  return ultimo;
};

/**
 * Versao antiga, mantida para quem envolve uma funcao que LANCA excecao.
 * Para chamadas do Supabase use comReenvio, acima.
 */
export const withRetry = async (operation, retries = 3, delay = 1000) => {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) throw error;
    if (!ehFalhaPassageira(error)) throw error;
    console.warn(`Retrying operation... (${retries} attempts left)`);
    await espera(delay);
    return withRetry(operation, retries - 1, delay * 2);
  }
};
