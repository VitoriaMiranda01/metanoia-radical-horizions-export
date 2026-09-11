// Edge Function: sicoob-webhook-handler
//
// O QUE MUDOU NESTA VERSAO (Etapa 2 do Passo 2 de seguranca)
// ----------------------------------------------------------
// 1) PASSOU A USAR service_role em vez da chave anonima.
//    Esta e a mudanca mais importante: quando as tabelas forem trancadas por
//    RLS (Passo 2), a chave anonima perderia o acesso e este webhook pararia
//    de confirmar pagamentos -- em silencio. As pessoas pagariam e ficariam
//    "pendente", sem ninguem perceber.
//
// 2) PASSOU A CONFERIR O VALOR PAGO.
//    Antes, bastava o txid bater pra inscricao ser confirmada. Se o valor
//    divergir do que foi cobrado, agora a cobranca e marcada como
//    "divergente" e a inscricao NAO e confirmada -- ela aparece na tela de
//    Pagamentos Pendentes pra um organizador decidir.
//
// O que ja era bom e foi mantido: o token secreto na query string (o Sicoob
// nao assina as notificacoes) e a protecao contra notificacao repetida.

import { corsHeaders } from "./cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // A URL cadastrada no Sicoob deve incluir o token secreto:
    //   https://<projeto>.functions.supabase.co/sicoob-webhook-handler?token=SEGREDO
    // e o mesmo valor fica no secret SICOOB_WEBHOOK_TOKEN.
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const expectedToken = Deno.env.get("SICOOB_WEBHOOK_TOKEN");

    if (!expectedToken || token !== expectedToken) {
      console.error("[webhook] rejeitado: token ausente ou inválido");
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[webhook] variáveis de ambiente ausentes");
      return json({ success: false, error: "config" }, 500);
    }

    // service_role: ignora RLS de proposito. E o servidor confirmando um
    // pagamento, nao um visitante.
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = await req.json();

    // Formato Bacen: { "pix": [ { txid, endToEndId, valor, horario, ... } ] }
    const notificacoes = Array.isArray(payload?.pix) ? payload.pix : [];

    if (notificacoes.length === 0) {
      console.warn("[webhook] payload sem notificações de pix");
      return json({ received: true });
    }

    for (const notif of notificacoes) {
      const txid = notif?.txid;
      if (!txid) {
        console.warn("[webhook] notificação sem txid, ignorando");
        continue;
      }

      const { data: pixRow, error: selectError } = await db
        .from("pix_sicoob")
        .select("id, status, valor, inscricao_id, inscricao_tipo")
        .eq("sicoob_id", txid)
        .maybeSingle();

      if (selectError) {
        console.error("[webhook] erro ao buscar pix_sicoob:", selectError.message);
        continue;
      }
      if (!pixRow) {
        console.warn("[webhook] nenhum registro para o txid recebido -- ignorado");
        continue;
      }
      if (pixRow.status === "pago") {
        console.log("[webhook] txid já confirmado -- notificação duplicada");
        continue;
      }

      // --- Conferencia do valor -----------------------------------------
      // Rede de seguranca. Com o valor calculado no servidor
      // (sicoob-pix-create), divergir aqui nao deveria acontecer -- entao,
      // se acontecer, e sinal de problema e nao pode virar confirmacao
      // automatica.
      const valorEsperado = Number(pixRow.valor);
      const valorPago = Number(notif?.valor);

      if (
        Number.isFinite(valorEsperado) &&
        Number.isFinite(valorPago) &&
        Math.abs(valorPago - valorEsperado) > 0.01
      ) {
        console.error(
          `[webhook] valor divergente: esperado=${valorEsperado.toFixed(2)} pago=${valorPago.toFixed(2)} -- inscrição NÃO confirmada`,
        );
        await db
          .from("pix_sicoob")
          .update({ status: "divergente", updated_at: new Date().toISOString() })
          .eq("id", pixRow.id);
        // Segue para a proxima notificacao sem confirmar. A cobranca aparece
        // na tela de Pagamentos Pendentes pra um organizador resolver.
        continue;
      }

      const { error: updatePixError } = await db
        .from("pix_sicoob")
        .update({ status: "pago", updated_at: new Date().toISOString() })
        .eq("id", pixRow.id);

      if (updatePixError) {
        console.error("[webhook] erro ao atualizar pix_sicoob:", updatePixError.message);
        continue;
      }

      if (pixRow.inscricao_id && pixRow.inscricao_tipo) {
        const table = pixRow.inscricao_tipo === "equipante" ? "equipantes" : "acampantes";
        const { error: updateInscricaoError } = await db
          .from(table)
          .update({
            status_pagamento: "confirmado",
            metodo_pagamento: "pix",
            id_transacao_sicoob: txid,
            data_pagamento: new Date().toISOString(),
          })
          .eq("id", pixRow.inscricao_id);

        if (updateInscricaoError) {
          // O pix ficou 'pago' mas a inscricao nao confirmou. Esse e
          // exatamente o caso que a tela de Pagamentos Pendentes precisa
          // mostrar -- ela cruza pix_sicoob 'pago' com inscricao ainda
          // pendente.
          console.error(
            "[webhook] pix pago mas inscrição NÃO confirmada:",
            updateInscricaoError.message,
          );
        }
      } else {
        console.warn("[webhook] pix_sicoob sem inscricao_id/tipo -- só o pix foi atualizado");
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error("[webhook] exceção não tratada:", (error as Error)?.message);
    return json({ success: false, error: "erro" }, 400);
  }
});
