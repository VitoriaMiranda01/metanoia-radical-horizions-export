import { toBoolean } from '@/utils/formatters';

// Mapeia os dados do formulário para o formato do banco de dados (Snake Case)
export const mapFormDataToDb = (formData, user) => {
  return {
    // Metadados
    status: 'aprovado',
    tipo: 'acampante',

    // Dados Pessoais
    nome: formData.nome,
    cpf: formData.cpf,
    email: formData.email || null,
    telefone: formData.whatsapp || null,
    whatsapp: formData.whatsapp || null,
    sexo: formData.sexo || null,
    tamanho_camisa: formData.tamanho_camisa || null,
    idade: formData.idade ? parseInt(formData.idade) : null,

    // Endereço
    cep: formData.cep || null,
    endereco: formData.endereco || null,
    numero: formData.numero || null,
    complemento: formData.complemento || null,
    bairro: formData.bairro || null,
    cidade: formData.cidade || null,
    estado: formData.estado || null,

    // Saúde
    tem_problema_saude: toBoolean(formData.temProblemaSaude),
    condicoes_medicas: formData.condicoesMedicas || null,
    usa_medicamento: toBoolean(formData.usaMedicamento),
    medicamentos: formData.medicamentos || null,
    tem_restricao_alimentar: toBoolean(formData.temRestricaoAlimentar),
    restricoes_alimentares: formData.restricoesAlimentares || null,
    esta_gravida: toBoolean(formData.estaGravida),

    // Igreja
    igreja: formData.igreja || null,
    pastor_nome: formData.pastor || null,
    pastor: formData.pastor || null,

    // Admin / Indicação
    admin_responsavel: formData.adminResponsavel || null,
    quem_indicou_nome: formData.nomeQuemIndicou || null,
    quem_indicou_telefone: formData.telefoneQuemIndicou || null,
    conhecido_no_projeto: formData.conhecidoNoProjeto || null,
    nome_familiar_conhecido: formData.nomeFamiliarConhecido || null,

    // Contato Emergência
    contato_emergencia_nome: formData.contatoEmergencia || null,
    contato_emergencia_telefone: formData.telefoneEmergencia || null,

    // Pagamento
    metodo_pagamento: formData.metodoPagamento || null,

    // Termos
    autorizacao_imagem: toBoolean(formData.autorizacaoImagem),
    termo_responsabilidade_aceito: toBoolean(formData.termoAceito),
  };
};
