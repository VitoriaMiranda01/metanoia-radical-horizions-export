export const WORK_AREAS = [
  "Contêiner",
  "Copa",
  "Cozinha",
  "Cracolândia",
  "Cristolandia",
  "Dia do arrebatamento da igreja",
  "Disponível para qualquer área 1",
  "Disponível para qualquer área 2",
  "Disponível para qualquer área 3",
  "Espírito Santo",
  "Falsa baiana",
  "Família",
  "Família muçulmana",
  "Fotografia",
  "Guia",
  "Hospital (Cena teatral)",
  "Igreja subterrânea",
  "Inimigo",
  "Invisível",
  "Logística",
  "Louvor nas cenas",
  "Marcador",
  "Oração Itinerante",
  "Pastor Enforcado",
  "Perseguidos",
  "Presídio",
  "Primeiros socorros - Saúde",
  "Recepção",
  "Segurança",
  "Selva",
  "Teatro",
  "Túmulo"
];

export const DEFAULT_AREA_CAPACITY = 5;

// As 3 areas acima que existem em WORK_AREAS e ja aparecem na tela de
// escalas, mas foram deliberadamente excluidas da lista AREAS do
// formulario de equipante (src/components/inscricao/AreasDeTrabalho.jsx)
// -- ninguem se inscreve pra elas diretamente. O organizador informa os
// CPFs de quem vai pra cada uma em Configuracoes
// (src/components/organizer/CpfsAreaEspecialManager.jsx) e o botao
// "Alocar Áreas Especiais" na tela de escalas
// (src/pages/OrganizerScalesPage.jsx) realoca, por CPF, quem ja esta
// alocado em outra area pra area especial configurada. `key` e o sufixo
// usado nas colunas cpfs_area_* (configuracoes) e no service; `label` e o
// nome exibido, igual ao que aparece em WORK_AREAS.
export const AREAS_ESPECIAIS = [
  { key: 'guia', label: 'Guia' },
  { key: 'inimigo', label: 'Inimigo' },
  { key: 'espirito_santo', label: 'Espírito Santo' }
];