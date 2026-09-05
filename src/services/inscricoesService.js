import { supabase } from '@/services/supabaseClient';
import { mapFormDataToDb as mapAcampanteToDb } from '@/utils/acampanteForm';
import { toBoolean } from '@/utils/formatters';
import { escolherGrupoTrailha } from '@/services/acampantesService';

// Reenvia automaticamente inserções que falharam por erro passageiro (ex:
// sobrecarga momentânea do banco/pooler quando muita gente se inscreve ao
// mesmo tempo — cenário real com equipantes, cujas inscrições costumam ser
// bem concentradas no tempo). A espera entre tentativas cresce a cada
// tentativa (backoff exponencial), pra não bater no banco de novo logo depois
// de já estar sobrecarregado.
//
// Erros de dado/regra de negócio (ex: CPF duplicado, coluna inexistente no
// schema) NÃO são reenviados — tentar de novo não resolveria, só atrasaria a
// pessoa ver o erro real.
const NON_RETRYABLE_ERROR_PREFIXES = [
  'PGRST', // erros de configuração/schema do PostgREST (ex: PGRST204 - coluna inexistente)
  '23',    // violação de integridade (ex: 23505 - CPF duplicado)
  '22',    // dado inválido
  '42',    // erro de sintaxe/permissão
];

const isRetryableError = (error) => {
  const code = error?.code || '';
  return !NON_RETRYABLE_ERROR_PREFIXES.some(prefix => code.startsWith(prefix));
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const insertWithRetry = async (table, payload, { maxAttempts = 3, baseDelayMs = 800 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (!error) return { data, error: null };

    lastError = error;
    if (attempt === maxAttempts || !isRetryableError(error)) {
      return { data: null, error };
    }

    const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 300;
    console.warn(`inscricaoApi - insertWithRetry: tentativa ${attempt} falhou (codigo: ${error.code || 'sem codigo'}), tentando novamente em ${Math.round(delay)}ms`, error);
    await wait(delay);
  }
  return { data: null, error: lastError };
};

const mapEquipanteToDb = (formData) => ({
  status: 'pendente',
  scale_status: 'pendente',
  tipo: 'equipante',
  nome: formData.nome,
  cpf: formData.cpf || null,
  sexo: formData.sexo,
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
  autorizacao_imagem: toBoolean(formData.autorizacaoImagemEquipante) || toBoolean(formData.autorizacaoImagem),
  contato_emergencia_nome: formData.contatoEmergencia,
  contato_emergencia_telefone: formData.telefoneEmergencia,
  area_trabalho_opcao1: formData.areaTrabalhoOpcao1,
  area_trabalho_opcao2: formData.areaTrabalhoOpcao2,
  area_trabalho_opcao3: formData.areaTrabalhoOpcao3,
  // Bug corrigido em 2026-09-01: o formulario grava a escolha em
  // formData.areasTrabalhoExtra (plural, array de ate 3 opcoes via
  // checkbox — ver AreasDeTrabalho.jsx), mas aqui lia areaTrabalhoExtra
  // (singular) por engano, que nunca existiu — sempre undefined, entao
  // essa informacao nunca era salva. A coluna e text (nao array), entao
  // varias opcoes marcadas sao unidas em uma string.
  area_trabalho_extra: Array.isArray(formData.areasTrabalhoExtra)
    ? formData.areasTrabalhoExtra.join('; ') || null
    : (formData.areasTrabalhoExtra || null),
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
      .ilike('nome', nome)
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

  // Acampante já nasce com status 'aprovado' (não existe mais uma etapa manual
  // de aprovação pra ele), então o grupo de trilha precisa ser sorteado aqui,
  // no cadastro — não dá mais pra depender de uma transição de status.
  if (tipo === 'acampante') {
    try {
      mappedData.grupo_trailha = await escolherGrupoTrailha(mappedData.sexo);
    } catch (error) {
      console.error('inscricaoApi - criarInscricao: erro ao alocar grupo de trilha', error);
      // Não bloqueia o cadastro por causa disso; a pessoa fica sem grupo e pode
      // ser alocada manualmente depois.
    }
  }

  const processedMethod = formData.metodoPagamento || mappedData.metodo_pagamento || null;

  const payload = {
    ...mappedData,
    status_pagamento: 'pendente',
    metodo_pagamento: processedMethod,
  };

  try {
    const { data, error } = await insertWithRetry(table, payload);

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