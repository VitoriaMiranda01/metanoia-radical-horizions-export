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

export const casaBusca = (termo, campos) => {
  const t = normalizarBusca(termo);
  if (!t) return true;
  const soNumeros = /^[\d.\-/\s]+$/.test(t);
  const digitos = t.replace(/\D/g, '');
  return campos.some((campo) => {
    const valor = normalizarBusca(campo);
    if (!valor) return false;
    if (valor.includes(t)) return true;
    return soNumeros && digitos.length >= 3 && valor.replace(/\D/g, '').includes(digitos);
  });
};
