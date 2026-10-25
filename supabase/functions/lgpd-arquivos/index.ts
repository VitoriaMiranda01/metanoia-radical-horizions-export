// =============================================================================
// lgpd-arquivos
//
// Apaga do Storage os arquivos que a rotina da LGPD (public.lgpd_rodar, todo
// dia 03:30 de Brasilia) ou o gatilho das fotos da trilha colocaram na fila
// public.lgpd_arquivos_a_apagar. O banco nao consegue apagar arquivo sozinho
// (storage.protect_delete), entao ele chama esta funcao pelo pg_net.
//
// Sem login (verify_jwt = false): quem chamar so consegue fazer a fila andar.
// A fila so e escrita pelo banco, e aqui ainda conferimos o bucket e a pasta
// -- o modelo em branco do PDF mora no mesmo bucket da autorizacao e nunca sai.
//
// Depois de apagar, public.lgpd_arquivos_conferir tira da fila o que sumiu do
// Storage e grava o registro (so o codigo do arquivo, sem nome de pessoa).
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// bucket -> pasta permitida ("" = o bucket inteiro)
const PERMITIDOS: Record<string, string> = {
  "autorizacao-menor-idade-equipante": "envios/",
  // 24/10/2026: fotos da equipe de trilha (a foto acompanha a ficha)
  "fotos-equipe-trilha": "",
};
const POR_VEZ = 100;

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const erros: string[] = [];
  let enviados = 0;
  for (const [bucket, pasta] of Object.entries(PERMITIDOS)) {
    const { data: fila, error } = await sb
      .from("lgpd_arquivos_a_apagar")
      .select("nome")
      .eq("bucket", bucket)
      .like("nome", `${pasta}%`)
      .limit(POR_VEZ);
    if (error) {
      return Response.json({ ok: false, erro: error.message }, { status: 500 });
    }
    const nomes = (fila ?? []).map((f) => f.nome).filter((n) => n.startsWith(pasta));
    if (nomes.length > 0) {
      const { error: e } = await sb.storage.from(bucket).remove(nomes);
      if (e) erros.push(`${bucket}: ${e.message}`);
      enviados += nomes.length;
    }
  }

  const erro = erros.length ? erros.join(" | ") : null;
  const { data: conferido, error: e2 } = await sb.rpc("lgpd_arquivos_conferir", { p_erro: erro });
  if (e2) {
    return Response.json({ ok: false, erro: e2.message }, { status: 500 });
  }
  return Response.json({ ok: !erro, enviados, ...conferido, erro });
});
