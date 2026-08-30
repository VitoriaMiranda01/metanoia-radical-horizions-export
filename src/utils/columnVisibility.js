export const COLUMN_DEFINITIONS = {
  equipantes: [
    // Identificação
    { key: 'cpf', label: 'CPF', group: 'Pessoal' },
    { key: 'telefone', label: 'Telefone', group: 'Contato' },
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
    { key: 'email', label: 'Email', group: 'Contato' },
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
    { key: 'grupo_trailha', label: 'Grupo de Trilha', group: 'Acampamento' },
    { key: 'tamanho_camisa', label: 'Camiseta', group: 'Acampamento' },

    // Saúde
    { key: 'condicoes_medicas', label: 'Condições Médicas', group: 'Saúde' },
    { key: 'medicamentos', label: 'Medicamentos', group: 'Saúde' },
    { key: 'restricoes_alimentares', label: 'Restrições Alim.', group: 'Saúde' },

    // Emergência
    { key: 'contato_emergencia_nome', label: 'Contato Emergência', group: 'Emergência' },
    { key: 'contato_emergencia_telefone', label: 'Tel. Emergência', group: 'Emergência' },

    // Status
    { key: 'status_pagamento', label: 'Status Pagamento', group: 'Sistema' },
    { key: 'metodo_pagamento', label: 'Método Pagamento', group: 'Sistema' },
    { key: 'status', label: 'Status', group: 'Sistema' }
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

const DEFAULT_VISIBLE_COLUMNS = {
  equipantes: ['telefone', 'cidade', 'igreja', 'area_trabalho', 'status'],
  acampantes: ['email', 'whatsapp', 'cidade', 'igreja', 'grupo_trailha', 'status']
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