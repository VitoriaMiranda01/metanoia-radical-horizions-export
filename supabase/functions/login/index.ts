// Edge Function: login
//
// POR QUE ISSO EXISTE
// -------------------
// Antes, o login era feito no navegador: o site baixava a linha inteira do
// usuario das tabelas "organizadores_auth" / "igrejas_parceiras" -- INCLUINDO
// a coluna "senha" (hash bcrypt) -- e comparava a senha ali. Isso obrigava a
// chave anonima (publica, visivel no bundle JS) a poder ler essas tabelas, ou
// seja: qualquer visitante conseguia baixar os hashes de senha de todos os
// administradores e igrejas e quebra-los offline.
//
// Aqui a conferencia acontece no servidor, com a service_role (secreta, nunca
// exposta ao navegador). O hash nunca sai do servidor. Depois disso, a leitura
// anonima dessas duas tabelas pode ser revogada no banco.
//
// O QUE ELA DEVOLVE
// -----------------
// { success: true, token, user } -- onde "user" e a linha do usuario SEM a
// coluna "senha", e "token" e um JWT assinado (HS256) com o JWT Secret do
// projeto, carregando o papel da pessoa (user_role) e, para igreja, o codigo.
//
// IMPORTANTE (Passo 1): o site GUARDA esse token mas ainda NAO o usa para
// acessar dados -- o acesso continua como hoje. O token passa a valer no
// Passo 2, quando as tabelas forem trancadas por RLS baseada no claim
// "user_role". Fazer assim mantem este passo contido e sem risco de quebrar
// as telas existentes.

import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import bcrypt from "npm:bcryptjs@2.4.3";
import { SignJWT } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Hash descartavel usado quando o usuario nao existe, so para gastar o mesmo
// tempo de CPU de uma comparacao real. Sem isso, "usuario inexistente"
// responderia visivelmente mais rapido que "senha errada", o que permite
// descobrir quais usuarios existem so medindo o tempo de resposta.
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const GENERIC_ERROR = "Usuário ou senha inválidos";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Método não permitido" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const tipo = body?.tipo;
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const senha = typeof body?.senha === "string" ? body.senha : "";

    if (!identifier || !senha || (tipo !== "organizador" && tipo !== "igreja")) {
      return json({ success: false, error: GENERIC_ERROR }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const jwtSecret = Deno.env.get("APP_JWT_SECRET");

    if (!supabaseUrl || !serviceKey || !jwtSecret) {
      console.error("[login] Variáveis de ambiente ausentes (URL/SERVICE_ROLE/APP_JWT_SECRET)");
      return json({ success: false, error: "Serviço de login indisponível" }, 500);
    }

    // service_role ignora RLS de proposito: e o servidor conferindo a senha.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let row: Record<string, unknown> | null = null;
    let userRole = "organizador";
    const extraClaims: Record<string, unknown> = {};

    if (tipo === "organizador") {
      const { data, error } = await admin
        .from("organizadores_auth")
        .select("*")
        .ilike("nome", identifier)
        .maybeSingle();
      if (error) {
        console.error("[login] erro na consulta organizadores_auth:", error.message);
        return json({ success: false, error: "Serviço de login indisponível" }, 500);
      }
      row = data;
      // Preserva um eventual papel gravado na linha (ex.: organizador-aprovador).
      // Se a coluna nao existir, mantem o padrao "organizador" -- que e
      // exatamente o que o site fazia antes.
      const papel = (row?.role ?? row?.tipo ?? row?.perfil) as string | undefined;
      if (papel === "organizador-aprovador") userRole = "organizador-aprovador";
    } else {
      const { data, error } = await admin
        .from("igrejas_parceiras")
        .select("*")
        .ilike("codigo", identifier)
        .limit(1);
      if (error) {
        console.error("[login] erro na consulta igrejas_parceiras:", error.message);
        return json({ success: false, error: "Serviço de login indisponível" }, 500);
      }
      row = data?.[0] ?? null;
      userRole = "parceiro";
      if (row?.codigo) extraClaims.igreja_codigo = String(row.codigo);
    }

    const hash = typeof row?.senha === "string" ? row.senha : DUMMY_HASH;
    const senhaConfere = await bcrypt.compare(senha, hash);

    // Mensagem unica para "nao existe" e "senha errada" (sem enumeracao).
    if (!row || !senhaConfere) {
      return json({ success: false, error: GENERIC_ERROR }, 401);
    }

    // Trava de primeiro acesso (igrejas parceiras).
    //
    // A senha inicial e uma FORMULA ("<codigo><sufixo>", com o sufixo guardado
    // Patrick para facilitar a distribuicao. Formula vaza -- basta uma das
    // 145 pessoas repassar a mensagem. Por isso a conta so aceita esse
    // primeiro acesso depois que um organizador libera a igreja: assim a
    // formula nunca vale para as 145 contas ao mesmo tempo.
    //
    // A conferencia vem DEPOIS da senha de proposito: quem nao sabe a senha
    // recebe o erro generico e nao descobre nada sobre a conta.
    if (tipo === "igreja" && row.acesso_liberado !== true) {
      return json({
        success: false,
        error: "O acesso desta igreja ainda não foi liberado. Fale com a organização.",
      }, 403);
    }

    // Registra a visita (alimenta a coluna "último acesso" da tela de senhas,
    // que e como o organizador enxerga quem ja entrou). Falha aqui nao pode
    // derrubar o login -- e informacao de apoio, nao parte da autenticacao.
    {
      const tabela = tipo === "igreja" ? "igrejas_parceiras" : "organizadores_auth";
      const { error: erroAcesso } = await admin
        .from(tabela)
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq("id", row.id);
      if (erroAcesso) {
        console.error("[login] falha ao registrar último acesso:", erroAcesso.message);
      }
    }

    const token = await new SignJWT({
      role: "authenticated",
      user_role: userRole,
      ...extraClaims,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(String(row.id ?? identifier))
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(jwtSecret));

    // A senha (hash) NUNCA vai para o navegador.
    const { senha: _senhaRemovida, ...safeUser } = row as Record<string, unknown>;

    // senha_definida = false significa que a conta ainda esta com a senha
    // temporaria (a formula de primeiro acesso, ou uma senha gerada por um
    // organizador numa redefinicao). Nos dois casos o site manda a pessoa
    // para a tela de criar a senha dela antes de qualquer outra coisa.
    // Vale para os dois tipos: igreja com a senha de primeiro acesso, e
    // organizador que recebeu senha gerada pelo login de permissao maxima.
    const precisaTrocarSenha = row.senha_definida !== true;

    return json({
      success: true,
      token,
      precisa_trocar_senha: precisaTrocarSenha,
      user: {
        ...safeUser,
        role: tipo === "igreja" ? "parceiro" : userRole,
        precisa_trocar_senha: precisaTrocarSenha,
      },
    });
  } catch (err) {
    console.error("[login] exceção não tratada:", err);
    return json({ success: false, error: "Serviço de login indisponível" }, 500);
  }
});
