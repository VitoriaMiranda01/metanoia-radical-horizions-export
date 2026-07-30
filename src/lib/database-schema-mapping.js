/**
 * DATABASE SCHEMA MAPPING DOCUMENTATION
 * =====================================
 * 
 * This file documents the mapping between UI components/forms and Supabase database tables.
 * Updated to reflect actual database schema.
 */

export const SCHEMA_DEFINITIONS = {
  acampantes: {
    fields: [
      'id', 'full_name', 'email', 'telefone', 'sexo', 'genero', 'igreja',
      'numero_edicao', 'status', 'status_pagamento', 'cpf', 'created_at', 'updated_at'
    ]
  },
  equipantes: {
    fields: [
      'id', 'nome_completo', 'email', 'whatsapp', 'sexo', 'genero', 'igreja',
      'area_trabalho_opcao1', 'area_trabalho_opcao2', 'area_trabalho_opcao3',
      'tamanho_camisa', 'numero_edicao', 'status', 'status_pagamento',
      'cpf', 'created_at', 'updated_at'
    ],
    indexes: ['cpf', 'created_at']
  },
  inscricoes_status: {
    fields: ['id', 'inscricoes_equipantes', 'inscricoes_acampantes', 'updated_at']
  },
  configuracoes: {
    fields: [
      'id', 'max_equipantes', 'max_acampantes', 'max_acampantes_homens',
      'max_acampantes_mulheres', 'edicao_numero', 'observacoes',
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