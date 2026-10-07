import { digitosTelefone } from './telefone';
import { normalizarBusca } from './busca';

/**
 * Regras do contato de emergencia (Patrick, 06/10/2026).
 *
 * Chegaram inscricoes com o telefone no lugar do nome e com o proprio
 * WhatsApp repetido como telefone de emergencia -- ou seja, sem contato de
 * emergencia nenhum. Agora:
 *  - o NOME so aceita letras (e espaco, apostrofo, hifen e ponto: "D'Ávila",
 *    "Ana-Clara", "Sr. João"). O apostrofo curvo (’) tambem vale: e o que o
 *    teclado do iPhone digita;
 *  - o TELEFONE tem de ser valido (TelefoneInput) e DIFERENTE do WhatsApp
 *    da propria pessoa.
 * O servidor confere de novo em criar_inscricao.
 */

const FORA_DO_NOME = /[^\p{L}\s'’.-]/gu;

/** Tira do que foi digitado tudo que nao cabe num nome (numeros, simbolos). */
export const limparNomeContato = (valor) => String(valor ?? '').replace(FORA_DO_NOME, '');

/** null quando o nome serve; senao, o texto do problema. Vazio fica com o `required`. */
export const problemaNomeContato = (nome) => {
  const t = String(nome ?? '').trim();
  if (!t) return null;
  if (/[^\p{L}\s'’.-]/u.test(t)) return 'Use só letras no nome do contato (sem números).';
  if ((t.match(/\p{L}/gu) || []).length < 2) return 'Escreva o nome da pessoa de contato.';
  return null;
};

/** Os dois numeros sao o mesmo telefone (ignorando mascara, +55 e 0 do DDD)? */
export const mesmoTelefone = (a, b) => {
  const x = digitosTelefone(a);
  const y = digitosTelefone(b);
  return !!x && !!y && x === y;
};

/** O contato de emergencia tem o mesmo nome da propria pessoa (ela mesma). */
export const mesmoNome = (contato, proprio) => {
  const a = normalizarBusca(contato);
  return !!a && a === normalizarBusca(proprio);
};

export const AVISO_MESMO_NOME =
  'O contato de emergência precisa ser outra pessoa — não pode ser você mesmo.';

export const AVISO_MESMO_TELEFONE =
  'O telefone de emergência precisa ser de outra pessoa — diferente do seu WhatsApp.';
