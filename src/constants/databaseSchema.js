export const SCHEMA_DEFINITIONS = {
  acampantes: {
    fields: [
      'id', 'nome', 'email', 'telefone', 'sexo', 'igreja',
      'numero_edicao', 'status', 'status_pagamento', 'cpf'
    ]
  },
  equipantes: {
    fields: [
      'id', 'nome', 'email', 'whatsapp', 'sexo', 'igreja',
      'area_trabalho_opcao1', 'area_trabalho_opcao2', 'area_trabalho_opcao3',
      'numero_edicao', 'status', 'status_pagamento',
      'cpf'
    ],
    indexes: ['cpf']
  },
  inscricoes_status: {
    fields: ['id', 'inscricoes_equipantes', 'inscricoes_acampantes']
  },
  configuracoes: {
    fields: [
      'id', 'max_equipantes', 'max_acampantes', 'max_acampantes_homens',
      'max_acampantes_mulheres', 'edicao_numero',
      'equipante_pricing_periods', 'acampante_pricing_periods',
      'valor_equipante', 'valor_acampante', 'updated_at'
    ]
  },
  limites_areas: {
    fields: ['id', 'area_nome', 'limite_maximo', 'updated_at']
  },
  escalas: {
    fields: ['id', 'equipante_id', 'equipante_nome', 'area_alocada', 'is_manual', 'created_at']
  }
};