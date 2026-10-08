import { supabase } from '@/services/supabaseClient';
import { comReenvio, lerTodasAsLinhas } from '@/services/serviceHelpers';
import { finalizarInscricaoGratuita } from '@/services/publicDataService';
import { nomeDaIgreja } from '@/constants/igrejas';

export const savePaymentInfo = async (paymentData) => {
  try {
    const payload = {
      valor: paymentData.amount || paymentData.valor || 0,
      status: paymentData.status || 'pendente',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (paymentData.equipante_id) {
      payload.equipante_id = paymentData.equipante_id;
    }
    if (paymentData.acampante_id) {
      payload.acampante_id = paymentData.acampante_id;
    }
    
    // Fallback if data was constructed with generic inscription_id
    if (paymentData.inscription_id) {
      if (paymentData.inscription_type === 'equipante') {
        payload.equipante_id = paymentData.inscription_id;
      } else {
        payload.acampante_id = paymentData.inscription_id;
      }
    }

    if (payload.status === 'CONFIRMED' || payload.status === 'completed' || payload.status === 'pago') {
      payload.data_pagamento = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('pagamentos')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error saving payment info:', error);
    return { success: false, error: error.message };
  }
};

export const updatePaymentStatus = async (paymentId, status, extraData = {}) => {
  try {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'CONFIRMED' || status === 'completed' || status === 'pago') {
      updates.data_pagamento = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('pagamentos')
      .update(updates)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating payment status:', error);
    return { success: false, error: error.message };
  }
};

export const getPaymentStatus = async (paymentId) => {
  try {
    const { data, error } = await supabase
      .from('pagamentos')
      .select('status, data_pagamento')
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Inscricao que ficou em R$ 0,00 por cupom.
 *
 * Isto fazia duas escritas direto das tabelas (insert em "pagamentos" e
 * update na inscricao). Depois do travamento por RLS as duas passaram a levar
 * 401: a pessoa preenchia a inscricao inteira, aplicava o cupom e recebia
 * "Erro ao finalizar" -- ja inscrita e pendente. Hoje nenhum cupom ativo zera
 * o valor, entao o caminho estava inalcancavel, mas bastava ativar um cupom
 * de isencao para o problema aparecer.
 *
 * Agora quem decide se a inscricao esta zerada e o SERVIDOR: ele refaz a
 * conta (valor do lote de hoje menos o desconto do cupom) e so confirma se
 * der zero. Se fosse o navegador a decidir, bastaria chamar a funcao para
 * sair sem pagar.
 *
 * userId continua na assinatura so para nao mexer em quem chama -- nunca foi
 * usado aqui.
 */
export const finalizeZeroValuePayment = async (inscriptionType, inscriptionId, couponCode, userId = null, dono = {}) => {
  try {
    if (!inscriptionId) {
      throw new Error("ID da inscrição não encontrado para finalizar o pagamento.");
    }

    // `dono` leva o CPF (ou o nome, para quem se inscreveu sem CPF) como
    // prova de que a inscrição é dessa pessoa -- o servidor recusa sem isso.
    const resposta = await finalizarInscricaoGratuita(inscriptionType, inscriptionId, couponCode, dono.cpf, dono.nome, dono.nascimento);

    if (!resposta?.ok) {
      return { success: false, error: resposta?.erro || 'Não foi possível finalizar a inscrição.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error finalizing zero value payment:', error?.message || error);
    return { success: false, error: 'Não foi possível finalizar a inscrição. Tente novamente.' };
  }
};

export const fetchAcampantesPendentesPagamento = async () => {
  // So busca o que a tela realmente usa (Nome, CPF, Tipo, status do
  // pagamento) -- metodo_pagamento so entra no filtro (.in), nao precisa
  // estar no select pra isso funcionar.
  return supabase
    .from('acampantes')
    .select('id, nome, cpf, status_pagamento')
    .in('metodo_pagamento', ['manual', 'isento']);
};

export const fetchEquipantesPendentesPagamento = async () => {
  // Mesma coisa do lado de equipante -- so o que a tela usa.
  return supabase
    .from('equipantes')
    .select('id, nome, cpf, status_pagamento')
    .in('metodo_pagamento', ['manual', 'isento']);
};

// Registro de pagamento pelo organizador (08/10/2026): em maos, PIX que
// travou ou isencao. Grava valor recebido, cupom (se houve) e quem confirmou
// -- antes era um UPDATE direto que so marcava "pago". A regra mora no banco
// (registrar_pagamento). forma: 'manual' | 'pix' | 'isento'.
export const registrarPagamento = async (tipo, id, forma, valor = null, cupom = null) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('registrar_pagamento', {
      p_tipo: tipo, p_id: id, p_forma: forma, p_valor: valor, p_cupom: cupom || null,
    }),
    { rotulo: 'registrar pagamento' }
  );
  if (error) return { error };
  if (!data?.ok) return { error: new Error(data?.erro || 'Não foi possível registrar o pagamento.') };
  return { data };
};

/**
 * Desfaz um pagamento confirmado por engano (em maos ou isencao): a pessoa
 * volta para "Nao pagaram". PIX o servidor recusa -- o dinheiro entrou pelo
 * banco. Sem reenvio automatico: e uma gravacao.
 */
export const desfazerPagamento = async (tipo, id) => {
  const { data, error } = await supabase.rpc('desfazer_pagamento', { p_tipo: tipo, p_id: id });
  if (error) return { error };
  if (!data?.ok) return { error: new Error(data?.erro || 'Não foi possível desfazer o pagamento.') };
  return { data };
};

export const confirmarPagamentoManual = async (tipo, id, valor, cupom) =>
  registrarPagamento(tipo, id, 'manual', valor, cupom);

// ---------------------------------------------------------------------------
// Rede de seguranca de pagamento (Etapa 3 do Passo 2)
//
// Regra definida com a organizacao: "sempre que pagar precisa liberar, nunca
// pode ficar como pendente". Como nao consultamos o Sicoob ativamente, a
// garantia e operacional -- o organizador precisa CONSEGUIR VER o que travou
// e liberar na mao. Antes disso, a tela so mostrava pagamento manual/isento,
// entao um PIX travado nao aparecia em lugar nenhum.
// ---------------------------------------------------------------------------

const STATUS_QUITADOS = ['confirmado', 'pago', 'completed'];

const estaQuitada = (status) =>
  STATUS_QUITADOS.includes(String(status || '').toLowerCase());

/**
 * Inscricoes com pagamento MANUAL ou ISENTO ainda nao quitadas -- a aba
 * "Pagamentos manuais" da tela, onde o organizador confirma na mao quem
 * pagou em dinheiro/deposito ou foi isentado.
 *
 * Ate 2026-09-11 esta funcao trazia TODAS as nao quitadas, qualquer metodo,
 * para pegar tambem o PIX que travasse (pago no Sicoob mas nao liberado por
 * falha no webhook). Voltou a filtrar por metodo aqui -- pedido da usuaria
 * em 2026-09-15, porque a aba passou a mostrar todo mundo, nao so quem
 * precisa de confirmacao manual. O PIX travado continua coberto: e
 * exatamente o que a aba "Precisa de atenção" (fetchPixTravados, abaixo)
 * já existe para pegar, sem misturar com esta.
 */
export const fetchInscricoesNaoQuitadas = async () => {
  const colunas = 'id, nome, cpf, whatsapp, nacionalidade, status_pagamento, metodo_pagamento, data_pagamento';

  const [acampantes, equipantes] = await Promise.all([
    comReenvio(() => supabase.from('acampantes').select(colunas).in('metodo_pagamento', ['manual', 'isento']), { rotulo: 'acampantes pendentes' }),
    comReenvio(() => supabase.from('equipantes').select(colunas).in('metodo_pagamento', ['manual', 'isento']), { rotulo: 'equipantes pendentes' }),
  ]);

  if (acampantes.error) throw acampantes.error;
  if (equipantes.error) throw equipantes.error;

  const marcar = (linhas, tipo) =>
    (linhas || [])
      .filter((linha) => !estaQuitada(linha.status_pagamento))
      .map((linha) => ({ ...linha, tipo }));

  return [
    ...marcar(acampantes.data, 'acampante'),
    ...marcar(equipantes.data, 'equipante'),
  ];
};

/**
 * A relacao de TODO MUNDO, com quem pagou e quem nao pagou.
 *
 * Ate agora a tela de Pagamentos so mostrava quem estava pendente: assim que
 * a pessoa pagava, ela sumia. Nao existia em lugar nenhum a lista de quem ja
 * pagou -- e e exatamente essa lista que e conferida no portao, no dia do
 * evento.
 *
 * Traz os dois tipos juntos, com `quitado` resolvido pela mesma regra que o
 * resto do sistema usa (STATUS_QUITADOS), para nao haver duas definicoes de
 * "pago" no codigo.
 */
// Valor, cupom e quem confirmou, de onde estiver: registro do organizador
// (em maos, PIX travado, isencao) ou a cobranca PIX paga (automatico).
const detalheDoPagamento = (ficha, pix) => {
  const doOrganizador = ficha.pagamento_valor !== null && ficha.pagamento_valor !== undefined;
  if (doOrganizador) {
    return {
      valor_pago: Number(ficha.pagamento_valor),
      cupom_usado: ficha.pagamento_cupom || null,
      desconto: ficha.pagamento_desconto !== null ? Number(ficha.pagamento_desconto) : null,
      confirmado_por: ficha.pagamento_confirmado_por || null,
    };
  }
  if (pix && String(ficha.metodo_pagamento || '').toLowerCase() === 'pix') {
    return {
      valor_pago: Number(pix.valor),
      cupom_usado: pix.cupom_codigo || null,
      desconto: pix.desconto !== null && pix.desconto !== undefined ? Number(pix.desconto) : null,
      confirmado_por: 'PIX automático',
    };
  }
  if (String(ficha.metodo_pagamento || '').toLowerCase() === 'isento') {
    return { valor_pago: 0, cupom_usado: null, desconto: null, confirmado_por: null };
  }
  return { valor_pago: null, cupom_usado: null, desconto: null, confirmado_por: null };
};

export const fetchRelacaoDePagamentos = async () => {
  const colunasComuns =
    'id, nome, cpf, whatsapp, nacionalidade, status_pagamento, metodo_pagamento, data_pagamento, '
    + 'pagamento_valor, pagamento_cupom, pagamento_desconto, pagamento_confirmado_por';

  const [acampantes, equipantes, pixPagos] = await Promise.all([
    // Todas as linhas: os equipantes ja passam de 900 e o corte de 1000
    // linhas do Supabase deixaria gente fora da lista sem avisar.
    lerTodasAsLinhas(() => supabase.from('acampantes').select(`${colunasComuns}, igreja, admin_responsavel`).order('id'),
      { rotulo: 'acampantes' }),
    lerTodasAsLinhas(() => supabase.from('equipantes').select(`${colunasComuns}, igreja, igreja_outra, status`).order('id'),
      { rotulo: 'equipantes' }),
    // Cobrancas PIX pagas: valor, lote, desconto e cupom (os dois ultimos so
    // a partir de 08/10/2026 -- antes nao eram gravados).
    lerTodasAsLinhas(() => supabase.from('pix_sicoob')
      .select('id, inscricao_id, valor, valor_base, desconto, cupom_codigo, updated_at')
      .eq('status', 'pago').order('id'),
      { rotulo: 'cobranças PIX pagas' }),
  ]);

  if (acampantes.error) throw acampantes.error;
  if (equipantes.error) throw equipantes.error;
  if (pixPagos.error) throw pixPagos.error;

  // A cobranca paga mais recente de cada ficha.
  const pixPorFicha = new Map();
  (pixPagos.data || []).forEach((p) => {
    const atual = pixPorFicha.get(p.inscricao_id);
    if (!atual || String(p.updated_at) > String(atual.updated_at)) pixPorFicha.set(p.inscricao_id, p);
  });

  const marcar = (linhas, tipo) =>
    (linhas || []).map((linha) => ({
      ...linha,
      tipo,
      quitado: estaQuitada(linha.status_pagamento),
      ...detalheDoPagamento(linha, pixPorFicha.get(linha.id)),
      // O acampante nao escolhe igreja: quem responde por ele e a igreja que
      // fez a ficha. Para a conferencia no portao, e o mesmo dado.
      igreja: nomeDaIgreja(linha) || linha.admin_responsavel || null,
    }));

  return [
    ...marcar(acampantes.data, 'acampante'),
    ...marcar(equipantes.data, 'equipante'),
  ].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
};

/**
 * Cobrancas PIX que exigem atencao humana. Dois casos, os dois significando
 * "o dinheiro entrou (ou pode ter entrado) mas a inscricao nao liberou":
 *
 *  - pix 'pago' e inscricao ainda pendente: o webhook confirmou a cobranca
 *    mas falhou ao atualizar a inscricao;
 *  - pix 'divergente': o valor pago nao bateu com o cobrado, entao o webhook
 *    se recusou a confirmar sozinho (ver sicoob-webhook-handler).
 */
export const fetchPixTravados = async () => {
  const { data: pix, error } = await comReenvio(
    () => supabase
      .from('pix_sicoob')
      .select('id, sicoob_id, valor, status, inscricao_id, inscricao_tipo, created_at, updated_at')
      .in('status', ['pago', 'divergente']),
    { rotulo: 'cobranças PIX' }
  );

  if (error) throw error;
  if (!pix || pix.length === 0) return [];

  const ids = {
    acampante: pix.filter((p) => p.inscricao_tipo !== 'equipante').map((p) => p.inscricao_id).filter(Boolean),
    equipante: pix.filter((p) => p.inscricao_tipo === 'equipante').map((p) => p.inscricao_id).filter(Boolean),
  };

  const buscar = async (tabela, lista) => {
    if (lista.length === 0) return [];
    const { data, error: err } = await supabase
      .from(tabela)
      .select('id, nome, cpf, whatsapp, nacionalidade, status_pagamento')
      .in('id', lista);
    if (err) throw err;
    return data || [];
  };

  const [inscAcampantes, inscEquipantes] = await Promise.all([
    buscar('acampantes', ids.acampante),
    buscar('equipantes', ids.equipante),
  ]);

  const porId = new Map();
  inscAcampantes.forEach((i) => porId.set(i.id, i));
  inscEquipantes.forEach((i) => porId.set(i.id, i));

  return pix
    .map((p) => {
      const inscricao = porId.get(p.inscricao_id);
      return {
        ...p,
        tipo: p.inscricao_tipo === 'equipante' ? 'equipante' : 'acampante',
        nome: inscricao?.nome || 'Inscrição não encontrada',
        cpf: inscricao?.cpf || '—',
        whatsapp: inscricao?.whatsapp || null,
        nacionalidade: inscricao?.nacionalidade || null,
        status_inscricao: inscricao?.status_pagamento || null,
        motivo: p.status === 'divergente'
          ? 'Valor pago diferente do cobrado'
          : 'PIX pago, inscrição não liberada',
      };
    })
    // 'divergente' sempre exige decisao. 'pago' so interessa se a inscricao
    // ainda nao estiver quitada -- se ja estiver, o fluxo funcionou.
    .filter((p) => p.status === 'divergente' || !estaQuitada(p.status_inscricao));
};

/**
 * Isencao de taxa. Regra definida com a organizacao em 11/09/2026: isencao
 * e SEMPRE decisao de um organizador, nunca de cupom -- por isso os cupons
 * ISENTO_* foram desativados.
 */
export const isentarInscricao = async (tipo, id) => registrarPagamento(tipo, id, 'isento');

/**
 * Cobranca dos acampantes que nao pagaram (migration 20261006h, pedido da
 * Raquel em 06/10/2026). Sem registro = "Nao pagaram"; 'em_cobranca' =
 * "Cobranca em andamento"; 'agendado' = "Pagamento agendado" (com data).
 * Quando a pessoa paga, o banco tira a cobranca sozinho.
 *
 * Formato: { [acampante_id]: { status, agendado_para, observacao, marcado_por, marcado_em } }
 */
export const fetchCobrancas = async () => {
  const { data, error } = await supabase.rpc('cobrancas_listar');
  if (error) throw error;
  return data || {};
};

const ERROS_COBRANCA = {
  DATA_OBRIGATORIA: 'Escolha a data combinada para o pagamento.',
  OBSERVACAO_LONGA: 'A observação passa de 200 caracteres.',
  JA_PAGO: 'Essa pessoa já pagou. Atualize a lista.',
  ACAMPANTE_NAO_ENCONTRADO: 'Inscrição não encontrada. Atualize a lista.',
  SEM_PERMISSAO: 'Sua sessão não tem permissão. Saia e entre de novo.',
};

const erroDeCobranca = (error) => {
  const codigo = Object.keys(ERROS_COBRANCA).find((c) => String(error?.message || '').includes(c));
  return new Error(codigo ? ERROS_COBRANCA[codigo] : 'Não foi possível salvar a cobrança.');
};

export const definirCobranca = async (acampanteId, status, agendadoPara, observacao) => {
  const { error } = await supabase.rpc('cobranca_definir', {
    p_acampante_id: acampanteId,
    p_status: status,
    p_agendado_para: status === 'agendado' ? agendadoPara : null,
    p_observacao: observacao || null,
  });
  if (error) throw erroDeCobranca(error);
};

/** Volta a pessoa para "Nao pagaram". */
export const removerCobranca = async (acampanteId) => {
  const { error } = await supabase.rpc('cobranca_remover', { p_acampante_id: acampanteId });
  if (error) throw erroDeCobranca(error);
};

/**
 * Equipantes que ja podem pagar: a escala saiu (provisoria ou oficial) e a
 * pessoa esta numa area de verdade -- a mesma regra do banco
 * (_equipante_pode_pagar). Antes disso, equipante nao aparece em "Nao
 * pagaram": nao tem como cobrar de quem ainda nem pode pagar.
 *
 * Devolve um Set com os ids (vazio enquanto a escala nao sai).
 */
export const fetchEquipantesComPagamentoAberto = async () => {
  const { data: config, error: errConfig } = await supabase
    .from('configuracoes').select('escala_lancada_em').limit(1).maybeSingle();
  if (errConfig) throw errConfig;
  if (!config?.escala_lancada_em) return new Set();

  const { data, error } = await lerTodasAsLinhas(
    () => supabase.from('escalas').select('id, equipante_id, area_alocada').neq('area_alocada', 'Não será escalado').order('id'),
    { rotulo: 'escala' }
  );
  if (error) throw error;
  return new Set((data || []).map((e) => e.equipante_id));
};

/**
 * Convite do grupo de WhatsApp ja enviado (migration 20261006k, pedido da
 * Raquel em 06/10/2026). Formato: { [id da ficha]: { em, por } }.
 */
export const fetchGruposEnviados = async () => {
  const { data, error } = await supabase.rpc('grupo_enviado_listar');
  if (error) throw error;
  return data || {};
};

const erroDeGrupo = () => new Error('Não foi possível registrar. Tente de novo.');

/** Marca como enviado (quem ja estava marcado fica como estava). */
export const marcarGrupoEnviado = async (tipo, ids) => {
  const { data, error } = await supabase.rpc('grupo_enviado_marcar', { p_tipo: tipo, p_ids: ids });
  if (error) throw erroDeGrupo();
  return data;
};

export const desmarcarGrupoEnviado = async (tipo, id) => {
  const { error } = await supabase.rpc('grupo_enviado_desmarcar', { p_tipo: tipo, p_id: id });
  if (error) throw erroDeGrupo();
};
