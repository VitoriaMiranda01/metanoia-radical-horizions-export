import { createClient } from '@supabase/supabase-js';

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

  return {
    from: (table) => mockChain(),
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

export const supabase = isConfigValid
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createMockClient();