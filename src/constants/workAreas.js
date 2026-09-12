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
  { valor: 'Recepção' },
  { valor: 'Segurança' },
  { valor: 'Selva' },
  { valor: 'Teatro' },
  { valor: 'Túmulo' }
];

export { AREA_DISPONIVEL_QUALQUER };

// As 3 areas que existem na tela de escalas mas foram deliberadamente
// excluidas do formulario -- ninguem se inscreve pra elas diretamente. O
// organizador informa os CPFs de quem vai pra cada uma em Configuracoes
// (src/components/organizer/CpfsAreaEspecialManager.jsx) e o botao "Alocar
// Áreas Especiais" na tela de escalas (src/pages/OrganizerScalesPage.jsx)
// realoca, por CPF, quem ja esta alocado em outra area pra area especial
// configurada. `key` e o sufixo usado nas colunas cpfs_area_*
// (configuracoes) e no service; `label` e o nome exibido, que e tambem o
// nome canonico da area.
export const AREAS_ESPECIAIS = [
  { key: 'guia', label: 'Guia' },
  { key: 'inimigo', label: 'Inimigo' },
  { key: 'espirito_santo', label: 'Espírito Santo' }
];

// Areas que a tela de escalas mostra, uma tabela para cada.
//
// "Disponível para qualquer área" NAO entra aqui, e de proposito: ela e uma
// PREFERENCIA ("me ponha onde precisar"), nao um lugar de trabalho. Quem
// escolhe essa opcao e mandado pela funcao do banco para a area configurada
// com mais vagas livres no momento (ver
// database/migrations/schema-update-20260912d-escalas-alocacao.sql). Antes
// desta correcao essas pessoas ficavam empilhadas numa area ficticia de
// mesmo nome, com teto de 15 -- da 16a em diante iam para a lista de espera
// mesmo tendo dito que aceitavam qualquer area.
export const WORK_AREAS = [
  ...AREAS_INSCRICAO.map(a => a.valor).filter(v => v !== AREA_DISPONIVEL_QUALQUER),
  ...AREAS_ESPECIAIS.map(a => a.label)
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

// Teto de uma area que nunca foi configurada em limites_areas. Espelha o
// mesmo padrao dentro da funcao do banco (_equipante_area_tem_vaga) -- se
// mudar aqui, mude la tambem.
//
// Na pratica todas as 30 areas passaram a ter limite proprio, semeado a
// partir das edicoes 33/35/36 (ver a migration citada acima); este valor so
// vale para uma area nova que alguem crie sem configurar.
export const DEFAULT_AREA_CAPACITY = 5;
