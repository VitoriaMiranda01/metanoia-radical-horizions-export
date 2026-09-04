export const SCHEMA_DEFINITIONS = {
  acampantes: {
    // telefone não existe na tabela real — a coluna de telefone de acampante
    // é whatsapp (mesma correção já aplicada em columnVisibility.js).
    fields: [
      'id', 'nome', 'email', 'whatsapp', 'sexo', 'igreja',
      'numero_edicao', 'status_pagamento', 'cpf'
    ]
  },
  equipantes: {
    // email não existe na tabela real de equipantes (mesma correção já
    // aplicada em columnVisibility.js).
    fields: [
      'id', 'nome', 'whatsapp', 'sexo', 'igreja',
      'area_trabalho_opcao1', 'area_trabalho_opcao2', 'area_trabalho_opcao3',
      'numero_edicao', 'status', 'status_pagamento',
      'cpf'
    ],
    indexes: ['cpf']
  },
  configuracoes: {
    fields: [
      'id', 'max_equipantes', 'max_acampantes', 'max_acampantes_homens',
      'max_acampantes_mulheres', 'edicao_numero',
      'equipante_pricing_periods', 'acampante_pricing_periods',
      'valor_equipante', 'valor_acampante', 'updated_at',
      'cpfs_area_guia', 'cpfs_area_inimigo', 'cpfs_area_espirito_santo',
      'inscricoes_equipantes', 'inscricoes_acampantes'
    ]
  },
  limites_areas: {
    fields: ['id', 'area_nome', 'limite_maximo', 'updated_at']
  },
  escalas: {
    fields: ['id', 'equipante_id', 'area_alocada', 'created_at']
  }
};