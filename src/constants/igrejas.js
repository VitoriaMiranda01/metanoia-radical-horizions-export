// Lista de igrejas/organizacoes parceiras, usada tanto no campo
// "Administrador Responsavel pela Ficha" (formulario de acampante) quanto
// no campo "Igreja que frequenta" do formulario de equipante. Extraida
// originalmente de AdminResponsavel.jsx (2026-09-02).
//
// Numerada a pedido da usuaria ("01 - ", "02 - " etc).
//
// ATUALIZADA em 2026-09-10: lista trocada por completo pela usuaria, a
// partir de uma planilha (nova_tabela_igrejas.xlsx) com 146 igrejas e seus
// codigos correspondentes. A ORDEM AQUI NAO E ALFABETICA -- e a ordem
// exata da planilha, escolhida propositalmente pela usuaria (confirmado
// explicitamente: "as igrejas nao estao em ordem alfabetica,
// propositalmente"). Os nomes tambem foram transcritos exatamente como
// vieram da planilha dela, sem correcao de acentuacao/grafia -- ao
// contrario da lista antiga (ver historico abaixo), aqui o conteudo veio
// pronto e confirmado pela usuaria, entao nao fiz ajustes de ortografia
// por conta propria.
//
// IMPORTANTE -- pendencia conhecida (decisao da usuaria em 2026-09-10):
// esses mesmos numeros de prefixo tambem sao usados, em outro lugar do
// sistema, como codigo de login das igrejas parceiras (tabela
// igrejas_parceiras no Supabase, ver src/services/authService.js /
// igrejaLogin). Essa tabela AINDA NAO foi sincronizada com essa lista
// nova -- ela continua com os codigos/nomes da lista antiga (141 contas,
// codigos "01" a "141"). A usuaria decidiu, por ora, atualizar so esta
// lista (a que aparece nos formularios); a sincronizacao da tabela de
// login fica pra depois, a pedido dela. Ate isso ser feito, o numero que
// aparece aqui pra uma igreja NAO necessariamente corresponde ao codigo
// de login real dela hoje.
//
// Por esse mesmo motivo, excecoes de limite por igreja ja configuradas em
// Configuracoes -> Limite de Acampantes por Igreja (tabela
// limites_igrejas, guardada pelo texto exato "NN - Nome" da igreja)
// podem ter ficado "orfas" apos essa troca, se a igreja em questao mudou
// de nome/numero nesta lista -- vale conferir/reconfigurar essas
// excecoes depois da troca.
//
// Historico da lista antiga (141 igrejas, ordem alfabetica pt-BR,
// substituida por completo em 2026-09-10):
//   Ordem antiga era por comparacao de locale pt-BR
//   (a.localeCompare(b, "pt-BR")) em vez do `.sort()` padrao do
//   JavaScript. Correcoes de conteudo feitas em 2026-09-02 (confirmadas
//   com a usuaria antes de aplicar): acentuacao faltando em varias
//   entradas, "ASSASSEMBLEIA" -> "ASSEMBLEIA", "GENESIS" -> "GENESIS"
//   (nome proprio), "MOTAS" -> "MOTTAS" em uma entrada especifica.
//   Essas correcoes NAO foram reaplicadas na lista nova -- ver nota acima.
//
// IMPORTANTE: este array NAO deve ser "`.sort()`"-ado em tempo de
// execucao -- a ordem aqui embaixo e a ordem final, de proposito (nem
// alfabetica, nem numerica por string).
export const IGREJAS_PARCEIRAS = [
  "01 - MINISTÉRIO ARCA DA ALIANÇA",
  "02 - COMUNIDADE KADOSH",
  "03 - IGREJAS DE PETRÓPOLIS",
  "04 - MISSIONÁRIA NOVO ISRAEL",
  "05 - ASSEMBLEIA DE DEUS CAMINHO CELESTE",
  "06 - METODISTA EM SERRA DO CAPIM",
  "07 - ASSEMBLEIA DE DEUS CENTRO MISSIONÁRIO CRISTÃO",
  "08 - METODISTA CASA FAVORITA - RESENDE",
  "09 - ASSEMBLEIA DE DEUS DE VARGEM GRANDE CONGREGAÇÃO SERRINHA",
  "10 - IGREJA DE DEUS EM PIMENTEIRAS",
  "11 - METODISTA EM OLARIA - NOVA FRIBURGO RJ",
  "12 - PENTECOSTAL RENASCENDO DAS CINZAS",
  "13 - NOVA ASSEMBLEIA DE DEUS EM TERESÓPOLIS",
  "14 - PIB EM VIEIRA TERESÓPOLIS",
  "15 - MINISTÉRIO DA FÉ.",
  "16 - IGREJA DE CRISTO EM TERESÓPOLIS",
  "17 - ASSEMBLEIA DE DEUS DE TERESÓPOLIS - SEDE",
  "18 - ASSEMBLEIA DE DEUS DE TERESÓPOLIS - SUBSEDE SÃO PEDRO",
  "19 - ASSEMBLEIA DE DEUS DE TERESÓPOLIS - SUBSEDE PESSEGUEIROS",
  "20 - ASSEMBLEIA DE DEUS DE TERESÓPOLIS - SUBSEDE BARRA IMBUÍ",
  "21 - PRIMEIRA IGREJA BATISTA DE BONSUCESSO PIBB",
  "22 - MINISTÉRIO PROFÉTICO KEMUEL.",
  "23 - BATISTA EM TERESÓPOLIS",
  "24 - FILADELFIA",
  "25 - METODISTA NOVA SUÍÇA",
  "26 - MISSIONARIA EVANGELICA DEUS É PRIORIDADE",
  "27 - HEBROM CHURCH",
  "28 - JESUS É ALIANCA",
  "29 - JESURUM",
  "30 - COMUNIDADE EVANGÉLICA MINISTÉRIO INTERNACIONAL ALIANÇA EM CRISTO",
  "31 - AD NOVA GERAÇÃO CEMAE",
  "32 - BATISTA EM BARRA DO IMBUI",
  "33 - MINISTERIO FAMILIA EM GRAÇA",
  "34 - AD FAMÍLIA EM CRISTO.",
  "35 - PROJETO SEMEAR EM CRUZEIRO",
  "36 - METODISTA DE MACUCO",
  "37 - BATISTA BETEL EM VENDA NOVA",
  "38 - ASSEMBLEIA DE DEUS MINISTÉRIO FORÇA E HONRA",
  "39 - ASSEMBLEIA DE DEUS NO MEUDON",
  "40 - ASSEMBLEIA DE DEUS VINDE A MIM RIO DAS OSTRAS",
  "41 - PENTECOSTAL JUSTIFICADOS PELA FÉ",
  "42 - METODISTA DE VARGEM GRANDE",
  "43 - PRESBITERIANA DO MEUDON",
  "44 - METODISTA EM CAMPO DO COELHO",
  "45 - NOVA IGREJA DE CRISTO DA BARRA",
  "46 - BATISTA DE SOLEDADE",
  "47 - JAT MEUDON",
  "48 - BATISTA MONTE DAS OLIVEIRAS -MISSÃO CORÉIA.",
  "49 - ASSEMBLEIA DE DEUS DA CASCATA DO IMBUÍ.",
  "50 - PENTECOSTAL TABERNÁCULO DA GRAÇA ÁGUA QUENTE",
  "51 - ASSEMBLEIA DE DEUS VISÃO MISSIONÁRIA (ADVM)",
  "52 - JAT - SEDE",
  "53 - CASA DO PAI",
  "54 - BATISTA EBENEZER EM MOTAS",
  "55 - CARA DE LEÃO DUQUE DE CAXIAS",
  "56 - MINISTÉRIO DEUS DAR VIDA",
  "57 - BATISTA DA FAMÍLIA EM BONSUCESSO",
  "58 - BATISTA MONTE DAS OLIVEIRAS SEDE",
  "59 - MINISTÉRIO BENDITO EU SOU.",
  "60 - CARA DE LEÃO TERESÓPOLIS",
  "61 - PRIMEIRA IGREJA BATISTA EM VARGEM GRANDE",
  "62 - CASA DE ORAÇÃO SÃO PEDRO",
  "63 - COPETE",
  "64 - METODISTA CENTENÁRIO",
  "65 - COMUNIDADE PENTECOSTAL É HORA DE AVIVAMENTO",
  "66 - PRESBITERIANA MONTE MORIAH",
  "67 - UNIDOS PELA FE EM DEUS",
  "68 - BATISTA JERUEL",
  "69 - COMUNIDADE EVANGÉLICA VIDA EM COMUNHÃO",
  "70 - MINISTÉRIO APOSTÓLICO CASA DE LOUVOR",
  "71 - BATISTA DE BALANÇA",
  "72 - ASSEMBLEIA DE DEUS CENTRO CRISTÃO MISSIONÁRIO EM VIEIRA",
  "73 - CRISTÃ MUNDIAL",
  "74 - JAT – CONGREGAÇÃO UNAMAR",
  "75 - MINISTÉRIO VINDE A MIM – CASIMIRO DE ABREU",
  "76 - CONGREGAÇÃO METODISTA PRATA",
  "77 - BATISTA SERRA DOS ÓRGÃOS",
  "78 - METODISTA CENTRAL",
  "79 - BRASIL PARA CRISTO",
  "80 - METODISTA EM BONSUCESSO",
  "81 - ASSEMBLEIA DE DEUS MINISTERIO BETEL",
  "82 - CASA DO LEÃO",
  "83 - PROJETO SEMEAR SANTA CECÍLIA",
  "84 - DIVERSOS",
  "85 - MISSÃO METODISTA MEUDON",
  "86 - BATISTA NOVA CANAÃ",
  "87 - CONGREGAÇÃO CRISTÃO ATITUDE FÉ",
  "88 - METODISTA EM CORDEIRO",
  "89 - ASSEMBLEIA DE DEUS DA FAMÍLIA",
  "90 - ASSEMBLEIA DE DEUS CELEBRANDO AO SENHOR",
  "91 - ASSEMBLEIA DEUS MONTE CARMELO",
  "92 - BATISTA EM AGUA QUENTE",
  "93 - PENTECOTAL JESUS É O CAMINHO DEUS É O SENHOR",
  "94 - ASSEMBLEIA DE DEUS IDE - SJVRP",
  "95 - ASSEMBLEIA DE DEUS EM SALINAS",
  "96 - METODISTA CENTENÁRIO CAMPUS CORÉIA",
  "97 - JAT - PIMENTEL",
  "98 - COMUNIDADE INTERNACIONAL GENESIS",
  "99 - ASSEMBLEIA DE DEUS RESTAURAR",
  "100 - IGREJA DAS NAÇÕES",
  "101 - METODISTA EM VILA DO PIÃO",
  "102 - METODISTA EM ANDORINHAS",
  "103 - BATISTA APARECIDA",
  "104 - MINISTÉRIO RECOMEÇAR EM CRISTO",
  "105 - ADEC",
  "106 - ASSEMBLEIA DE DEUS NOVA ALIANÇA COM CRISTO",
  "107 - ASSEMBLEIA DE DEUS DO UNIVERSO",
  "108 - BATISTA JERUEL PETROPOLIS",
  "109 - BATISTA AGUA VIVA",
  "110 - EDIÇÕES ANTERIORES",
  "111 - BATISTA EM RENOVAÇÃO ESPIRITUAL MONTE SINAI",
  "112 - ASSEMBLEIA DE DEUS MINISTÉRIO INTEGRAÇÃO",
  "113 - COMUNIDADE É TEMPLO DA FÉ",
  "114 - ASSEMBLEIA DO AMOR",
  "115 - SEGUNDA IGREJA BATISTA DO MEUDON",
  "116 - A CASA DO MESTRE",
  "117 - ASSEMBLEIA DE DEUS ADORAI",
  "118 - CASA DE ORAÇÃO VIDEIRA",
  "119 - CONGREGACIONAL VEM VIVER",
  "120 - BATISTA NO BATUME",
  "121 - ASSEMBLEIA DE DEUS FILADÉLFIA",
  "122 - BRASIL PARA CRISTO DE PIÃO",
  "123 - MINISTERIO AJOELHAR",
  "124 - ESPAÇO VIDA",
  "125 - COLHEITA CHURCH",
  "126 - PENTECOSTAL RESTAURAÇÃO DIVINA",
  "127 - COMUNIDADE CRISTÃ ENCONTRO ROSÁRIO",
  "128 - BATISTA JERUEL EM SAPUCAIA",
  "129 - BATISTA EM TERESÓPOLIS",
  "130 - LUUZ CHURCH",
  "131 - JAT - QUINTA LEBRÃO",
  "132 - ASSASSEMBLEIA DE DEUS MINISTÉRIO VINDE A MIM UNAMAR",
  "133 - ASSEMBLEIA DE DEUS PEDRA DE DAVI",
  "134 - VIDA ABUNDANTE",
  "135 - IGREJA PENTECOSTAL ICTHUS",
  "136 - IGREJA BATISTA DE MOTTAS",
  "137 - ASSEMBLEIA DE DEUS PENTECOSTE VIVO",
  "138 - IGREJA BATISTA DO RECREIO DOS BANDEIRANTES RJ",
  "139 - BATISTA RENOVADA JERUEL EM SÃO JOSÉ DO VALE DO RIO PRETO",
  "140 - IGREJA PENTECOATAL CRISTO ESPERANÇA NOSSA",
  "141 - IGREJA BATISTA DO ALTO",
  "142 - IGREJA BATISTA NOVA FILADÉLFIA",
  "143 - IGREJA NOVOS COMEÇOS",
  "144 - IGREJA METODISTA CAMPUS ALBUQUERQUE",
  "145 - PARQUE FLUMINENSE BELFORD ROXO",
  "146 - BATISTA JERUEL TRÊS RIOS",
];
