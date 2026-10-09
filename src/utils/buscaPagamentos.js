import { casaBusca } from '@/utils/busca';

/**
 * Busca da tela de Pagamentos (Patrick, 09/10/2026): antes so olhava nome, CPF
 * e WhatsApp; igreja, pastor e as colunas escolhidas em "Colunas" nao eram
 * achadas. Agora procura no texto de cada coluna -- o mesmo que a tela mostra e
 * que o funil filtra (valorDe) --, sem diferenca de maiuscula nem de acento, e
 * numeros ("123.456", "99999") tambem pelos digitos (utils/busca.js).
 *
 * Os textos de "falta o dado" ("Não informado", "Sem igreja"...) nao entram na
 * busca: senao "nao" ou "sem" achariam meio mundo. Para achar quem esta sem,
 * use o funil da coluna.
 */

// Sempre buscados, mesmo com a coluna escondida.
export const CHAVES_SEMPRE_BUSCADAS = ['nome', 'cpf', 'whatsapp', 'igreja', 'pastor_nome', 'email'];

const SEM_DADO = new Set([
  'Não informado', 'Sem igreja', 'Sem área', 'Sem cupom', 'Sem valor registrado', 'Não escolheu', '—',
]);

export const casaBuscaPagamento = (termo, item, chaves, valorDe) => {
  const campos = [];
  chaves.forEach((chave) => {
    const valor = valorDe(item, chave);
    if (valor && !SEM_DADO.has(valor)) campos.push(valor);
  });
  // Numero cru da ficha: o CPF e o WhatsApp gravados sem pontuacao tambem casam.
  campos.push(item.cpf, item.whatsapp);
  return casaBusca(termo, campos);
};
