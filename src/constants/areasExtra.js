// As 3 disponibilidades opcionais do fim do formulario de equipante.
//
// Ate agora a lista morava dentro de AreasDeTrabalho.jsx e nao existia em
// nenhum outro lugar -- a informacao era gravada numa unica coluna de texto
// (equipantes.area_trabalho_extra, com as frases coladas por "; ") e nenhuma
// tela do organizador transformava aquilo numa relacao de quem se ofereceu.
//
// Mesmo remedio de workAreas.js: uma lista so, aqui, usada pelo formulario e
// pela tela de Geracao de Escalas. `frase` e exatamente o texto que vai para
// o banco -- mudar isso muda o que fica gravado dali em diante. `chave` e o
// que o banco usa nas decisoes (tabela disponibilidade_extra); ela e casada
// no servidor por palavra-chave sem acento, entao ajustar a `frase` nao
// quebra as decisoes ja tomadas.
export const AREAS_EXTRA = [
  {
    chave: 'caminhao',
    rotulo: 'Caminhão — quinta, 19h',
    detalhe: 'Carregar o caminhão na Centenário',
    frase: 'Disponível para ajudar a carregar o caminhão na Centenario Quinta-Feira 19h.'
  },
  {
    chave: 'cozinha',
    rotulo: 'Cozinha — sexta à tarde',
    detalhe: 'Preparar o lanche dos acampantes na Centenário',
    frase: 'Disponível para cozinha da Centenario na Sexta-Feira a tarde preparando o lanche dos ACAMPANTES.'
  },
  {
    chave: 'limpeza',
    rotulo: 'Limpeza — sexta, após a saída',
    detalhe: 'Limpar a Centenário depois que os acampantes saírem',
    frase: 'Disponível para ajudar na limpeza da Centenario após a saída dos ACAMPANTES na Sexta-Feira.'
  }
];

export const FRASES_AREAS_EXTRA = AREAS_EXTRA.map((a) => a.frase);

export const areaExtraPorChave = (chave) =>
  AREAS_EXTRA.find((a) => a.chave === chave) || null;

export const rotuloAreaExtra = (chave) => areaExtraPorChave(chave)?.rotulo || chave;
