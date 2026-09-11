/**
 * Guarda o "cracha" (JWT) devolvido pela Edge Function de login.
 *
 * O cracha acompanha cada consulta ao banco (ver a opcao accessToken em
 * supabaseClient.js), e e por ele que o banco sabe se quem esta
 * perguntando e organizador, parceiro ou visitante.
 *
 * POR QUE A VALIDADE E CONFERIDA AQUI
 * -----------------------------------
 * O cracha vale 8 horas. Depois disso -- ou se o segredo de assinatura for
 * trocado -- o banco passa a recusar toda consulta com 401.
 *
 * Sem a conferencia abaixo, o resultado para a pessoa seria o pior
 * possivel: ela continuaria "logada" pelas aparencias (o nome no topo, o
 * acesso as telas), mas TODAS as listas apareceriam vazias, sem nenhuma
 * explicacao. Ela nao teria motivo nenhum para desconfiar que bastava
 * sair e entrar de novo.
 *
 * Entao: cracha vencido ou ilegivel e descartado na hora, junto com a
 * sessao. A pessoa cai na tela de login, que e um problema obvio e com
 * solucao obvia.
 */

const TOKEN_KEY = 'metanoia_access_token';

// Mesmas chaves usadas pelo AuthContext.
const CHAVES_DE_SESSAO = [
  TOKEN_KEY,
  'metanoia_user',
  'metanoia_org_user',
  'metanoia_igreja_user',
];

// Margem de seguranca: um cracha que vence nos proximos 30 segundos ja e
// tratado como vencido, para nao morrer no meio de uma consulta.
const MARGEM_SEGUNDOS = 30;

const estaVencido = (token) => {
  try {
    const [, parte] = String(token).split('.');
    if (!parte) return true;

    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(base64));

    if (typeof exp !== 'number') return true;
    return exp - MARGEM_SEGUNDOS <= Math.floor(Date.now() / 1000);
  } catch (_) {
    // Ilegivel = inservivel.
    return true;
  }
};

export const setAuthToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } catch (_) {
    // localStorage pode falhar (navegacao privada, etc.) -- nao quebrar o login
  }
};

export const getAuthToken = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    if (estaVencido(token)) {
      // Descarta a sessao inteira: sem cracha valido as telas nao teriam
      // dado nenhum para mostrar, e ficar "logado" so confundiria.
      CHAVES_DE_SESSAO.forEach((chave) => {
        try { localStorage.removeItem(chave); } catch (_) { /* ignora */ }
      });
      return null;
    }

    return token;
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
