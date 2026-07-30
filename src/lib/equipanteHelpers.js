import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { toBoolean, validateCPF } from '@/lib/utils';

/**
 * Mapeia os dados do formulário (camelCase) para o formato do banco de dados (snake_case)
 */
const mapFormDataToDb = (formData, user) => {
  return {
    // Metadados
    status: 'pendente',
    tipo: 'equipante',
    updated_at: new Date().toISOString(),

    // Dados Pessoais
    nome: formData.nome,
    nome_completo: formData.nome,
    full_name: formData.nome, // satisfies NOT NULL constraint on equipantes.full_name
    cpf: formData.cpf,
    data_nascimento: formData.dataNascimento || null,
    genero: formData.sexo,
    sexo: formData.sexo,
    estado_civil: formData.estadoCivil,
    profissao: formData.profissao,
    tamanho_camisa: formData.tamanho_camisa || formData.tamanhoCamisa,
    email: formData.email,
    whatsapp: formData.whatsapp,
    telefone_residencial: formData.telefoneResidencial,
    idade: formData.idade ? parseInt(formData.idade) : null,

    // Endereço
    cep: formData.cep,
    endereco: formData.endereco,
    numero: formData.numero,
    complemento: formData.complemento,
    bairro: formData.bairro,
    cidade: formData.cidade,
    estado: formData.estado,

    // Saúde
    tem_problema_saude: toBoolean(formData.temProblemaSaude),
    condicoes_medicas: formData.condicoesMedicas,
    usa_medicamento: toBoolean(formData.usaMedicamento),
    medicamentos: formData.medicamentos,
    tem_restricao_alimentar: toBoolean(formData.temRestricaoAlimentar),
    restricoes_alimentares: formData.restricoesAlimentares,
    esta_gravida: toBoolean(formData.estaGravida),

    // Eclesiásticos
    igreja: formData.igreja,
    e_pastor: toBoolean(formData.ePastor),
    e_pastor_outro: formData.ePastorOutro,
    pastor_nome: formData.pastor,
    esta_afastado: toBoolean(formData.estaAfastado),
    cargo_igreja: formData.cargoIgreja,
    cargo_igreja_outro: formData.cargoIgrejaOutro,
    frequenta_ebd: toBoolean(formData.frequentaEBD),
    frequenta_grupo_cuidado: toBoolean(formData.frequentaGrupoCuidado),
    voce_canta: toBoolean(formData.voceCanta),
    toca_instrumento: toBoolean(formData.tocaInstrumento),

    // Dados Específicos Equipante
    familiar_trabalhando: formData.familiarTrabalhando && formData.familiarTrabalhando !== 'NÃO TENHO',
    familiar_trabalhando_outro: formData.familiarTrabalhandoOutro,
    parentesco: formData.parentesco,
    familiar_nome: formData.familiarNome,
    qual_radical_acampante: formData.qualRadicalAcampante,
    qual_radical_acampante_outro: formData.qualRadicalAcampanteOutro,
    numero_edicao_participou: formData.numeroEdicaoParticipou,
    ja_trabalhou_equipe: toBoolean(formData.jaTrabalhouEquipe),
    edicao_trabalhou: formData.edicaoTrabalhou,
    deseja_trabalhar_edicao: formData.desejaTrabalharEdicao,
    autorizacao_imagem: toBoolean(formData.autorizacaoImagemEquipante) || toBoolean(formData.autorizacaoImagem),

    // Experiência
    experiencia_acampamento: formData.experienciaAcampamento,
    motivacao: formData.motivacao,

    // Contato Emergência
    contato_emergencia_nome: formData.contatoEmergencia,
    contato_emergencia_telefone: formData.telefoneEmergencia,

    // Áreas de Trabalho
    area_trabalho_opcao1: formData.areaTrabalhoOpcao1,
    area_trabalho_opcao2: formData.areaTrabalhoOpcao2,
    area_trabalho_opcao3: formData.areaTrabalhoOpcao3,
    area_trabalho_extra: formData.areaTrabalhoExtra,

    // Pagamento
    forma_pagamento: formData.formaPagamento,
    pagamento_dinheiro_descricao: formData.pagamentoDinheiroDescricao,
  };
};

/**
 * Valida os dados do formulário antes do envio
 */
export const validateEquipanteForm = (formData) => {
  const errors = [];

  if (!formData.nome) errors.push("Nome é obrigatório");
  if (!formData.cpf) errors.push("CPF é obrigatório");
  else if (!validateCPF(formData.cpf)) errors.push("CPF inválido. Verifique os dígitos digitados.");
  if (!formData.whatsapp) errors.push("WhatsApp é obrigatório");
  if (!formData.dataNascimento) errors.push("Data de nascimento é obrigatória");

  if (!formData.areaTrabalhoOpcao1) errors.push("Selecione pelo menos a 1ª opção de área de trabalho");

  const hasImageAuth = toBoolean(formData.autorizacaoImagemEquipante) || toBoolean(formData.autorizacaoImagem);
  if (!hasImageAuth) errors.push("É necessário autorizar o uso de imagem");

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Salva o equipante no Supabase
 */
export const saveEquipante = async (formData, user) => {
  try {
    // 1. Validar
    const validation = validateEquipanteForm(formData);
    if (!validation.isValid) {
      throw new Error(validation.errors[0]); // Lança o primeiro erro encontrado
    }

    // 2. Preparar dados
    const dbData = mapFormDataToDb(formData, user);

    // 3. Inserir no Supabase
    const { data, error } = await supabase
      .from('equipantes')
      .insert([dbData])
      .select()
      .single();

    if (error) {
      console.error('Erro Supabase:', error);
      throw new Error(`Erro ao salvar no banco de dados: ${error.message}`);
    }

    return { success: true, data };

  } catch (error) {
    console.error('Erro em saveEquipante:', error);
    return { success: false, error: error.message };
  }
};