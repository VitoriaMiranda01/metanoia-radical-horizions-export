/**
 * Guarda o "cracha" (JWT) devolvido pela Edge Function de login.
 *
 * IMPORTANTE (Passo 1): por enquanto este token e apenas GUARDADO. O acesso
 * aos dados continua funcionando exatamente como antes (chave anonima). Ele
 * passa a ser enviado nas consultas no Passo 2, quando as tabelas forem
 * trancadas por RLS baseada no claim "user_role" -- as duas coisas precisam
 * entrar juntas, senao o site pararia de enxergar os dados.
 *
 * Guardar em localStorage e o mesmo nivel de exposicao que a sessao atual do
 * app ja usa (metanoia_user etc.), entao isso nao piora nada agora.
 */

const TOKEN_KEY = 'metanoia_access_token';

export const setAuthToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } catch (_) {
    // localStorage pode falhar (navegacao privada, etc.) -- nao quebrar o login
  }
};

export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (_) {
    return null;
  }
};

export const clearAuthToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (_) {
    // idem
  }
};
