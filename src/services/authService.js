import { supabase } from '@/services/supabaseClient';

/**
 * Login de organizador e de igreja parceira.
 *
 * MUDANCA DE SEGURANCA (Passo 1 da Fase 2)
 * ----------------------------------------
 * Antes, estas funcoes liam a linha do usuario direto das tabelas
 * "organizadores_auth" / "igrejas_parceiras" com select('*') -- o que trazia a
 * coluna "senha" (hash bcrypt) para dentro do navegador -- e comparavam a
 * senha aqui, com bcryptjs. Como a chave anonima e publica (vai no bundle JS),
 * isso significava que QUALQUER visitante conseguia baixar os hashes de senha
 * de todos os administradores e de todas as igrejas e quebra-los offline.
 *
 * Agora a conferencia acontece no servidor, na Edge Function "login", que usa
 * a service_role (secreta, nunca exposta). O hash nunca chega ao navegador.
 * Isso e o que permite revogar a leitura anonima dessas duas tabelas no banco.
 *
 * O retorno continua no mesmo formato de antes ({ success, user, error }),
 * acrescido de "token", para nao exigir mudancas nas telas.
 */

const GENERIC_ERROR = 'Usuário ou senha inválidos';
const UNAVAILABLE_ERROR = 'Não foi possível fazer login. Tente novamente.';

// A Edge Function responde 401 para credencial invalida e 5xx para falha de
// servico. O supabase-js transforma respostas fora da faixa 2xx em "error",
// entao aqui olhamos o status para escolher a mensagem certa -- sem nunca
// revelar se o usuario existe ou nao (mesma mensagem para os dois casos).
const ACESSO_NAO_LIBERADO =
  'O acesso desta igreja ainda não foi liberado. Fale com a organização.';

// A Edge Function responde 403 quando a senha ESTA certa mas a igreja ainda
// nao teve o primeiro acesso liberado por um organizador. Esse caso precisa
// de uma mensagem propria: dizer "usuário ou senha inválidos" mandaria a
// pessoa procurar um erro que nao existe (e encheria a fila de pedidos de
// senha nova sem necessidade).
//
// Como so chega aqui quem JA acertou a senha, a mensagem nao revela nada a
// quem esta tentando adivinhar.
const mensagemParaErro = async (error) => {
  const status = error?.context?.status;
  if (status === 401 || status === 400) return GENERIC_ERROR;
  if (status === 403) {
    // O supabase-js entrega a resposta crua em error.context. Se por algum
    // motivo nao der para ler o corpo, o texto fixo diz a mesma coisa.
    try {
      const corpo = await error.context.clone().json();
      if (typeof corpo?.error === 'string' && corpo.error) return corpo.error;
    } catch {
      /* segue com o texto fixo */
    }
    return ACESSO_NAO_LIBERADO;
  }
  return UNAVAILABLE_ERROR;
};

const chamarLogin = async (tipo, identifier, senha) => {
  try {
    if (!identifier || !senha) {
      return { success: false, error: GENERIC_ERROR };
    }

    const { data, error } = await supabase.functions.invoke('login', {
      body: { tipo, identifier: String(identifier).trim(), senha },
    });

    if (error) {
      console.error(`[AuthHelper] login (${tipo}) - falha na função:`, error?.message || error);
      return { success: false, error: await mensagemParaErro(error) };
    }

    if (!data?.success || !data?.user) {
      return { success: false, error: data?.error || GENERIC_ERROR };
    }

    // precisa_trocar_senha: a conta esta com senha temporaria (primeiro acesso
    // ou redefinicao feita por um organizador). Quem decide o que fazer com
    // isso e o AuthContext -- aqui so repassamos o que o servidor disse.
    return {
      success: true,
      user: data.user,
      token: data.token,
      precisa_trocar_senha: data.precisa_trocar_senha === true,
    };
  } catch (err) {
    console.error(`[AuthHelper] login (${tipo}) - exceção:`, err?.message || err);
    return { success: false, error: UNAVAILABLE_ERROR };
  }
};

export const organizadorLogin = async (nome, senha) => chamarLogin('organizador', nome, senha);

export const igrejaLogin = async (codigo, senha) => chamarLogin('igreja', codigo, senha);
