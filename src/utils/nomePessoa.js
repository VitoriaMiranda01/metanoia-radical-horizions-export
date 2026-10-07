/**
 * Nome de pessoa (Patrick, 06/10/2026): so letras -- e espaco, apostrofo,
 * hifen e ponto ("D'Ávila", "Ana-Clara", "Sr. João") --, com nome e sobrenome.
 * O apostrofo curvo (’) vale: e o que o teclado do iPhone digita.
 * O servidor confere de novo (_nome_pessoa_valido).
 */

const FORA_DO_NOME = /[^\p{L}\s'’.-]/gu;

/** Tira do que foi digitado tudo que nao cabe num nome (numeros, simbolos). */
export const limparNomePessoa = (valor) => String(valor ?? '').replace(FORA_DO_NOME, '');

/** null quando o nome serve; senao, o texto do problema. Vazio fica com o `required`. */
export const problemaNomePessoa = (nome) => {
  const t = String(nome ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (/[^\p{L}\s'’.-]/u.test(t)) return 'Use só letras no nome (sem números ou símbolos).';
  const palavras = t.split(' ').filter((p) => /\p{L}/u.test(p));
  const letras = (t.match(/\p{L}/gu) || []).length;
  if (palavras.length < 2 || letras < 4) return 'Escreva o nome completo (nome e sobrenome).';
  return null;
};
