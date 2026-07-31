import { supabase } from '@/lib/supabase';
import { mapFormDataToDb as mapAcampanteToDb } from '@/lib/acampanteHelpers';
import { toBoolean } from '@/lib/utils';

/**
 * Maps equipante form data (camelCase) to DB columns (snake_case).
 * Mirrors the logic in equipanteHelpers.js mapFormDataToDb.
 */
const mapEquipanteToDb = (formData) => ({
  status: 'pendente',
  tipo: 'equipante',
  updated_at: new Date().toISOString(),
  nome: formData.nome,
  nome_completo: formData.nome,
  full_name: formData.nome,
  cpf: formData.cpf,
  tamanho_camisa: formData.tamanho_camisa || formData.tamanhoCamisa,
  email: formData.email,
  whatsapp: formData.whatsapp,
  telefone_residencial: formData.telefoneResidencial,
  idade: formData.idade ? parseInt(formData.idade) : null,
  cep: formData.cep,
  endereco: formData.endereco,
  numero: formData.numero,
  complemento: formData.complemento,
  bairro: formData.bairro,
  cidade: formData.cidade,
  estado: formData.estado,
  tem_problema_saude: toBoolean(formData.temProblemaSaude),
  condicoes_medicas: formData.condicoesMedicas,
  usa_medicamento: toBoolean(formData.usaMedicamento),
  medicamentos: formData.medicamentos,
  tem_restricao_alimentar: toBoolean(formData.temRestricaoAlimentar),
  restricoes_alimentares: formData.restricoesAlimentares,
  esta_gravida: toBoolean(formData.estaGravida),
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
  experiencia_acampamento: formData.experienciaAcampamento,
  motivacao: formData.motivacao,
  contato_emergencia_nome: formData.contatoEmergencia,
  contato_emergencia_telefone: formData.telefoneEmergencia,
  area_trabalho_opcao1: formData.areaTrabalhoOpcao1,
  area_trabalho_opcao2: formData.areaTrabalhoOpcao2,
  area_trabalho_opcao3: formData.areaTrabalhoOpcao3,
  area_trabalho_extra: formData.areaTrabalhoExtra,
  forma_pagamento: formData.formaPagamento,
  metodo_pagamento: formData.metodoPagamento,
  pagamento_dinheiro_descricao: formData.pagamentoDinheiroDescricao,
});

/**
 * Checks if a CPF is already registered for a specific edition.
 * Returns the registration status and data if found.
 * 
 * @param {string} cpf 
 * @param {string} tipo - 'equipante' or 'acampante'
 * @param {number} numeroEdicao 
 */
export const verificarCPF = async (cpf, tipo, numeroEdicao) => {
  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';
  
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('cpf', cpf)
      .eq('numero_edicao', numeroEdicao)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { existe: false };
    }

    return {
      existe: true,
      pagou: data.status_pagamento === 'pago' || data.status_pagamento === 'confirmado',
      status_pagamento: data.status_pagamento,
      dados: data
    };

  } catch (error) {
    console.error(`Erro ao verificar CPF (${tipo}):`, error);
    throw error;
  }
};

/**
 * Creates a new registration record.
 * 
 * @param {Object} formData 
 * @param {string} tipo - 'equipante' or 'acampante'
 * @param {number} numeroEdicao 
 */
export const criarInscricao = async (formData, tipo, numeroEdicao) => {
  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';

  // Map camelCase form fields to snake_case DB columns
  const mappedData = tipo === 'equipante'
    ? mapEquipanteToDb(formData)
    : mapAcampanteToDb(formData, null);

  const payload = {
    ...mappedData,
    numero_edicao: numeroEdicao,
    status_pagamento: 'pendente',
    metodo_pagamento: formData.metodoPagamento || mappedData.metodo_pagamento || null,
  };

  try {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error(`Erro ao criar inscrição (${tipo}):`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Updates payment status for a registration.
 * 
 * @param {string} idInscricao 
 * @param {string} tipo - 'equipante' or 'acampante'
 * @param {string} status - 'pago', 'pendente', 'cancelado'
 * @param {string} metodo - 'PIX', 'BOLETO', 'manual'
 * @param {string} idTransacao 
 */
export const atualizarStatusPagamento = async (idInscricao, tipo, status, metodo, idTransacao) => {
  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';

  try {
    const { data, error } = await supabase
      .from(table)
      .update({
        status_pagamento: status,
        metodo_pagamento: metodo,
        id_transacao_sicoob: idTransacao,
        data_pagamento: status === 'pago' || status === 'confirmado' ? new Date() : null
      })
      .eq('id', idInscricao)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error(`Erro ao atualizar pagamento (${tipo}):`, error);
    return { success: false, error: error.message };
  }
};