export const COLUMN_DEFINITIONS = {
  equipantes: [
    // Identificação
    { key: 'email', label: 'Email', group: 'Contato' },
    { key: 'cpf', label: 'CPF', group: 'Pessoal' },
    { key: 'telefone', label: 'Telefone', group: 'Contato' },
    { key: 'data_nascimento', label: 'Data Nascimento', group: 'Pessoal' },
    { key: 'genero', label: 'Gênero', group: 'Pessoal' },
    
    // Endereço
    { key: 'endereco_completo', label: 'Endereço Completo', group: 'Endereço' },
    { key: 'cidade', label: 'Cidade', group: 'Endereço' },
    { key: 'estado', label: 'Estado', group: 'Endereço' },
    { key: 'cep', label: 'CEP', group: 'Endereço' },
    
    // Eclesiástico
    { key: 'igreja', label: 'Igreja', group: 'Eclesiástico' },
    { key: 'funcao_igreja', label: 'Função na Igreja', group: 'Eclesiástico' },
    
    // Serviço
    { key: 'area_trabalho', label: 'Área de Trabalho', group: 'Serviço' },
    { key: 'experiencia', label: 'Experiência', group: 'Serviço' },
    { key: 'motivacao', label: 'Motivação', group: 'Serviço' },
    
    // Emergência
    { key: 'contato_emergencia_nome', label: 'Contato Emergência', group: 'Emergência' },
    { key: 'contato_emergencia_telefone', label: 'Tel. Emergência', group: 'Emergência' },
    
    // Status
    { key: 'data_inscricao', label: 'Data Inscrição', group: 'Sistema' },
    { key: 'status_pagamento', label: 'Pagamento', group: 'Sistema' },
    { key: 'status', label: 'Status', group: 'Sistema' }
  ],
  acampantes: [
    // Identificação
    { key: 'email', label: 'Email', group: 'Contato' },
    { key: 'cpf', label: 'CPF', group: 'Pessoal' },
    { key: 'telefone', label: 'Telefone', group: 'Contato' },
    { key: 'data_nascimento', label: 'Data Nascimento', group: 'Pessoal' },
    { key: 'genero', label: 'Gênero', group: 'Pessoal' },
    
    // Responsável
    { key: 'responsavel_nome', label: 'Responsável', group: 'Responsável' },
    { key: 'responsavel_telefone', label: 'Tel. Responsável', group: 'Responsável' },
    { key: 'responsavel_email', label: 'Email Responsável', group: 'Responsável' },
    
    // Endereço
    { key: 'endereco_completo', label: 'Endereço Completo', group: 'Endereço' },
    { key: 'cidade', label: 'Cidade', group: 'Endereço' },
    { key: 'estado', label: 'Estado', group: 'Endereço' },
    { key: 'cep', label: 'CEP', group: 'Endereço' },
    
    // Acampamento
    { key: 'igreja', label: 'Igreja', group: 'Eclesiástico' },
    { key: 'grupo_trailha', label: 'Grupo Trailha', group: 'Acampamento' },
    { key: 'grupo_alocado', label: 'Grupo Alocado', group: 'Acampamento' },
    { key: 'tamanho_camiseta', label: 'Camiseta', group: 'Acampamento' },
    
    // Saúde
    { key: 'alergias', label: 'Alergias', group: 'Saúde' },
    { key: 'medicamentos', label: 'Medicamentos', group: 'Saúde' },
    { key: 'restricoes_alimentares', label: 'Restrições Alim.', group: 'Saúde' },
    
    // Emergência
    { key: 'contato_emergencia_nome', label: 'Contato Emergência', group: 'Emergência' },
    { key: 'contato_emergencia_telefone', label: 'Tel. Emergência', group: 'Emergência' },
    
    // Status
    { key: 'data_inscricao', label: 'Data Inscrição', group: 'Sistema' },
    { key: 'status_pagamento', label: 'Pagamento', group: 'Sistema' },
    { key: 'status', label: 'Status', group: 'Sistema' }
  ]
};

const DEFAULT_VISIBLE_COLUMNS = {
  equipantes: ['email', 'telefone', 'cidade', 'igreja', 'area_trabalho', 'status'],
  acampantes: ['email', 'telefone', 'cidade', 'igreja', 'responsavel_nome', 'status']
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