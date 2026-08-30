import { supabase } from '@/services/supabaseClient';
import { mapFormDataToDb as mapAcampanteToDb } from '@/utils/acampanteForm';
import { toBoolean } from '@/utils/formatters';

const mapEquipanteToDb = (formData) => ({
  status: 'pendente',
  scale_status: 'pendente',
  tipo: 'equipante',
  nome: formData.nome,
  cpf: formData.cpf,
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
  tem_restricao_alimentar: toBoolean(formData.temRestricaoAlimentar),
  restricoes_alimentares: formData.restricoesAlimentares,
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
  contato_emergencia_nome: formData.contatoEmergencia,
  contato_emergencia_telefone: formData.telefoneEmergencia,
  area_trabalho_opcao1: formData.areaTrabalhoOpcao1,
  area_trabalho_opcao2: formData.areaTrabalhoOpcao2,
  area_trabalho_opcao3: formData.areaTrabalhoOpcao3,
  area_trabalho_extra: formData.areaTrabalhoExtra,
  metodo_pagamento: formData.metodoPagamento,
});

export const verificarCPF = async (cpf, tipo) => {
  if (!cpf) {
    console.error('inscricaoApi - verificarCPF: CPF nulo ou indefinido fornecido');
    return { existe: false, found: false };
  }

  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';
  const cpfNormalizado = cpf.replace(/\D/g, '');

  try {
    const { data: listData, error } = await supabase
      .from(table)
      .select('*')
      .or(`cpf.eq.${cpfNormalizado},cpf.eq.${cpf}`)
      .limit(1);

    if (error) throw error;

    if (!listData || listData.length === 0) {
      return { existe: false, found: false };
    }

    const data = listData[0];
    const isPago = data.status_pagamento === 'pago' || data.status_pagamento === 'confirmado';

    if (tipo === 'equipante') {
      return {
        existe: true, // For backwards compatibility
        dados: data,  // For backwards compatibility
        found: true,
        data: data,
        inscrito: !!data.inscrito,
        pagou: isPago,
        status_pagamento: data.status_pagamento
      };
    }

    // Acampante fallback logic
    return {
      existe: true,
      pagou: isPago,
      status_pagamento: data.status_pagamento,
      dados: data
    };

  } catch (error) {
    console.error(`inscricaoApi - verificarCPF (${tipo})`, error, { cpf });
    throw new Error('Erro ao verificar CPF. Tente novamente mais tarde.');
  }
};

export const verificarNome = async (nome, tipo) => {
  if (!nome) {
    console.error('inscricaoApi - verificarNome: Nome nulo ou indefinido fornecido');
    return { existe: false, found: false };
  }

  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';

  try {
    const { data: listData, error } = await supabase
      .from(table)
      .select('*')
      .ilike('nome', `%${nome}%`)
      .limit(1);

    if (error) throw error;

    if (!listData || listData.length === 0) {
      return { existe: false, found: false };
    }

    const data = listData[0];

    const isPago =
      data.status_pagamento === 'pago' ||
      data.status_pagamento === 'confirmado';

    if (tipo === 'equipante') {
      return {
        existe: true,
        dados: data,
        found: true,
        data: data,
        inscrito: !!data.inscrito,
        pagou: isPago,
        status_pagamento: data.status_pagamento
      };
    }

    return {
      existe: true,
      dados: data,
      found: true,
      data: data,
      pagou: isPago,
      status_pagamento: data.status_pagamento
    };

  } catch (error) {
    console.error(`inscricaoApi - verificarNome (${tipo})`, error, { nome });
    throw new Error('Erro ao verificar nome. Tente novamente mais tarde.');
  }
};

export const criarInscricao = async (formData, tipo) => {
  if (!formData) {
    console.error('inscricaoApi - criarInscricao: FormData nulo fornecido');
    return { success: false, error: 'Dados do formulário inválidos' };
  }

  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';

  const mappedData = tipo === 'equipante'
    ? mapEquipanteToDb(formData)
    : mapAcampanteToDb(formData, null);

  const processedMethod = formData.metodoPagamento || mappedData.metodo_pagamento || null;

  const payload = {
    ...mappedData,
    status_pagamento: 'pendente',
    metodo_pagamento: processedMethod,
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
    console.error(`inscricaoApi - criarInscricao (${tipo})`, error, { payload });
    return { success: false, error: 'Erro ao processar inscrição.' };
  }
};

export const atualizarStatusPagamento = async (idInscricao, tipo, status, metodo, idTransacao) => {
  if (!idInscricao) {
    console.error('inscricaoApi - atualizarStatusPagamento: ID da inscrição ausente');
    return { success: false, error: 'ID da inscrição inválido' };
  }

  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';

  try {
    const { data, error } = await supabase
      .from(table)
      .update({
        status_pagamento: status,
        metodo_pagamento: metodo,
        id_transacao_sicoob: idTransacao,
        data_pagamento: status === 'pago' || status === 'confirmado' ? new Date().toISOString() : null
      })
      .eq('id', idInscricao)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error(`inscricaoApi - atualizarStatusPagamento (${tipo})`, error, { idInscricao, status, metodo });
    return { success: false, error: 'Erro ao atualizar pagamento.' };
  }
};

export const updateEquipantePaymentStatus = async (equipanteId, status) => {
  if (!equipanteId) return { success: false, error: 'ID inválido' };
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .update({ status_pagamento: status })
      .eq('id', equipanteId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('inscricaoApi - updateEquipantePaymentStatus', error, { equipanteId });
    return { success: false, error: 'Erro ao atualizar status de pagamento do equipante' };
  }
};

export const updateAcampantePaymentStatus = async (acampanteId, status) => {
  if (!acampanteId) return { success: false, error: 'ID inválido' };
  try {
    const { data, error } = await supabase
      .from('acampantes')
      .update({ status_pagamento: status })
      .eq('id', acampanteId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('inscricaoApi - updateAcampantePaymentStatus', error, { acampanteId });
    return { success: false, error: 'Erro ao atualizar status de pagamento do acampante' };
  }
};