export const COLUMN_DEFINITIONS = {
  equipantes: [
    // Identificação
    { key: 'cpf', label: 'CPF', group: 'Pessoal' },
    // "Telefone" aponta pra whatsapp -- nao existe coluna "telefone" na
    // tabela equipantes (o telefone informado no formulario vira o campo
    // whatsapp). Mesma correcao que ja tinha sido feita aqui pra
    // acampantes; faltava replicar pra equipantes (ate 2026-09-03 essa
    // coluna sempre aparecia vazia).
    { key: 'whatsapp', label: 'Telefone', group: 'Contato' },
    { key: 'idade', label: 'Idade', group: 'Pessoal' },
    { key: 'sexo', label: 'Gênero', group: 'Pessoal' },

    // Endereço (campo calculado: junta endereco + numero + complemento + bairro)
    { key: 'endereco_completo', label: 'Endereço Completo', group: 'Endereço' },
    { key: 'cidade', label: 'Cidade', group: 'Endereço' },
    { key: 'estado', label: 'Estado', group: 'Endereço' },
    { key: 'cep', label: 'CEP', group: 'Endereço' },

    // Eclesiástico
    { key: 'igreja', label: 'Igreja', group: 'Eclesiástico' },
    { key: 'cargo_igreja', label: 'Função na Igreja', group: 'Eclesiástico' },

    // Serviço (campo calculado: junta area_trabalho_opcao1/2/3)
    { key: 'area_trabalho', label: 'Área de Trabalho', group: 'Serviço' },

    // Emergência
    { key: 'contato_emergencia_nome', label: 'Contato Emergência', group: 'Emergência' },
    { key: 'contato_emergencia_telefone', label: 'Tel. Emergência', group: 'Emergência' },

    // Status
    { key: 'status_pagamento', label: 'Status Pagamento', group: 'Sistema' },
    { key: 'metodo_pagamento', label: 'Método Pagamento', group: 'Sistema' },
    { key: 'status', label: 'Status', group: 'Sistema' }
  ],
  acampantes: [
    // Identificação
    // "Email" (que existia aqui) foi removido em 2026-09-03: a tabela
    // acampantes tem a coluna, mas nenhum formulario atual (equipante ou
    // acampante) pede email, entao a opcao sempre aparecia vazia.
    { key: 'cpf', label: 'CPF', group: 'Pessoal' },
    { key: 'whatsapp', label: 'WhatsApp', group: 'Contato' },
    { key: 'idade', label: 'Idade', group: 'Pessoal' },
    { key: 'sexo', label: 'Gênero', group: 'Pessoal' },

    // Endereço (campo calculado: junta endereco + numero + complemento + bairro)
    { key: 'endereco_completo', label: 'Endereço Completo', group: 'Endereço' },
    { key: 'cidade', label: 'Cidade', group: 'Endereço' },
    { key: 'estado', label: 'Estado', group: 'Endereço' },
    { key: 'cep', label: 'CEP', group: 'Endereço' },

    // Acampamento
    { key: 'igreja', label: 'Igreja', group: 'Eclesiástico' },
    // cargo_igreja existe na tabela desde a migration schema-update-
    // 20260901c (o formulario de acampante ja pergunta isso); a opcao so
    // nao tinha sido adicionada aqui ainda -- adicionada em 2026-09-03.
    { key: 'cargo_igreja', label: 'Função na Igreja', group: 'Eclesiástico' },
    { key: 'grupo_trailha', label: 'Grupo de Trilha', group: 'Acampamento' },
    { key: 'tamanho_camisa', label: 'Camiseta', group: 'Acampamento' },

    // Saúde
    { key: 'condicoes_medicas', label: 'Condições Médicas', group: 'Saúde' },
    { key: 'medicamentos', label: 'Medicamentos', group: 'Saúde' },
    { key: 'restricoes_alimentares', label: 'Restrições Alim.', group: 'Saúde' },

    // Emergência
    { key: 'contato_emergencia_nome', label: 'Contato Emergência', group: 'Emergência' },
    { key: 'contato_emergencia_telefone', label: 'Tel. Emergência', group: 'Emergência' },

    // Status (removido em 2026-09-01 a pedido da usuaria -- coluna "status"
    // nao aparece mais como opcao pra acampantes; continua existindo pra
    // equipantes, acima)
    { key: 'status_pagamento', label: 'Status Pagamento', group: 'Sistema' },
    { key: 'metodo_pagamento', label: 'Método Pagamento', group: 'Sistema' }
  ]
};

// Concatena os campos reais de endereço num único valor de exibição.
// Não existe coluna "endereco_completo" no banco — é montado aqui a partir de
// endereco, numero, complemento e bairro (as 4 colunas existem em ambas as tabelas).
export const formatEnderecoCompleto = (item) => {
  const partes = [item.endereco, item.numero, item.complemento, item.bairro].filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : '';
};

// Concatena as 3 opções de área de trabalho do equipante num único valor de exibição.
// Não inclui area_trabalho_extra (campo de observação livre, não é uma 4ª opção de área).
export const formatAreaTrabalho = (item) => {
  const areas = [item.area_trabalho_opcao1, item.area_trabalho_opcao2, item.area_trabalho_opcao3].filter(Boolean);
  return areas.length > 0 ? areas.join(', ') : '';
};

// "Nome" nao entra aqui: ja e sempre a primeira coluna, fixa, em ambas as
// tabelas (InscricoesTable.jsx trata 'nome' separado do resto). Essa lista
// define o que vem depois dela, na ordem em que aparece aqui.
const DEFAULT_VISIBLE_COLUMNS = {
  equipantes: ['cpf', 'igreja'],
  acampantes: ['cpf', 'igreja']
};

export const getVisibleColumnsFromStorage = (type) => {
  try {
    const saved = localStorage.getItem(`visibleColumns_${type}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading visible columns', e);
  }
  return DEFAULT_VISIBLE_COLUMNS[type] || [];
};

export const saveVisibleColumnsToStorage = (type, columns) => {
  try {
    localStorage.setItem(`visibleColumns_${type}`, JSON.stringify(columns));
  } catch (e) {
    console.error('Error saving visible columns', e);
  }
};

export const selectAllColumns = (type) => {
  const defs = COLUMN_DEFINITIONS[type] || [];
  return defs.map(d => d.key);
};

export const clearAllColumns = () => {
  return [];
};

export const toggleColumn = (currentColumns, key) => {
  if (currentColumns.includes(key)) {
    return currentColumns.filter(c => c !== key);
  }
  return [...currentColumns, key];
};