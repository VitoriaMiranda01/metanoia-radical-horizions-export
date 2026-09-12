import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';
import { finalizarInscricaoGratuita } from '@/services/publicDataService';

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
export const finalizeZeroValuePayment = async (inscriptionType, inscriptionId, couponCode, userId = null) => {
  try {
    if (!inscriptionId) {
      throw new Error("ID da inscrição não encontrado para finalizar o pagamento.");
    }

    const resposta = await finalizarInscricaoGratuita(inscriptionType, inscriptionId, couponCode);

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

export const confirmarPagamentoManual = async (tipo, id) => {
  const table = tipo === 'acampante' ? 'acampantes' : 'equipantes';
  return supabase
    .from(table)
    .update({
      status_pagamento: 'confirmado',
      data_pagamento: new Date().toISOString()
    })
    .eq('id', id);
};

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
 * Inscricoes que ainda nao estao quitadas, independente do metodo de
 * pagamento. E daqui que sai a liberacao manual de quem diz que pagou mas
 * cujo PIX nunca foi confirmado (ex.: o Sicoob nao chamou o webhook).
 */
export const fetchInscricoesNaoQuitadas = async () => {
  const colunas = 'id, nome, cpf, status_pagamento, metodo_pagamento, data_pagamento';

  const [acampantes, equipantes] = await Promise.all([
    comReenvio(() => supabase.from('acampantes').select(colunas), { rotulo: 'acampantes pendentes' }),
    comReenvio(() => supabase.from('equipantes').select(colunas), { rotulo: 'equipantes pendentes' }),
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
      .select('id, nome, cpf, status_pagamento')
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
export const isentarInscricao = async (tipo, id) => {
  const table = tipo === 'equipante' ? 'equipantes' : 'acampantes';
  return supabase
    .from(table)
    .update({
      status_pagamento: 'confirmado',
      metodo_pagamento: 'isento',
      data_pagamento: new Date().toISOString()
    })
    .eq('id', id);
};
