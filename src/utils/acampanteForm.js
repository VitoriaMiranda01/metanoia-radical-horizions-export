import { toBoolean } from '@/utils/formatters';

// Mapeia os dados do formulário para o formato do banco de dados (Snake Case)
export const mapFormDataToDb = (formData, user) => {
  return {
    // Metadados
    status: 'aprovado',
    tipo: 'acampante',

    // Dados Pessoais
    nome: formData.nome,
    cpf: formData.cpf || null,
    email: formData.email || null,
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
    // Adicionados em 2026-09-01: o formulario (InfoEclesiasticas.jsx) ja
    // perguntava isso ha tempos, mas essa funcao nunca incluia no que
    // manda pro banco — a resposta era descartada. cargo_igreja/
    // cargo_igreja_outro reaproveitam os mesmos nomes de coluna que
    // equipantes ja usa pra pergunta identica (mesmas opcoes), formData.
    // ePastor/ePastorOutro que dao nome ao campo no formulario de
    // acampante e que sao, na pratica, a mesma pergunta de "cargo".
    esta_afastado: toBoolean(formData.estaAfastado),
    cargo_igreja: formData.ePastor || null,
    cargo_igreja_outro: formData.ePastorOutro || null,

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
