/**
 * Como o valor a pagar se chama, para cada tipo de inscrito.
 *
 * A organizacao definiu que o que o EQUIPANTE paga nao e taxa de inscricao --
 * ele vai servir, nao participar --, e sim TAXA DE ALIMENTACAO. Para o
 * acampante segue sendo taxa de inscricao.
 *
 * As telas de pagamento (PIX e manual) sao as MESMAS para os dois tipos, e
 * so sabem quem e pelo "tipo" que vem da navegacao. Por isso o texto mora
 * aqui, num lugar so: se amanha o nome mudar de novo, muda-se aqui e todas
 * as telas acompanham -- em vez de alguem ter que lembrar de trocar em cinco
 * arquivos e esquecer de um.
 */

const EH_EQUIPANTE = (tipo) => tipo === 'equipante';

/** Rotulo curto, para titulo de campo. Ex.: "Taxa de Alimentação" */
export const rotuloValor = (tipo) =>
  EH_EQUIPANTE(tipo) ? 'Taxa de Alimentação' : 'Valor da Inscrição';

/** Como citar no meio de uma frase. Ex.: "...o valor da taxa de alimentação." */
export const rotuloValorEmFrase = (tipo) =>
  EH_EQUIPANTE(tipo) ? 'a taxa de alimentação' : 'o valor da inscrição';

/** O que esta sendo pago. Ex.: "pagamento da sua taxa de alimentação" */
export const rotuloDoQueSePaga = (tipo) =>
  EH_EQUIPANTE(tipo) ? 'sua taxa de alimentação' : 'sua inscrição';
