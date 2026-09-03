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

// Mock client to prevent crashes when config is missing or invalid
const createMockClient = () => {
  console.warn('[Supabase Init] Initializing Supabase Mock Client due to missing or invalid configuration.');
  
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