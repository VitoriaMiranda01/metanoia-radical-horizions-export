/**
 * Rascunho do formulário do equipante, guardado no próprio aparelho.
 *
 * POR QUE ISTO EXISTE (09/11/2026, Patrick)
 * -----------------------------------------
 * No celular, sair do site no meio do formulário (atender uma ligação, abrir
 * o WhatsApp) faz o navegador descartar a aba, e tudo o que foi digitado
 * sumia. Com o rascunho, quem volta e digita o MESMO CPF encontra o
 * formulário preenchido e segue de onde parou.
 *
 * REGRAS (decididas pelo Patrick)
 * -------------------------------
 * - Vale por 2 HORAS contadas do início do preenchimento (não da última
 *   alteração). Passou disso, a pessoa recomeça.
 * - Guarda o formulário inteiro, inclusive saúde e responsável do menor.
 * - Nada vai para o banco: a inscrição continua nascendo só no envio.
 * - Fica preso ao CPF: o rascunho guarda só o hash (SHA-256) do CPF e só
 *   volta para quem digitar o mesmo CPF. Quem entra sem CPF não tem rascunho.
 * - Presença na reunião, código, justificativa e "só domingo" NÃO voltam:
 *   são perguntados de novo (quem confere é o servidor).
 * - Um rascunho por aparelho: outro CPF começando substitui o anterior.
 * - Apagado no envio, no "sair" e ao vencer.
 */

const CHAVE = 'metanoia:rascunho-equipante';
export const VALIDADE_RASCUNHO_MS = 2 * 60 * 60 * 1000; // 2 horas

// Campos que nunca entram no rascunho.
const FORA_DO_RASCUNHO = [
  'id', 'cpf', 'semCpf', 'soDomingo',
  'codigoInscricao', 'presenteReuniao', 'justificativaAusencia',
];

const comCofre = (acao, padrao = null) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return padrao;
    return acao(window.localStorage);
  } catch {
    return padrao;
  }
};

const soDigitos = (cpf) => String(cpf || '').replace(/\D/g, '');

/** Hash do CPF (só dígitos). Sem crypto.subtle não há rascunho: devolve null. */
export async function hashDoCpf(cpf) {
  const digitos = soDigitos(cpf);
  if (digitos.length !== 11) return null;
  try {
    if (!window.crypto?.subtle) return null;
    const bytes = new TextEncoder().encode(`metanoia-rascunho:${digitos}`);
    const hash = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

const lerCru = () => comCofre((cofre) => {
  const cru = cofre.getItem(CHAVE);
  if (!cru) return null;
  const dados = JSON.parse(cru);
  if (!dados?.cpfHash || !dados?.criadoEm || !dados?.dados) {
    cofre.removeItem(CHAVE);
    return null;
  }
  if (Date.now() - dados.criadoEm > VALIDADE_RASCUNHO_MS) {
    cofre.removeItem(CHAVE);
    return null;
  }
  return dados;
});

/** O rascunho deste CPF, se existir e ainda valer. { dados, criadoEm, salvoEm } */
export async function lerRascunho(cpf) {
  const hash = await hashDoCpf(cpf);
  if (!hash) return null;
  const r = lerCru();
  if (!r || r.cpfHash !== hash) return null;
  return r;
}

const semCamposDeFora = (formData) => {
  const copia = { ...formData };
  FORA_DO_RASCUNHO.forEach((k) => { delete copia[k]; });
  return copia;
};

/**
 * Grava o formulário. Mantém o início (criadoEm) se o rascunho já era deste
 * CPF; outro CPF começa um rascunho novo no lugar.
 */
export async function salvarRascunho(cpf, formData) {
  const hash = await hashDoCpf(cpf);
  if (!hash) return;
  const atual = lerCru();
  const criadoEm = atual && atual.cpfHash === hash ? atual.criadoEm : Date.now();
  comCofre((cofre) => cofre.setItem(CHAVE, JSON.stringify({
    cpfHash: hash,
    criadoEm,
    salvoEm: Date.now(),
    dados: semCamposDeFora(formData),
  })));
}

export function apagarRascunho() {
  comCofre((cofre) => cofre.removeItem(CHAVE));
}

/** Aplica o rascunho por cima do formulário, sem tocar nos campos de fora. */
export function aplicarRascunho(formData, rascunho) {
  if (!rascunho?.dados) return formData;
  return { ...formData, ...semCamposDeFora(rascunho.dados) };
}
