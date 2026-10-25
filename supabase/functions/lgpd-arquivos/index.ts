// =============================================================================
// lgpd-arquivos
//
// Apaga do Storage os arquivos de autorizacao do responsavel que a rotina da
// LGPD (public.lgpd_rodar, todo dia 03:30 de Brasilia) colocou na fila
// public.lgpd_arquivos_a_apagar. O banco nao consegue apagar arquivo sozinho
// (storage.protect_delete), entao ele chama esta funcao pelo pg_net.
//
// Sem login (verify_jwt = false): quem chamar so consegue fazer a fila andar.
// A fila so e escrita pelo banco, e aqui ainda conferimos o bucket e a pasta
// -- o modelo em branco do PDF mora no mesmo bucket e nunca sai.
//
// Depois de apagar, public.lgpd_arquivos_conferir tira da fila o que sumiu do
// Storage e grava o registro (so o codigo do arquivo, sem nome de pessoa).
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const BUCKET = "autorizacao-menor-idade-equipante";
const PASTA = "envios/";
const POR_VEZ = 100;

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: fila, error } = await sb
    .from("lgpd_arquivos_a_apagar")
    .select("bucket, nome")
    .eq("bucket", BUCKET)
    .like("nome", `${PASTA}%`)
    .limit(POR_VEZ);
  if (error) {
    return Response.json({ ok: false, erro: error.message }, { status: 500 });
  }

  let erro: string | null = null;
  const nomes = (fila ?? []).map((f) => f.nome).filter((n) => n.startsWith(PASTA));
  if (nomes.length > 0) {
    const { error: e } = await sb.storage.from(BUCKET).remove(nomes);
    if (e) erro = e.message;
  }

  const { data: conferido, error: e2 } = await sb.rpc("lgpd_arquivos_conferir", { p_erro: erro });
  if (e2) {
    return Response.json({ ok: false, erro: e2.message }, { status: 500 });
  }
  return Response.json({ ok: !erro, enviados: nomes.length, ...conferido, erro });
});
