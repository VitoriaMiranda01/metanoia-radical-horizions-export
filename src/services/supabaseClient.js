import { createClient } from '@supabase/supabase-js';
import { getAuthToken } from '@/services/authToken';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validacao critica: sem essas variaveis o app nao tem como falar com o
// banco. Nao lanca excecao aqui de proposito (ver createMockClient logo
// abaixo) pra nao derrubar a tela inteira -- so loga o erro claramente.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase Init Error] Missing Supabase environment variables. Please check your .env file.');
}

// Validate environment variables
const validateConfig = () => {
  if (!supabaseUrl) return false;
  if (!supabaseAnonKey) return false;
  if (supabaseUrl.includes('your-project-url') || supabaseAnonKey.includes('your-anon-key')) {
    console.warn('[Supabase Init] Credentials appear to be placeholders. Please update your .env file.');
    return false;
  }
  return true;
};

const isConfigValid = validateConfig();

// Exibe um aviso visivel na tela quando o app sobe sem conexao real com o banco
// (config ausente/placeholder). Assim uma configuracao errada em producao nao
// passa despercebida, em vez de falhar silenciosamente.
const showMockConfigBanner = () => {
  try {
    if (typeof document === 'undefined') return;
    const mount = () => {
      if (document.getElementById('supabase-mock-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'supabase-mock-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = 'Atenção: o sistema está sem conexão com o banco de dados (configuração ausente). Contate o responsável técnico.';
      banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
        'background:#b00020', 'color:#fff', 'padding:10px 16px',
        'font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
        'text-align:center', 'box-shadow:0 2px 8px rgba(0,0,0,.3)'
      ].join(';');
      document.body.appendChild(banner);
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  } catch (_) {
    // nunca deixar o aviso quebrar o app
  }
};

// Mock client to prevent crashes when config is missing or invalid
const createMockClient = () => {
  console.warn('[Supabase Init] Initializing Supabase Mock Client due to missing or invalid configuration.');
  showMockConfigBanner();

  const mockResponse = { 
    data: null, 
    error: { 
      message: 'Supabase is not configured correctly. Please check your environment variables.',
      code: 'CONFIG_ERROR'
    } 
  };

  const mockChain = () => ({
    select: () => mockChain(),
    insert: async () => mockResponse,
    upsert: async () => mockResponse,
    update: () => mockChain(),
    delete: () => mockChain(),
    eq: () => mockChain(),
    neq: () => mockChain(),
    gt: () => mockChain(),
    lt: () => mockChain(),
    gte: () => mockChain(),
    lte: () => mockChain(),
    in: () => mockChain(),
    is: () => mockChain(),
    like: () => mockChain(),
    ilike: () => mockChain(),
    contains: () => mockChain(),
    range: () => mockChain(),
    order: () => mockChain(),
    limit: () => mockChain(),
    single: async () => mockResponse,
    maybeSingle: async () => mockResponse,
  });

  // O cliente falso precisa ter TODAS as superficies que o app usa. Se faltar
  // alguma, o erro deixa de ser "banco nao configurado" (tratado, com aviso na
  // tela) e vira "X is not a function" -- excecao nao tratada que derruba a
  // renderizacao. Era o que acontecia com rpc() e channel(), e o resultado era
  // uma tela em branco em vez do aviso vermelho.
  const canalFalso = {
    on: () => canalFalso,
    subscribe: () => canalFalso,
    unsubscribe: async () => ({ error: null }),
  };

  return {
    from: (table) => mockChain(),
    rpc: async () => mockResponse,
    channel: () => canalFalso,
    removeChannel: async () => ({ error: null }),
    functions: {
      invoke: async () => mockResponse,
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => mockResponse,
      signUp: async () => mockResponse,
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => mockResponse,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      })
    }
  };
};

/**
 * O CRACHA PASSA A ACOMPANHAR AS CONSULTAS (Passo 2, etapa 6)
 * -----------------------------------------------------------
 * Ate aqui, TODA consulta ao banco saia como "anon" -- o visitante
 * deslogado -- mesmo vinda de um organizador logado. Era por isso que as
 * tabelas precisavam ficar abertas para anon: sem isso, nenhuma tela
 * administrativa enxergaria nada.
 *
 * Agora, quando existe um cracha guardado (emitido pela Edge Function de
 * login e assinado com o segredo do projeto), a biblioteca o envia em cada
 * consulta. O banco passa a saber QUEM esta perguntando, e as travas de
 * RLS conseguem distinguir organizador, parceiro e visitante.
 *
 * Quando nao ha cracha, a funcao devolve null e a biblioteca usa a chave
 * anonima -- exatamente como antes. Por isso esta mudanca, sozinha, nao
 * altera o comportamento de nada: ela so passa a informar o banco. O que
 * muda o acesso e o script de travas
 * (database/migrations/schema-update-20260911c-trancar-tabelas.sql).
 *
 * Nota: com "accessToken" definido, a biblioteca desabilita o namespace
 * supabase.auth. Nao e perda nenhuma -- este projeto nunca usou Supabase
 * Auth de verdade (ver AuthContext.jsx).
 */
/**
 * Rede de seguranca para cracha recusado pelo banco.
 *
 * A conferencia de validade em authToken.js pega o caso comum (cracha
 * vencido), mas nao pega um cracha que esta DENTRO da validade e mesmo
 * assim e recusado -- por exemplo um assinado com um segredo anterior,
 * depois de uma troca de chave.
 *
 * Nesses casos o banco responde 401 com o codigo PGRST301 ("nao consegui
 * decodificar o JWT"). Sem tratamento, a pessoa ficaria "logada" com todas
 * as listas vazias e sem nenhuma pista do que fazer.
 *
 * Aqui, ao ver esse erro uma vez, a sessao e descartada e a pessoa vai
 * para o login. Trata-se de uma unica vez por carregamento de pagina, para
 * nao entrar em laco.
 */
let sessaoJaDescartada = false;

const derrubarSessaoInvalida = () => {
  if (sessaoJaDescartada) return;
  sessaoJaDescartada = true;
  try {
    ['metanoia_access_token', 'metanoia_user', 'metanoia_org_user', 'metanoia_igreja_user']
      .forEach((chave) => localStorage.removeItem(chave));
  } catch (_) { /* ignora */ }
  try {
    if (typeof window !== 'undefined') window.location.replace('/login');
  } catch (_) { /* ignora */ }
};

const fetchComTratamentoDeCracha = async (input, init) => {
  const resposta = await fetch(input, init);

  // Só interessa 401 vindo do banco (PostgREST). O login em si devolve 401
  // para senha errada e não deve derrubar sessão nenhuma.
  const alvo = String(typeof input === 'string' ? input : input?.url || '');
  if (resposta.status === 401 && alvo.includes('/rest/v1/')) {
    try {
      const corpo = await resposta.clone().json();
      if (corpo?.code === 'PGRST301') derrubarSessaoInvalida();
    } catch (_) { /* corpo não era JSON -- ignora */ }
  }

  return resposta;
};

export const supabase = isConfigValid
  ? createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => getAuthToken(),
      global: { fetch: fetchComTratamentoDeCracha },
    })
  : createMockClient();