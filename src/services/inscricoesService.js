import { supabase } from '@/services/supabaseClient';
import { mapFormDataToDb as mapAcampanteToDb } from '@/utils/acampanteForm';
import { toBoolean } from '@/utils/formatters';
import {
  verificarInscricaoPublica,
  criarInscricaoPublica,
  registrarMetodoPagamento,
  finalizarInscricaoGratuita,
} from '@/services/publicDataService';

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
  'P0',    // exceção levantada por função/trigger no banco (ex: RAISE EXCEPTION
           // do limite de acampantes por igreja) -- é regra de negócio, tentar
           // de novo não resolve, só atrasa a pessoa ver o erro real.
];

const isRetryableError = (error) => {
  const code = error?.code || '';
  return !NON_RETRYABLE_ERROR_PREFIXES.some(prefix => code.startsWith(prefix));
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// O insert direto virou chamada à função criar_inscricao (ver
// publicDataService.js), mas o reenvio continua valendo pelo mesmo motivo de
// antes: o gargalo é a sobrecarga do banco em picos de inscrição, e isso não
// muda por a escrita passar por uma função.
const comReenvio = async (executar, { maxAttempts = 3, baseDelayMs = 800 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await executar();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryableError(error)) throw error;

      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 300;
      console.warn(`inscricaoApi - tentativa ${attempt} falhou (codigo: ${error?.code || 'sem codigo'}), tentando novamente em ${Math.round(delay)}ms`);
      await wait(delay);
    }
  }
  throw lastError;
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

/**
 * MUDANCA DE SEGURANCA (Passo 2, etapa 5)
 * ---------------------------------------
 * verificarCPF e verificarNome faziam select('*') na tabela e devolviam a
 * LINHA INTEIRA de outra pessoa -- endereco, condicoes medicas, medicamentos,
 * se esta gravida, contato de emergencia -- so para responder "ja existe?".
 * Bastava chutar CPFs para colher a base.
 *
 * Agora quem responde e a funcao verificar_inscricao, no servidor, e ela
 * devolve so { existe, pago, inscrito } -- mais id e nome apenas quando a
 * pessoa NAO pagou, porque nesse caso a tela a leva direto ao pagamento
 * pendente. Quem ja pagou nao tem nenhum dado devolvido.
 *
 * O formato de retorno foi mantido para nao exigir mudanca nas telas.
 */
const montarResultadoVerificacao = (resultado, cpfDigitado) => {
  if (!resultado?.existe) {
    return { existe: false, found: false };
  }

  // "dados" agora e o minimo necessario para seguir ao pagamento, nao mais a
  // ficha completa. Quem ja pagou nao recebe id nem nome.
  const dados = resultado.pago
    ? null
    : { id: resultado.id, nome: resultado.nome, cpf: cpfDigitado ?? null };

  return {
    existe: true,
    found: true,
    dados,
    data: dados,
    inscrito: !!resultado.inscrito,
    pagou: !!resultado.pago,
    status_pagamento: resultado.pago ? 'confirmado' : 'pendente'
  };
};

export const verificarCPF = async (cpf, tipo) => {
  if (!cpf) {
    console.error('inscricaoApi - verificarCPF: CPF nulo ou indefinido fornecido');
    return { existe: false, found: false };
  }

  try {
    const resultado = await verificarInscricaoPublica({ tipo, cpf });
    return montarResultadoVerificacao(resultado, cpf);
  } catch (error) {
    console.error(`inscricaoApi - verificarCPF (${tipo})`, error?.message || error);
    throw new Error('Erro ao verificar CPF. Tente novamente mais tarde.');
  }
};

export const verificarNome = async (nome, tipo) => {
  if (!nome) {
    console.error('inscricaoApi - verificarNome: Nome nulo ou indefinido fornecido');
    return { existe: false, found: false };
  }

  try {
    const resultado = await verificarInscricaoPublica({ tipo, nome });
    return montarResultadoVerificacao(resultado, null);
  } catch (error) {
    console.error(`inscricaoApi - verificarNome (${tipo})`, error?.message || error);
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

  // O sorteio do grupo de trilha saiu daqui: era feito no navegador e exigia
  // ler a tabela de acampantes inteira só para contar quantos havia em cada
  // grupo. Agora quem sorteia é o servidor, dentro de criar_inscricao.

  const processedMethod = formData.metodoPagamento || mappedData.metodo_pagamento || null;

  const payload = {
    ...mappedData,
    metodo_pagamento: processedMethod,
  };

  try {
    // O insert direto virou chamada à função criar_inscricao: o servidor é que
    // define status de pagamento, dados de transação, aprovação e grupo de
    // trilha, e devolve só o id. Sem isso, qualquer um podia se inserir já
    // marcado como "confirmado".
    const resultado = await comReenvio(() => criarInscricaoPublica(tipo, payload));

    if (!resultado?.id) {
      throw new Error('A inscrição não retornou identificador.');
    }

    // As telas seguem usando result.data.id para ir ao pagamento.
    return { success: true, data: { ...payload, id: resultado.id } };
  } catch (error) {
    console.error(`inscricaoApi - criarInscricao (${tipo})`, error?.message || error);

    // Trigger do limite de acampantes por igreja (ver migration
    // schema-update-20260907-limite-acampantes-por-igreja.sql) -- mensagem
    // amigavel em vez do erro cru do banco. O seletor de igreja no
    // formulario ja tenta evitar isso desabilitando igrejas no limite, mas
    // essa e a garantia de verdade (protege contra cadastros simultaneos).
    if (error?.message?.includes('LIMITE_IGREJA_ATINGIDO')) {
      return { success: false, error: 'Essa igreja atingiu o limite de inscrições de acampantes. Escolha outra igreja ou entre em contato com a organização.' };
    }

    // Recusas da propria criar_inscricao (ver migration
    // criar_inscricao_valida_abertura_e_dados). O servidor passou a conferir
    // a janela de inscricao e os dados minimos -- antes isso so existia no
    // navegador, entao uma chamada direta a API furava as duas coisas.
    if (error?.message?.includes('INSCRICOES_FECHADAS')) {
      return { success: false, error: 'As inscrições não estão abertas no momento.' };
    }
    if (error?.message?.includes('NOME_OBRIGATORIO')) {
      return { success: false, error: 'Informe o nome completo para concluir a inscrição.' };
    }

    // CPF ja cadastrado. A tela pergunta o CPF antes do formulario justamente
    // para isso, mas duas pessoas enviando ao mesmo tempo ainda chegam aqui --
    // e "Erro ao processar inscrição" nao diz nada a quem esta tentando.
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return { success: false, error: 'Já existe uma inscrição com esse CPF nesta edição.' };
    }

    return { success: false, error: 'Erro ao processar inscrição.' };
  }
};

/**
 * Registra a forma de pagamento escolhida (PIX ou Manual).
 *
 * Isto escrevia direto na tabela. Depois do travamento por RLS (Passo 2) a
 * chamada passou a levar 401 -- e o erro era engolido pelo try/catch de quem
 * chamava, entao a escolha NUNCA era gravada: na tela de Pagamentos do
 * organizador todo mundo aparecia como "Não Informado", sem dar para separar
 * quem ia depositar de quem abandonou um PIX.
 *
 * Agora quem grava e o servidor, e so o que ele aceita: 'pix' ou 'manual', e
 * apenas enquanto a inscricao ainda estiver pendente. O status do pagamento
 * NAO e mais tocado aqui -- quem confirma pagamento e o webhook do Sicoob ou
 * um organizador.
 */
export const atualizarStatusPagamento = async (idInscricao, tipo, status, metodo, idTransacao, dono = {}) => {
  if (!idInscricao) {
    console.error('inscricaoApi - atualizarStatusPagamento: ID da inscrição ausente');
    return { success: false, error: 'ID da inscrição inválido' };
  }

  try {
    // `dono` leva o CPF (ou o nome, para quem se inscreveu sem CPF) como
    // prova de que a inscrição é dessa pessoa -- o servidor recusa sem isso.
    const resposta = await registrarMetodoPagamento(tipo, idInscricao, metodo, dono.cpf, dono.nome);
    if (!resposta?.ok) {
      return { success: false, error: resposta?.erro || 'Erro ao atualizar pagamento.' };
    }
    return { success: true };
  } catch (error) {
    console.error(`inscricaoApi - atualizarStatusPagamento (${tipo})`, error?.message || error, { idInscricao, metodo });
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