// Edge Function: sicoob-pix-create
//
// O QUE MUDOU NESTA VERSAO (Etapa 2 do Passo 2 de seguranca)
// ----------------------------------------------------------
// 1) O VALOR DEIXOU DE VIR DO NAVEGADOR.
//    Antes: o corpo da requisicao trazia "valor" e essa funcao repassava
//    direto pro backend. Qualquer pessoa podia gerar uma cobranca de R$ 0,01
//    -- inclusive sem abrir o site, porque a funcao aceita chamada de fora.
//    Agora: o valor e recalculado aqui, a partir da tabela "configuracoes"
//    (mesma regra de lotes que a tela usa) e do cupom conferido no banco.
//    O "valor" que o navegador manda e usado SO para registrar divergencia
//    no log.
//
// 2) O CUPOM PASSOU A VALER DE VERDADE.
//    Antes: "coupon_code" era recebido e ignorado -- o desconto era calculado
//    no navegador. Agora o desconto sai da tabela "cupons", e so de cupom
//    ativo.
//
// 3) ISENCAO NAO E MAIS FEITA POR CUPOM.
//    Regra definida com a organizacao: quem isenta alguem e sempre um
//    organizador. Se a conta zerar, a funcao recusa e manda procurar a
//    organizacao, em vez de liberar sozinha.
//
// 4) O REGISTRO EM pix_sicoob PASSOU A SER AGUARDADO.
//    Antes o insert era disparado sem await. Se falhasse, o usuario recebia
//    um QR Code que o webhook JAMAIS conseguiria reconciliar -- a pessoa
//    pagava e ficava "pendente" pra sempre, sem ninguem saber. Agora, se o
//    registro falhar, a cobranca nao e entregue.
//
// 5) CPF E NOME SAIRAM DO LOG.
//
// 6) PASSOU A USAR service_role em vez da chave anonima, porque as tabelas
//    vao ser trancadas por RLS. Com a chave anonima, o registro do PIX
//    pararia de funcionar silenciosamente.

import { corsHeaders } from "./cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const BACKEND_URL =
  "https://metanoia-backend-267108547980.us-central1.run.app/gerar-pix";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// "hoje" no fuso de Brasilia, como AAAAMMDD. Usar new Date() cru daria UTC,
// e a virada de lote aconteceria 3 horas antes do esperado.
const hojeBrasilia = (): number => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return Number(fmt.format(new Date()).replaceAll("-", ""));
};

// Os periodos sao gravados pela tela do organizador no formato "DD/MM/AAAA".
const dataParaNumero = (valor: unknown): number | null => {
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return Number(`${m[3]}${m[2]}${m[1]}`);
};

type Periodo = { start_date?: string; end_date?: string; value?: unknown };

// Mesma regra da tela (useCurrentPrice.js): acha o periodo que contem a data
// de hoje, inclusive nas pontas.
const precoDoLoteVigente = (periodos: unknown): number | null => {
  if (!Array.isArray(periodos)) return null;
  const hoje = hojeBrasilia();

  for (const p of periodos as Periodo[]) {
    const inicio = dataParaNumero(p?.start_date);
    const fim = dataParaNumero(p?.end_date);
    if (inicio === null || fim === null) continue;
    if (hoje < inicio || hoje > fim) continue;

    const valor = Number(p?.value);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    return valor;
  }
  return null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Método não permitido" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);

    const inscricaoId = body?.inscricao_id;
    const cpf = typeof body?.cpf === "string" ? body.cpf.replace(/\D/g, "") : "";
    const nomePagador =
      typeof body?.nome_pagador === "string" && body.nome_pagador.trim()
        ? body.nome_pagador.trim()
        : "Pagador";
    const cupomCodigo =
      typeof body?.coupon_code === "string" ? body.coupon_code.trim().toUpperCase() : "";
    const minutosExpiracao = Number(body?.minutos_expiracao) || 30;
    const valorDoNavegador = Number(body?.valor);

    if (!inscricaoId) {
      return json({ success: false, error: "Inscrição não identificada." }, 400);
    }
    if (cpf.length !== 11) {
      return json({ success: false, error: "CPF inválido." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[pix] variáveis de ambiente ausentes");
      return json({ success: false, error: "Serviço de pagamento indisponível." }, 500);
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // --- 1. A inscricao existe? Ja esta paga? ---------------------------
    // O tipo vem da inscricao, nao do que o navegador afirma.
    let tipo: "acampante" | "equipante" | null = null;
    let inscricao: Record<string, unknown> | null = null;

    for (const t of ["acampantes", "equipantes"] as const) {
      const { data, error } = await db
        .from(t)
        .select("id, status_pagamento")
        .eq("id", inscricaoId)
        .maybeSingle();
      if (error) {
        console.error(`[pix] erro consultando ${t}:`, error.message);
        return json({ success: false, error: "Serviço de pagamento indisponível." }, 500);
      }
      if (data) {
        inscricao = data;
        tipo = t === "acampantes" ? "acampante" : "equipante";
        break;
      }
    }

    if (!inscricao || !tipo) {
      return json({ success: false, error: "Inscrição não encontrada." }, 404);
    }

    const statusAtual = String(inscricao.status_pagamento ?? "");
    if (["pago", "confirmado", "completed"].includes(statusAtual)) {
      return json(
        { success: false, error: "Esta inscrição já está paga." },
        409,
      );
    }

    // --- 2. Preco do lote vigente ---------------------------------------
    const { data: config, error: configError } = await db
      .from("configuracoes")
      .select("acampante_pricing_periods, equipante_pricing_periods")
      .order("edicao_numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.error("[pix] erro lendo configuracoes:", configError?.message);
      return json({ success: false, error: "Serviço de pagamento indisponível." }, 500);
    }

    const periodos = tipo === "equipante"
      ? config.equipante_pricing_periods
      : config.acampante_pricing_periods;

    const precoBase = precoDoLoteVigente(periodos);

    // De proposito NAO existe valor padrao aqui. As colunas valor_acampante /
    // valor_equipante estao com 15000 em producao e a tela as trata como
    // reais -- usa-las como fallback cobraria R$ 15.000,00 de alguem. Se
    // nenhum lote cobre a data de hoje, isso e erro de configuracao: melhor
    // recusar de forma visivel do que emitir uma cobranca errada.
    if (precoBase === null) {
      console.error(`[pix] nenhum lote vigente para ${tipo} -- verificar configuracoes`);
      return json(
        {
          success: false,
          error:
            "As inscrições não têm um valor definido para a data de hoje. Entre em contato com a organização.",
        },
        422,
      );
    }

    // --- 3. Cupom (conferido no banco) ----------------------------------
    let desconto = 0;
    let cupomAplicado: string | null = null;

    if (cupomCodigo) {
      const { data: cupom, error: cupomError } = await db
        .from("cupons")
        .select("codigo, desconto_fixo")
        .eq("codigo", cupomCodigo)
        .eq("ativo", true)
        .maybeSingle();

      if (cupomError) {
        console.error("[pix] erro lendo cupons:", cupomError.message);
        return json({ success: false, error: "Serviço de pagamento indisponível." }, 500);
      }
      if (cupom) {
        const d = Number(cupom.desconto_fixo);
        if (Number.isFinite(d) && d > 0) {
          desconto = d;
          cupomAplicado = String(cupom.codigo);
        }
      }
      // Cupom invalido nao derruba a cobranca: so nao aplica desconto.
      // A tela ja avisa o usuario no momento em que ele clica em "Aplicar".
    }

    const valorFinal = Math.max(0, precoBase - desconto);

    // Isencao e decisao de organizador, nunca de cupom (regra definida com a
    // organizacao em 11/09/2026).
    if (valorFinal <= 0) {
      console.warn(`[pix] cupom ${cupomAplicado} zeraria a inscrição -- recusado`);
      return json(
        {
          success: false,
          error:
            "Este desconto cobre o valor total. A isenção precisa ser liberada pela organização.",
        },
        422,
      );
    }

    // Registra divergencia sem expor dado pessoal. Depois que o frontend novo
    // estiver no ar, divergencia aqui significa ou cache antigo, ou tentativa
    // de manipulacao.
    if (Number.isFinite(valorDoNavegador)) {
      const enviadoEmReais = valorDoNavegador / 100;
      if (Math.abs(enviadoEmReais - valorFinal) > 0.001) {
        console.warn(
          `[pix] divergência de valor: navegador=${enviadoEmReais.toFixed(2)} servidor=${valorFinal.toFixed(2)} tipo=${tipo}`,
        );
      }
    }

    // --- 4. Gera a cobranca no backend ----------------------------------
    const cpfFormatado = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    // Sem CPF e sem nome no log.
    console.log(`[pix] gerando cobrança tipo=${tipo} valor=${valorFinal.toFixed(2)}`);

    const resposta = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        nome: nomePagador,
        cpf: cpfFormatado,
        valor: valorFinal.toFixed(2),
      }),
    });

    const textoResposta = await resposta.text();
    if (!resposta.ok) {
      console.error(`[pix] backend respondeu ${resposta.status}`);
      return json(
        { success: false, error: "Não foi possível gerar a cobrança. Tente novamente." },
        502,
      );
    }

    const dadosBackend = JSON.parse(textoResposta);
    const txid = dadosBackend?.txid;
    const pixCopiaECola = dadosBackend?.pixCopiaECola || "";
    const qrcodeImagem = dadosBackend?.qrcode || null;

    // Sem txid o webhook nunca acha essa cobranca -- a pessoa pagaria e
    // ficaria pendente pra sempre. Antes isso so virava log; agora barra.
    if (!txid) {
      console.error("[pix] backend não retornou txid -- cobrança não seria reconciliável");
      return json(
        { success: false, error: "Não foi possível gerar a cobrança. Tente novamente." },
        502,
      );
    }
    if (!pixCopiaECola) {
      console.error("[pix] backend não retornou o código copia-e-cola");
      return json(
        { success: false, error: "Não foi possível gerar a cobrança. Tente novamente." },
        502,
      );
    }

    // --- 5. Registra ANTES de entregar ----------------------------------
    const expiraEm = new Date();
    expiraEm.setMinutes(expiraEm.getMinutes() + minutosExpiracao);

    const { error: insertError } = await db.from("pix_sicoob").insert([{
      sicoob_id: txid,
      valor: valorFinal,
      qr_code: pixCopiaECola,
      status: "pendente",
      expires_at: expiraEm.toISOString(),
      inscricao_id: inscricaoId,
      inscricao_tipo: tipo,
    }]);

    if (insertError) {
      console.error("[pix] FALHA ao registrar pix_sicoob:", insertError.message);
      return json(
        {
          success: false,
          error:
            "Não foi possível registrar a cobrança. Nada foi cobrado — tente novamente.",
        },
        500,
      );
    }

    return json({
      success: true,
      sicoob_id: txid,
      qr_code: pixCopiaECola,
      qrcode: qrcodeImagem,
      pixCopiaECola,
      valor: valorFinal,
      cupom_aplicado: cupomAplicado,
      expires_at: expiraEm.toISOString(),
    });
  } catch (error) {
    console.error("[pix] exceção não tratada:", (error as Error)?.message);
    return json(
      { success: false, error: "Não foi possível gerar a cobrança. Tente novamente." },
      500,
    );
  }
});
