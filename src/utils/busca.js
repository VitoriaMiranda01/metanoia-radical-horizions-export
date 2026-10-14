/**
 * Busca de texto das listas de inscricao (Aprovacoes, Gerenciar Inscricoes).
 *
 * Sem diferenca de maiuscula/minuscula nem de acento ("petropolis" acha
 * "PETRÓPOLIS"). Termo so de numeros (com ou sem ponto/traco) tambem procura
 * nos digitos -- assim "123.456" acha o CPF gravado como "12345678900".
 *
 * Antes cada tela tinha a sua lista de campos, e as duas filtravam em
 * sequencia: a pagina filtrava por um conjunto, a tabela de novo por outro, e
 * quem casava pela igreja sumia na segunda passada (04/10/2026).
 */
export const normalizarBusca = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

// Tolerancia a erro de digitacao (13/10/2026): nomes copiados de planilha
// vem com letra faltando ou trocada ("MAURCIO PINHEIRO CARNEIRO"). Quando o
// trecho exato nao aparece, cada palavra da busca precisa casar com alguma
// palavra do campo: igual, comeco dela, ou com 1 letra de diferenca (2 em
// palavras longas; duas letras trocadas de lugar contam como 1). "de/da/do/
// dos/das/e" sao ignoradas; palavras curtas so casam pelo comeco.
// So entra com 2+ palavras na busca, ou 1 palavra de 7+ letras: buscando uma
// palavra curta ("silva") a lista ficaria cheia de parecidos ("Silvia").
const LIGACOES = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const distancia = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let antes = null;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j += 1) {
      atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (antes && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        atual[j] = Math.min(atual[j], antes[j - 2] + 1);
      }
      menor = Math.min(menor, atual[j]);
    }
    if (menor > max) return max + 1;
    antes = ant;
    ant = atual;
  }
  return ant[b.length];
};
const palavras = (texto) => texto.split(/[^a-z0-9]+/).filter((p) => p && !LIGACOES.has(p));
const casaPalavra = (termo, palavra) => {
  if (palavra.startsWith(termo)) return true;
  if (termo.length < 4) return false;
  const max = termo.length >= 8 ? 2 : 1;
  return distancia(termo, palavra, max) <= max
    || (palavra.length > termo.length && distancia(termo, palavra.slice(0, termo.length), 1) <= 1);
};
const casaAproximado = (t, valor) => {
  const busca = palavras(t);
  if (!busca.length || !busca.some((p) => p.length >= 4)) return false;
  if (busca.length === 1 && busca[0].length < 7) return false;
  const doCampo = palavras(valor);
  const falham = busca.filter((p) => !doCampo.some((w) => casaPalavra(p, w)));
  // Nome completo colado (3+ palavras): tolera UMA palavra que nao bate, se
  // pelo menos duas palavras longas bateram ("RODRIGO CAMARA DE MLLO").
  const longasOk = busca.filter((p) => p.length >= 4 && !falham.includes(p)).length;
  return falham.length === 0 || (busca.length >= 3 && falham.length === 1 && longasOk >= 2);
};

// Um nome so (sem os outros campos): exato, ou aproximado como acima.
export const casaNome = (termo, nome) => {
  const t = normalizarBusca(termo);
  if (!t) return true;
  const valor = normalizarBusca(nome);
  return !!valor && (valor.includes(t) || casaAproximado(t, valor));
};

export const casaBusca = (termo, campos) => {
  const t = normalizarBusca(termo);
  if (!t) return true;
  const soNumeros = /^[\d.\-/\s]+$/.test(t);
  const digitos = t.replace(/\D/g, '');
  const exato = campos.some((campo) => {
    const valor = normalizarBusca(campo);
    if (!valor) return false;
    if (valor.includes(t)) return true;
    return soNumeros && digitos.length >= 3 && valor.replace(/\D/g, '').includes(digitos);
  });
  if (exato || soNumeros) return exato;
  return campos.some((campo) => {
    const valor = normalizarBusca(campo);
    return !!valor && casaAproximado(t, valor);
  });
};
