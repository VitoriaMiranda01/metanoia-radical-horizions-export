// =============================================================================
// backup-diario
//
// Chamada todo dia as 03:00 (Brasilia) pelo GitHub Actions do repositorio
// PRIVADO Patrick-rios/metanoia-backups. Gera o backup completo do banco,
// guarda uma copia no bucket privado "backups" deste projeto e devolve o
// arquivo para o GitHub guardar a segunda copia, fora do Supabase.
//
// Autenticacao SEM segredo compartilhado: o GitHub assina um token (OIDC)
// dizendo de qual repositorio, branch e visibilidade vem a chamada. A gente
// confere a assinatura com as chaves publicas do GitHub. Nao existe senha
// guardada em lugar nenhum para vazar -- e se alguem tornar o repositorio
// publico, a funcao para de entregar os dados.
//
// Duas acoes:
//   { acao: "gerar", tipo: "diario" | "edicao", rotulo?: "2026" }
//   { acao: "confirmar", id, sha256 }   -- o GitHub avisa que guardou a copia
//
// Rotacao (a mesma que o GitHub faz do lado de la):
//   diario/   7 mais recentes
//   semanal/  12 mais recentes (copia da segunda-feira)
//   edicao/   para sempre
//   retidos/  para sempre: a copia de ANTES de uma queda brusca de registros
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const REPOSITORIO = "Patrick-rios/metanoia-backups";
const AUDIENCIA = "metanoia-backup";
const EMISSOR = "https://token.actions.githubusercontent.com";
const CHAVES_GITHUB = createRemoteJWKSet(new URL(`${EMISSOR}/.well-known/jwks`));

const BUCKET = "backups";
const MANTER_DIARIOS = 7;
const MANTER_SEMANAIS = 12;

// Queda brusca: uma tabela com pelo menos 10 registros perdeu mais de 20%
// de um dia para o outro. Nao impede nada -- so guarda a copia de antes
// para sempre e faz o GitHub avisar.
const QUEDA_PROPORCAO = 0.2;
const QUEDA_MINIMO = 10;

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

class Recusa extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function conferirGithub(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Recusa(401, "sem token");

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, CHAVES_GITHUB, {
      issuer: EMISSOR,
      audience: AUDIENCIA,
    }));
  } catch {
    throw new Recusa(401, "token invalido");
  }

  if (payload.repository !== REPOSITORIO) throw new Recusa(403, "repositorio nao autorizado");
  if (payload.ref !== "refs/heads/main") throw new Recusa(403, "branch nao autorizada");
  if (payload.repository_visibility !== "private") {
    throw new Recusa(403, "o repositorio de backups precisa ser privado");
  }
}

const hojeEmBrasilia = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const ehSegunda = (data: string) => new Date(`${data}T12:00:00Z`).getUTCDay() === 1;

async function gzip(texto: string): Promise<Uint8Array> {
  const fluxo = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const pasta = () => admin.storage.from(BUCKET);

async function arquivosDe(dir: string): Promise<string[]> {
  const { data, error } = await pasta().list(dir, { limit: 1000 });
  if (error) throw new Error(`listar ${dir}: ${error.message}`);
  return (data ?? [])
    .map((f) => f.name)
    .filter((n) => n.endsWith(".json.gz"))
    .sort()
    .reverse();
}

async function rotacionar(dir: string, manter: number) {
  const sobra = (await arquivosDe(dir)).slice(manter).map((n) => `${dir}/${n}`);
  if (sobra.length === 0) return;
  const { error } = await pasta().remove(sobra);
  if (error) throw new Error(`rotacao ${dir}: ${error.message}`);
}

async function enviar(caminho: string, bytes: Uint8Array) {
  const { error } = await pasta().upload(caminho, bytes, {
    contentType: "application/gzip",
    upsert: true,
  });
  if (error) throw new Error(`salvar ${caminho}: ${error.message}`);
}

async function linksDosAnexos(objetos: Array<Record<string, any>>) {
  const porBucket = new Map<string, Array<Record<string, any>>>();
  for (const o of objetos) {
    if (o.bucket_id === BUCKET || String(o.name).endsWith(".emptyFolderPlaceholder")) continue;
    if (!porBucket.has(o.bucket_id)) porBucket.set(o.bucket_id, []);
    porBucket.get(o.bucket_id)!.push(o);
  }

  const anexos = [];
  for (const [bucket, lista] of porBucket) {
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrls(lista.map((o) => o.name), 1800);
    if (error) throw new Error(`links de ${bucket}: ${error.message}`);
    for (let i = 0; i < lista.length; i++) {
      anexos.push({
        bucket,
        name: lista[i].name,
        size: lista[i].metadata?.size ?? null,
        url: data?.[i]?.signedUrl ?? null,
      });
    }
  }
  return anexos;
}

async function gerar(tipo: string, rotulo: string | null) {
  const dataRef = hojeEmBrasilia();

  const { data: execucao, error: errIns } = await admin
    .from("backup_execucoes")
    .insert({ tipo, data_ref: dataRef })
    .select("id")
    .single();
  if (errIns) throw new Error(`registrar execucao: ${errIns.message}`);
  const id = execucao.id as string;

  try {
    const [{ data: dados, error: e1 }, { data: estrutura, error: e2 }] = await Promise.all([
      admin.rpc("backup_dados"),
      admin.rpc("backup_estrutura"),
    ]);
    if (e1) throw new Error(`ler dados: ${e1.message}`);
    if (e2) throw new Error(`ler estrutura: ${e2.message}`);

    const tabelas = dados.tabelas as Record<string, unknown[]>;
    const contagens: Record<string, number> = {};
    for (const [nome, linhas] of Object.entries(tabelas)) contagens[nome] = linhas.length;

    if (!Array.isArray(tabelas.equipantes) || Object.keys(tabelas).length < 10) {
      throw new Error("o backup veio incompleto (faltam tabelas)");
    }

    // Comparacao com o ultimo backup que deu certo
    const { data: anterior } = await admin
      .from("backup_execucoes")
      .select("contagens")
      .in("status", ["ok", "alerta"])
      .not("contagens", "is", null)
      .neq("id", id)
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const quedas = [];
    for (const [nome, antes] of Object.entries((anterior?.contagens ?? {}) as Record<string, number>)) {
      const agora = contagens[nome] ?? 0;
      if (antes >= QUEDA_MINIMO && agora < antes * (1 - QUEDA_PROPORCAO)) {
        quedas.push({ tabela: nome, antes, agora });
      }
    }

    const documento = {
      formato: "metanoia-backup/1",
      projeto: "yxootyzlpefyztiiacrs",
      gerado_em: new Date().toISOString(),
      data_ref: dataRef,
      tipo,
      contagens,
      estrutura_sql: estrutura,
      ...dados,
    };
    const texto = JSON.stringify(documento);
    const bytes = await gzip(texto);
    const hash = await sha256(bytes);

    const nomeArquivo = tipo === "edicao"
      ? `edicao/${rotulo}-${dataRef}.json.gz`
      : `diario/${dataRef}.json.gz`;
    const semanal = tipo === "diario" && ehSegunda(dataRef);

    // Antes de gravar o de hoje: em queda brusca, o de ontem vira "retido".
    let retido: string | null = null;
    if (quedas.length > 0) {
      const anteriorArquivo = (await arquivosDe("diario")).find((n) => n < `${dataRef}.json.gz`);
      if (anteriorArquivo) {
        retido = `retidos/${anteriorArquivo}`;
        await pasta().remove([retido]);
        const { error } = await pasta().copy(`diario/${anteriorArquivo}`, retido);
        if (error) throw new Error(`reter ${anteriorArquivo}: ${error.message}`);
      }
    }

    await enviar(nomeArquivo, bytes);
    if (semanal) await enviar(`semanal/${dataRef}.json.gz`, bytes);

    await rotacionar("diario", MANTER_DIARIOS);
    await rotacionar("semanal", MANTER_SEMANAIS);

    const anexos = await linksDosAnexos(dados.storage_objetos ?? []);

    const status = quedas.length > 0 ? "alerta" : "ok";
    const { error: errUpd } = await admin
      .from("backup_execucoes")
      .update({
        status,
        concluido_em: new Date().toISOString(),
        arquivo: nomeArquivo,
        bytes_json: new TextEncoder().encode(texto).length,
        bytes_gzip: bytes.length,
        sha256: hash,
        contagens,
        quedas: quedas.length > 0 ? quedas : null,
        supabase_ok: true,
      })
      .eq("id", id);
    if (errUpd) throw new Error(`fechar execucao: ${errUpd.message}`);

    return {
      id,
      status,
      data_ref: dataRef,
      tipo,
      arquivo: nomeArquivo,
      semanal,
      retido,
      quedas,
      contagens,
      sha256: hash,
      bytes_gzip: bytes.length,
      gzip_base64: encodeBase64(bytes),
      anexos,
    };
  } catch (err) {
    const mensagem = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await admin
      .from("backup_execucoes")
      .update({ status: "erro", concluido_em: new Date().toISOString(), erro: mensagem })
      .eq("id", id);
    throw err;
  }
}

async function confirmar(id: string, hash: string) {
  const { data, error } = await admin
    .from("backup_execucoes")
    .update({ github_ok: true, github_em: new Date().toISOString() })
    .eq("id", id)
    .eq("sha256", hash)
    .in("status", ["ok", "alerta"])
    .select("id");
  if (error) throw new Error(`confirmar: ${error.message}`);
  if (!data || data.length === 0) throw new Recusa(404, "execucao nao encontrada");
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "use POST" });

  try {
    await conferirGithub(req);

    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "gerar") {
      const tipo = corpo.tipo === "edicao" ? "edicao" : "diario";
      let rotulo: string | null = null;
      if (tipo === "edicao") {
        rotulo = String(corpo.rotulo ?? "").trim();
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(rotulo)) {
          throw new Recusa(400, "rotulo da edicao invalido (use letras, numeros, - ou _)");
        }
      }
      return json(200, await gerar(tipo, rotulo));
    }
    if (corpo.acao === "confirmar") {
      return json(200, await confirmar(String(corpo.id ?? ""), String(corpo.sha256 ?? "")));
    }
    throw new Recusa(400, "acao desconhecida");
  } catch (err) {
    if (err instanceof Recusa) return json(err.status, { erro: err.message });
    console.error("backup-diario", err);
    return json(500, { erro: err instanceof Error ? err.message : String(err) });
  }
});
