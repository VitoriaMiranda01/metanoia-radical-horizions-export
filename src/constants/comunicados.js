/**
 * Modelos do comunicado (texto aprovado pelo Patrick em 05/11/2026). So
 * preenchem o campo no modulo de Configuracoes: o que vale e o texto gravado em
 * cada pessoa. O titulo e o pedido da frase sao fixos na tela do comunicado.
 */
export const FRASE_CIENCIA = 'Declaro que estou ciente';

export const TITULO_COMUNICADO = 'Comunicado da Organização do Metanoia Radical Serra';

export const MODELOS_COMUNICADO = [
  {
    chave: 'sem_inscricao_sem_carta',
    rotulo: 'Sem inscrição prévia e sem carta pastoral',
    texto: `Informamos que, na 37ª edição, você compareceu à portaria do sítio sem ter realizado a inscrição previamente e sem apresentar a carta de autorização pastoral. Tal situação gerou transtornos à organização do projeto.

Diante do ocorrido, reiteramos as seguintes normas:

1. A inscrição deve ser realizada antecipadamente, na data da reunião de inscrição.
2. A autorização pastoral é requisito indispensável. Sem ela, não é possível participar nem atuar no projeto, em razão das diversas falhas que a sua ausência pode ocasionar e da necessidade de manter a organização do evento.

Caso haja nova tentativa de entrada no sítio sem inscrição prévia e/ou sem autorização pastoral, a entrada não será autorizada e você será orientada a retornar à sua residência, sem participação no projeto.`,
  },
  {
    chave: 'sem_carta',
    rotulo: 'Inscrição feita, mas sem autorização pastoral',
    texto: `Informamos que, na 37ª edição, você realizou a inscrição, porém compareceu à portaria do sítio sem apresentar a autorização pastoral. Tal situação gerou transtornos à organização do projeto.

Diante do ocorrido, reiteramos a seguinte norma:

A autorização pastoral é requisito indispensável. Sem ela, não é possível participar nem atuar no projeto, em razão das diversas falhas que a sua ausência pode ocasionar e da necessidade de manter a organização do evento.

Caso haja nova tentativa de entrada no sítio sem autorização pastoral, a entrada não será autorizada e você será orientada a retornar à sua residência, sem participação no projeto.`,
  },
  {
    chave: 'pastor_sem_inscricao',
    rotulo: 'Pastor sem inscrição prévia',
    texto: `Informamos que, na 37ª edição, você compareceu à portaria do sítio sem ter realizado a inscrição previamente. Tal situação gerou transtornos à organização do projeto.

Diante do ocorrido, reiteramos a seguinte norma:

A inscrição deve ser realizada antecipadamente, na data da reunião de inscrição, a fim de evitar prejuízos à organização do projeto.

Caso haja nova tentativa de entrada no sítio sem inscrição prévia, a entrada não será autorizada e você será orientado a retornar à sua residência, sem participação no projeto.`,
  },
];
