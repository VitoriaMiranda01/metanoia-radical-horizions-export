import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';
import { toBoolean, validateCPF } from '@/lib/utils';

/**
 * Valida os dados do formulário de acampante
 */
export const validateAcampanteForm = (formData) => {
  const errors = {};
  let isValid = true;

  if (!formData.nome) {
    errors.nome = "Nome é obrigatório";
    isValid = false;
  }

  if (!formData.cpf) {
    errors.cpf = "CPF é obrigatório";
    isValid = false;
  } else if (formData.cpf.length < 11) {
    errors.cpf = "CPF inválido";
    isValid = false;
  } else if (!validateCPF(formData.cpf)) {
    errors.cpf = "CPF inválido. Verifique os dígitos digitados.";
    isValid = false;
  }

  if (!formData.whatsapp) {
    errors.whatsapp = "WhatsApp é obrigatório";
    isValid = false;
  }

  if (!formData.autorizacaoImagem) {
    errors.autorizacaoImagem = "Autorização de imagem é obrigatória";
    isValid = false;
  }

  if (!formData.termoAceito) {
    errors.termoAceito = "Aceite do termo de responsabilidade é obrigatório";
    isValid = false;
  }
  
  if (!formData.adminResponsavel) {
    errors.adminResponsavel = "Admin Responsável é obrigatório";
    isValid = false;
  }

  return { isValid, errors };
};

/**
 * Mapeia os dados do formulário para o formato do banco de dados (Snake Case)
 */
export const mapFormDataToDb = (formData, user) => {
  return {
    // Metadados
    status: 'aprovado',
    tipo: 'acampante',

    // Dados Pessoais — colunas reais: nome, nome_completo, full_name, cpf, email,
    //   telefone, whatsapp, genero, sexo, estado_civil, profissao, tamanho_camisa,
    //   idade, data_nascimento
    nome: formData.nome,
    nome_completo: formData.nome,
    full_name: formData.nome,
    cpf: formData.cpf,
    email: formData.email || null,
    telefone: formData.whatsapp || null,       // DB usa 'telefone'
    whatsapp: formData.whatsapp || null,       // também existe agora
    genero: formData.sexo || null,
    sexo: formData.sexo || null,
    estado_civil: formData.estadoCivil || null,
    profissao: formData.profissao || null,
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

    // Saúde — colunas reais: tem_problema_saude, condicoes_medicas,
    //   usa_medicamento, medicamentos, tem_restricao_alimentar,
    //   restricoes_alimentares, esta_gravida
    tem_problema_saude: toBoolean(formData.temProblemaSaude),
    condicoes_medicas: formData.condicoesMedicas || null,
    usa_medicamento: toBoolean(formData.usaMedicamento),
    medicamentos: formData.medicamentos || null,
    tem_restricao_alimentar: toBoolean(formData.temRestricaoAlimentar),
    restricoes_alimentares: formData.restricoesAlimentares || null,
    esta_gravida: toBoolean(formData.estaGravida),

    // Eclesiásticos — colunas reais: igreja, pastor_nome, pastor
    igreja: formData.igreja || null,
    pastor_nome: formData.pastor || null,
    pastor: formData.pastor || null,

    // Admin / Indicação — colunas reais: admin_responsavel, codigo_admin,
    //   quem_indicou_nome, quem_indicou_telefone, conhecido_no_projeto, nome_familiar_conhecido
    admin_responsavel: formData.adminResponsavel || null,
    quem_indicou_nome: formData.nomeQuemIndicou || null,
    quem_indicou_telefone: formData.telefoneQuemIndicou || null,
    conhecido_no_projeto: formData.conhecidoNoProjeto || null,
    nome_familiar_conhecido: formData.nomeFamiliarConhecido || null,

    // Contato Emergência — colunas reais: contato_emergencia_nome, contato_emergencia_telefone
    contato_emergencia_nome: formData.contatoEmergencia || null,
    contato_emergencia_telefone: formData.telefoneEmergencia || null,

    // Pagamento
    forma_pagamento: formData.formaPagamento || null,

    // Termos — colunas reais: autorizacao_imagem, termo_responsabilidade_aceito
    autorizacao_imagem: toBoolean(formData.autorizacaoImagem),
    termo_responsabilidade_aceito: toBoolean(formData.termoAceito),
  };
};

/**
 * Salva um novo acampante
 */
export const saveAcampante = async (formData, user) => {
  try {
    if (!navigator.onLine) {
      throw new Error("Você está offline. Verifique sua conexão e tente novamente.");
    }

    const { isValid, errors } = validateAcampanteForm(formData);
    if (!isValid) {
      const errorMsg = Object.values(errors)[0];
      throw new Error(errorMsg);
    }

    const dbData = mapFormDataToDb(formData, user);
    
    const { data, error } = await supabase
      .from('acampantes')
      .insert([dbData])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao salvar acampante:', error);
    return { success: false, error: error.message || "Erro desconhecido ao salvar." };
  }
};

/**
 * Atualiza um acampante existente
 */
export const updateAcampante = async (acampanteId, formData, user) => {
  try {
    if (!navigator.onLine) {
      throw new Error("Você está offline. Verifique sua conexão.");
    }

    const { isValid, errors } = validateAcampanteForm(formData);
    if (!isValid) {
      throw new Error(Object.values(errors)[0]);
    }

    const dbData = mapFormDataToDb(formData, user);
    delete dbData.user_id; // Não atualiza dono
    delete dbData.created_at;

    const { data, error } = await supabase
      .from('acampantes')
      .update(dbData)
      .eq('id', acampanteId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Erro ao atualizar acampante:', error);
    return { success: false, error: error.message || "Erro ao atualizar dados." };
  }
};

/**
 * Deleta um acampante
 */
export const deleteAcampante = async (acampanteId, user) => {
  try {
    if (!navigator.onLine) {
      throw new Error("Você está offline. Verifique sua conexão.");
    }

    const { error } = await supabase
      .from('acampantes')
      .delete()
      .eq('id', acampanteId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar acampante:', error);
    return { success: false, error: error.message || "Erro ao excluir registro." };
  }
};

/**
 * Busca todos os acampantes de um usuário (ou todos se for admin e a policy permitir)
 * Updated to filter by editionNumber
 */
export const getAcampantes = async (userId, editionNumber = null) => {
  try {
    if (!navigator.onLine) {
      console.warn("Offline mode: Cannot fetch acampantes.");
      return [];
    }

    let query = supabase
      .from('acampantes')
      .select('*')
      .order('created_at', { ascending: false });

    if (editionNumber) {
      query = query.eq('numero_edicao', editionNumber);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Map data to ensure nome_completo fallback
    return (data || []).map(a => ({
      ...a,
      nome_completo: a.nome_completo || a.nome // Fallback to 'nome' if 'nome_completo' is missing
    }));
  } catch (error) {
    console.error('Erro ao buscar acampantes:', error);
    toast({
      title: "Erro de Conexão",
      description: "Não foi possível carregar os dados. Verifique sua conexão.",
      variant: "destructive"
    });
    return [];
  }
};

/**
 * Busca um acampante por ID
 */
export const getAcampanteById = async (acampanteId, userId) => {
  try {
    if (!navigator.onLine) {
      throw new Error("Você está offline.");
    }

    const { data, error } = await supabase
      .from('acampantes')
      .select('*')
      .eq('id', acampanteId)
      .single();

    if (error) throw error;
    
    // Ensure fallback for single record
    if (data) {
      data.nome_completo = data.nome_completo || data.nome;
    }
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar acampante:', error);
    return null;
  }
};

/**
 * Exporta acampantes para Excel
 */
export const exportAcampantesToExcel = (acampantes) => {
  try {
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    };

    const formatBool = (val) => val ? 'Sim' : 'Não';
    
    const formatCPF = (cpf) => {
      if (!cpf) return '';
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    };

    const dataToExport = acampantes.map(a => ({
      'ID': a.id,
      'Nome': a.nome_completo || a.nome, // Use fallback here too
      'CPF': formatCPF(a.cpf),
      'WhatsApp': a.whatsapp,
      'Data Nascimento': formatDate(a.data_nascimento),
      'Gênero': a.genero,
      'Estado Civil': a.estado_civil,
      'Profissão': a.profissao,
      'Tamanho Camisa': a.tamanho_camisa,
      'Problema de Saúde': formatBool(a.tem_problema_saude),
      'Usa Medicamento': formatBool(a.usa_medicamento),
      'Status': a.status,
      'Data de Criação': formatDate(a.created_at)
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Auto-adjust column widths
    const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Acampantes");

    const fileName = `acampantes_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao exportar:', error);
    return { success: false, error: error.message };
  }
};