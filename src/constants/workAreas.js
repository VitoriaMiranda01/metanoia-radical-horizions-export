// ---------------------------------------------------------------------------
// Areas de trabalho -- FONTE UNICA.
//
// Antes desta versao existiam DUAS listas de areas, escritas a mao em dois
// arquivos diferentes: uma no formulario do equipante
// (src/components/inscricao/AreasDeTrabalho.jsx) e outra aqui, usada pela
// tela de Geracao de Escalas. Cinco nomes divergiam entre as duas -- as
// vezes so por causa de uma letra maiuscula ou de um traco diferente:
//
//   FORMULARIO gravava                              | TELA DE ESCALAS procurava
//   ------------------------------------------------|--------------------------
//   Fotografia (necessário possuir equipamento ...) | Fotografia
//   Hospital (cena teatral)                          | Hospital (Cena teatral)
//   Oração itinerante                                | Oração Itinerante
//   Pastor enforcado                                 | Pastor Enforcado
//   Primeiros socorros – Saúde   (traco "–", longo)  | Primeiros socorros - Saúde  ("-")
//
// O efeito era invisivel e serio: quem escolhia uma dessas 5 areas era
// alocado normalmente no banco, mas a tela de escalas agrupa por nome
// exato -- entao a pessoa nao aparecia em area nenhuma. Nem na lista de
// espera (ela TEM alocacao). Simplesmente sumia. No teste com 120
// equipantes, 10 sumiram assim; nas proporcoes de uma edicao real (~850
// equipantes) seriam cerca de 90 pessoas fora da escala. O limite
// configurado para "Fotografia" tambem nunca valia, pelo mesmo motivo.
//
// Agora existe uma lista so. Cada area tem:
//   - `valor`: o nome CANONICO, o unico que vai para o banco
//     (equipantes.area_trabalho_opcao*, escalas.area_alocada,
//     limites_areas.area_nome);
//   - `rotulo`: o texto exibido no formulario, quando precisa ser mais
//     explicado que o nome canonico. Mudar o rotulo nao mexe em nada
//     gravado; mudar o `valor` mexe -- e ai precisa de migracao.
// ---------------------------------------------------------------------------

const AREA_DISPONIVEL_QUALQUER = 'Disponível para qualquer área';

// Onde vai quem a Direcao decidiu que nao entra na escala. Ver o comentario
// em AREAS_SOMENTE_ORGANIZADOR, abaixo.
export const AREA_NAO_SERA_ESCALADO = 'Não será escalado';

// Areas que o equipante pode escolher nas 3 opcoes de preferencia.
export const AREAS_INSCRICAO = [
  { valor: 'Contêiner' },
  { valor: 'Copa' },
  { valor: 'Cozinha' },
  { valor: 'Cracolândia' },
  { valor: 'Cristolândia' },
  { valor: 'Dia do arrebatamento da igreja' },
  { valor: AREA_DISPONIVEL_QUALQUER },
  { valor: 'Falsa baiana' },
  { valor: 'Família' },
  { valor: 'Família muçulmana' },
  { valor: 'Fotografia', rotulo: 'Fotografia (necessário possuir equipamento próprio)' },
  { valor: 'Hospital (Cena teatral)', rotulo: 'Hospital (cena teatral)' },
  { valor: 'Igreja subterrânea' },
  { valor: 'Invisível' },
  { valor: 'Logística' },
  { valor: 'Louvor nas cenas' },
  { valor: 'Marcador' },
  { valor: 'Oração Itinerante', rotulo: 'Oração itinerante' },
  { valor: 'Pastor Enforcado', rotulo: 'Pastor enforcado' },
  { valor: 'Perseguidos' },
  { valor: 'Presídio' },
  { valor: 'Primeiros socorros - Saúde', rotulo: 'Primeiros socorros – Saúde' },
  // Recepção saiu daqui em 12/09/2026: quem trabalha na recepcao (e em
  // qual das duas) e sempre escolha do organizador. Ver
  // AREAS_SOMENTE_ORGANIZADOR abaixo.
  { valor: 'Segurança' },
  { valor: 'Selva' },
  { valor: 'Teatro' },
  { valor: 'Túmulo' }
];

export { AREA_DISPONIVEL_QUALQUER };

// Os 3 papeis que atravessam o acampamento inteiro. Ficam fora do
// formulario de inscricao -- ninguem se candidata a eles -- e sao escolhidos
// pelo organizador na tela de Geracao de Escalas, como qualquer outra area.
//
// Ate 12/09/2026 havia um segundo caminho: listas de CPF em Configuracoes
// mais um botao "Alocar Áreas Especiais" que aplicava tudo de uma vez. Dois
// lugares para dizer a mesma coisa, que podiam discordar entre si. O Patrick
// decidiu ficar so com a tela de escalas, e o outro caminho foi removido.
//
// Uma pessoa so pode ter UM destes tres (roteiros simultaneos, ninguem
// cumpre dois). A regra e do banco -- _area_especial(), migration 20260912t
// --, e esta lista precisa continuar espelhando a de la.
//
// `label` e o nome exibido, que e tambem o nome canonico da area.
export const AREAS_ESPECIAIS = [
  { key: 'guia', label: 'Guia' },
  { key: 'inimigo', label: 'Inimigo' },
  { key: 'espirito_santo', label: 'Espírito Santo' }
];

// Areas que existem na escala oficial e NAO sao oferecidas ao equipante: quem
// trabalha nelas e escolhido pela diretoria. Aparecem na tela de Geracao de
// Escalas (com tabela propria e como destino de "Realocar"), mas nunca no
// formulario de inscricao nem na alocacao automatica.
//
// Diferem das AREAS_ESPECIAIS acima em uma coisa so: naquelas, uma pessoa
// nao pode acumular duas. Aqui pode.
//
// No banco as duas familias sao a mesma coisa: limites_areas.somente_organizador
// = true (ver schema-update-20260912e). E essa coluna, e nao esta lista, que
// impede a alocacao automatica e o coringa de mandarem gente para ca.
//
// Sao ~60 pessoas por edicao (6,6% da escala) que ate agora nao cabiam no
// sistema.
export const AREAS_SOMENTE_ORGANIZADOR = [
  'Apresentadores',
  'Ataque / Madrugada',
  'Base Operacional',
  'Depressão',
  'Equipe de Manutenção',
  'Estacionamento',
  'Infiltrados',
  'Pastor Invisível',
  // As duas recepcoes entraram aqui em 12/09/2026: o equipante nao escolhe
  // recepcao. E o organizador que separa quem fica na mesa de cracha da
  // igreja e quem recebe no sitio.
  'Recepção Igreja',
  'Recepção Sítio',
  'Secretaria',
  'Som / Multimídia',
  'Som / Projeção',
  // Nao e cena: e o destino de quem foi aprovado pela igreja mas nao entrou
  // na escala (excesso de gente, por exemplo). Existe para que a fila "A
  // escalar" consiga zerar -- e a fila zerada e o que libera o lancamento.
  // Depois de lancada a escala, essa pessoa ve "Cancelado -- verificar com
  // a Direcao" e nao consegue pagar.
  AREA_NAO_SERA_ESCALADO
];

// "Teatro" e "Louvor nas cenas" NAO sao cena nenhuma -- sao pergunta. No
// formulario elas servem para a pessoa dizer que prefere cena teatral, ou
// que quer tocar/cantar em cena. Quem decide para qual cena de verdade ela
// vai (Cristolândia, Pastor Enforcado, Família, Túmulo...) e o organizador,
// na geracao de escalas.
//
// Por isso, desde 12/09/2026, elas ficam SO no formulario: nao sao area na
// tela de escalas e ninguem pode ser alocado nelas -- mesmo tratamento de
// "Disponível para qualquer área". A escolha continua aparecendo embaixo do
// nome na fila "A escalar", como sugestao.
export const AREAS_SO_PREFERENCIA = [
  AREA_DISPONIVEL_QUALQUER,
  'Teatro',
  'Louvor nas cenas'
];

// ---------------------------------------------------------------------------
// Cores dos grupos de trilha.
//
// Nove areas trabalham divididas por cor -- ha 5 guias no vermelho e 5 no
// verde, e cada cor tem o seu lider. A cor NAO e obrigatoria: e identificacao,
// nao regra. Ate 12/09/2026 ela era gravada no campo de atuacao, o que nao
// deixava espaco para dizer a funcao da pessoa (e por isso "Invisível" tinha
// inventado dez atuacoes do tipo "Líder / Amarelo").
//
// Espelha _area_com_cor() no banco (migration 20260912v). Mudou aqui, muda la.
// ---------------------------------------------------------------------------
export const CORES_GRUPO = ['Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho'];

export const AREAS_COM_COR = [
  'Espírito Santo',
  'Fotografia',
  'Guia',
  'Infiltrados',
  'Inimigo',
  'Invisível',
  'Marcador',
  'Pastor Invisível',
  'Recepção Sítio'
];

export const areaTemCor = (area) => AREAS_COM_COR.includes(area);

// Areas que a tela de escalas mostra, uma tabela para cada.
//
// As de AREAS_SO_PREFERENCIA ficam de fora, de proposito: sao respostas do
// formulario ("me ponha onde precisar", "prefiro cena teatral", "quero
// tocar em cena"), nao lugares de trabalho. Ninguem e alocado nelas -- o
// organizador ve a escolha na fila "A escalar" e decide o destino.
export const WORK_AREAS = [
  ...AREAS_INSCRICAO.map(a => a.valor).filter(v => !AREAS_SO_PREFERENCIA.includes(v)),
  ...AREAS_ESPECIAIS.map(a => a.label),
  ...AREAS_SOMENTE_ORGANIZADOR
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

// Teto de uma area que nunca foi configurada em limites_areas. Espelha o
// mesmo padrao dentro da funcao do banco (_equipante_area_tem_vaga) -- se
// mudar aqui, mude la tambem.
//
// Na pratica todas as 30 areas passaram a ter limite proprio, semeado a
// partir das edicoes 33/35/36 (ver a migration citada acima); este valor so
// vale para uma area nova que alguem crie sem configurar.
export const DEFAULT_AREA_CAPACITY = 5;
