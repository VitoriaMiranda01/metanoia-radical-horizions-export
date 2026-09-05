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
    { key: 'autorizacao_imagem', label: 'Autorização de Imagem', group: 'Pessoal' },

    // Endereço (campo calculado: junta endereco + numero + complemento + bairro)
    { key: 'endereco_completo', label: 'Endereço Completo', group: 'Endereço' },
    { key: 'cidade', label: 'Cidade', group: 'Endereço' },
    { key: 'estado', label: 'Estado', group: 'Endereço' },
    { key: 'cep', label: 'CEP', group: 'Endereço' },

    // Saúde (perguntado no formulario de equipante desde sempre, so nao
    // estava disponivel aqui no seletor -- adicionado em 2026-09-03)
    { key: 'tem_problema_saude', label: 'Tem Problema de Saúde', group: 'Saúde' },
    { key: 'tem_restricao_alimentar', label: 'Tem Restrição Alimentar', group: 'Saúde' },

    // Eclesiástico
    { key: 'igreja', label: 'Igreja', group: 'Igreja' },
    { key: 'cargo_igreja', label: 'Função na Igreja', group: 'Igreja' },
    { key: 'esta_afastado', label: 'Congrega em Igreja', group: 'Igreja' },
    { key: 'pastor_nome', label: 'Nome do Pastor', group: 'Igreja' },
    { key: 'frequenta_ebd', label: 'Frequenta EBD', group: 'Igreja' },
    { key: 'frequenta_grupo_cuidado', label: 'Frequenta Grupo de Cuidado', group: 'Igreja' },
    { key: 'voce_canta', label: 'Canta', group: 'Igreja' },
    { key: 'toca_instrumento', label: 'Toca Instrumento', group: 'Igreja' },

    // Serviço (campo calculado: junta area_trabalho_opcao1/2/3)
    { key: 'area_trabalho', label: 'Área de Trabalho', group: 'Serviço' },
    { key: 'area_trabalho_extra', label: 'Área de Trabalho Extra', group: 'Serviço' },

    // Dados do Equipante no Projeto (seção "Dados do Equipante no Projeto" do formulário)
    { key: 'familiar_trabalhando', label: 'Familiar Trabalhando no Projeto', group: 'Projeto' },
    { key: 'parentesco', label: 'Parentesco c/ Acampante', group: 'Projeto' },
    { key: 'familiar_nome', label: 'Nome do Familiar/Conhecido', group: 'Projeto' },
    { key: 'qual_radical_acampante', label: 'Qual Radical Fez como Acampante', group: 'Projeto' },
    { key: 'numero_edicao_participou', label: 'Nº Edição que Participou', group: 'Projeto' },
    { key: 'ja_trabalhou_equipe', label: 'Já Trabalhou em Equipe', group: 'Projeto' },
    { key: 'edicao_trabalhou', label: 'Edição que Trabalhou', group: 'Projeto' },

    // Status
    // "Contato Emergência" / "Tel. Emergência" foram removidos daqui em
    // 2026-09-03: a tabela equipantes tem essas colunas, mas o formulário
    // de equipante (diferente do de acampante) não tem uma seção que
    // pergunte isso -- sempre apareciam vazias.
    { key: 'status_pagamento', label: 'Status Pagamento', group: 'Sistema' },
    { key: 'metodo_pagamento', label: 'Método Pagamento', group: 'Sistema' },
    { key: 'data_pagamento', label: 'Data do Pagamento', group: 'Sistema' },
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
    { key: 'autorizacao_imagem', label: 'Autorização de Imagem', group: 'Pessoal' },

    // Endereço (campo calculado: junta endereco + numero + complemento + bairro)
    { key: 'endereco_completo', label: 'Endereço Completo', group: 'Endereço' },
    { key: 'cidade', label: 'Cidade', group: 'Endereço' },
    { key: 'estado', label: 'Estado', group: 'Endereço' },
    { key: 'cep', label: 'CEP', group: 'Endereço' },

    // Acampamento
    { key: 'igreja', label: 'Igreja', group: 'Igreja' },
    // cargo_igreja existe na tabela desde a migration schema-update-
    // 20260901c (o formulario de acampante ja pergunta isso); a opcao so
    // nao tinha sido adicionada aqui ainda -- adicionada em 2026-09-03.
    { key: 'cargo_igreja', label: 'Função na Igreja', group: 'Igreja' },
    { key: 'esta_afastado', label: 'Congrega em Igreja', group: 'Igreja' },
    { key: 'pastor_nome', label: 'Nome do Pastor', group: 'Igreja' },
    { key: 'admin_responsavel', label: 'Igreja Responsável pela Inscrição', group: 'Igreja' },
    { key: 'grupo_trailha', label: 'Grupo de Trilha', group: 'Acampamento' },
    { key: 'tamanho_camisa', label: 'Camiseta', group: 'Acampamento' },

    // Saúde
    { key: 'tem_problema_saude', label: 'Tem Problema de Saúde', group: 'Saúde' },
    { key: 'condicoes_medicas', label: 'Condições Médicas', group: 'Saúde' },
    { key: 'usa_medicamento', label: 'Usa Medicamento', group: 'Saúde' },
    { key: 'medicamentos', label: 'Medicamentos', group: 'Saúde' },
    { key: 'tem_restricao_alimentar', label: 'Tem Restrição Alimentar', group: 'Saúde' },
    { key: 'restricoes_alimentares', label: 'Restrições Alim.', group: 'Saúde' },
    { key: 'esta_gravida', label: 'Está Grávida', group: 'Saúde' },

    // Emergência
    { key: 'contato_emergencia_nome', label: 'Contato Emergência', group: 'Emergência' },
    { key: 'contato_emergencia_telefone', label: 'Tel. Emergência', group: 'Emergência' },

    // Quem Indicou e Conhecidos (seção "Quem Indicou e Conhecidos" do formulário)
    { key: 'quem_indicou_nome', label: 'Nome de Quem Indicou', group: 'Indicação' },
    { key: 'quem_indicou_telefone', label: 'Telefone de Quem Indicou', group: 'Indicação' },
    { key: 'conhecido_no_projeto', label: 'Conhecido no Projeto', group: 'Indicação' },
    { key: 'nome_familiar_conhecido', label: 'Nome do Familiar/Conhecido', group: 'Indicação' },

    // Status (removido em 2026-09-01 a pedido da usuaria -- coluna "status"
    // nao aparece mais como opcao pra acampantes; continua existindo pra
    // equipantes, acima)
    { key: 'status_pagamento', label: 'Status Pagamento', group: 'Sistema' },
    { key: 'metodo_pagamento', label: 'Método Pagamento', group: 'Sistema' },
    { key: 'data_pagamento', label: 'Data do Pagamento', group: 'Sistema' }
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
// "Disponível para qualquer área" pode aparecer em mais de uma das 3 opções
// (única exceção a essa regra) -- por isso agrupamos repetições em vez de
// listar o mesmo texto 2x ou 3x seguidas.
export const formatAreaTrabalho = (item) => {
  const areas = [item.area_trabalho_opcao1, item.area_trabalho_opcao2, item.area_trabalho_opcao3].filter(Boolean);
  const contagem = areas.reduce((acc, area) => {
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(contagem)
    .map(([area, count]) => (count > 1 ? `${area} (${count}x)` : area))
    .join(', ');
};

// "Nome" nao entra aqui: ja e sempre a primeira coluna, fixa, em ambas as
// tabelas (InscricoesTable.jsx trata 'nome' separado do resto). Essa lista
// define o que vem depois dela, na ordem em que aparece aqui.
const DEFAULT_VISIBLE_COLUMNS = {
  equipantes: ['cpf', 'igreja'],
  acampantes: ['cpf', 'igreja']
};

// Colunas que o usuario nao pode desmarcar no seletor "Colunas" (CPF e
// Igreja, a pedido da usuaria em 2026-09-05) -- valem pra acampantes e
// equipantes. Diferente de "nome", que fica sempre fixa na primeira
// posicao da tabela, CPF/Igreja continuam podendo mudar de posicao entre as
// outras colunas marcadas; so nao podem ficar desmarcadas/escondidas.
export const LOCKED_COLUMNS = ['cpf', 'igreja'];

export const getVisibleColumnsFromStorage = (type) => {
  let columns;
  try {
    const saved = localStorage.getItem(`visibleColumns_${type}`);
    columns = saved ? JSON.parse(saved) : (DEFAULT_VISIBLE_COLUMNS[type] || []);
  } catch (e) {
    console.error('Error loading visible columns', e);
    columns = DEFAULT_VISIBLE_COLUMNS[type] || [];
  }

  // Garante que CPF/Igreja estejam sempre presentes, mesmo pra quem tinha
  // desmarcado uma delas e salvo isso no localStorage antes dessa regra
  // existir.
  const missingLocked = LOCKED_COLUMNS.filter(k => !columns.includes(k));
  return missingLocked.length > 0 ? [...columns, ...missingLocked] : columns;
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
  // CPF/Igreja nao podem ficar desmarcadas -- "Limpar" desmarca todo o
  // resto, mas mantem as duas.
  return [...LOCKED_COLUMNS];
};

export const toggleColumn = (currentColumns, key) => {
  const isCurrentlyVisible = currentColumns.includes(key);

  // Impede desmarcar CPF/Igreja (ver LOCKED_COLUMNS acima). So bloqueia a
  // remocao -- nao ha nada pra bloquear ao "marcar", ja que essas colunas
  // deveriam estar sempre marcadas de qualquer forma.
  if (isCurrentlyVisible && LOCKED_COLUMNS.includes(key)) {
    return currentColumns;
  }

  if (isCurrentlyVisible) {
    return currentColumns.filter(c => c !== key);
  }
  return [...currentColumns, key];
};