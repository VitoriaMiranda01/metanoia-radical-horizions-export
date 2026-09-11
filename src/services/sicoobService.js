import { supabase } from '@/services/supabaseClient';

const ERRO_GENERICO = 'Falha de conexão com gateway Sicoob. Tente novamente.';

/**
 * Le a mensagem que a Edge Function devolveu.
 *
 * O supabase-js transforma qualquer resposta fora da faixa 2xx em "error" e
 * deixa "data" nulo -- entao a mensagem util fica no corpo da resposta, dentro
 * de error.context, e nao em error.message (que e sempre o generico
 * "Edge Function returned a non-2xx status code").
 *
 * Sem isso, as recusas da funcao ("esta inscricao ja esta paga", "a isencao
 * precisa ser liberada pela organizacao", "nenhum valor definido para hoje")
 * chegariam na tela como erro de conexao, e a pessoa nao saberia o que fazer.
 */
const mensagemDoErro = async (error) => {
  try {
    const corpo = await error?.context?.json?.();
    if (corpo?.error) return String(corpo.error);
  } catch (_) {
    // corpo nao era JSON -- cai no generico
  }
  return ERRO_GENERICO;
};

export const gerarPixSicoob = async (
  valor,
  descricao,
  cpf,
  tipoInscricao,
  nome_pagador = 'Pagador',
  inscricao_id = null,
  coupon_code = null
) => {
  try {
    // "valor" continua sendo enviado, mas a Edge Function NAO o usa para
    // cobrar -- ela recalcula o preco a partir de configuracoes e do cupom
    // conferido no banco, e usa este numero so para registrar divergencia.
    // O valor que aparece na tela para o usuario e o mesmo, porque a conta e
    // a mesma; o servidor e que passou a ser a autoridade.
    const { data, error } = await supabase.functions.invoke('sicoob-pix-create', {
      body: {
        valor,
        descricao,
        cpf,
        nome_pagador,
        minutos_expiracao: 30,
        inscricao_tipo: tipoInscricao,
        inscricao_id,
        coupon_code
      }
    });

    if (error) {
      throw new Error(await mensagemDoErro(error));
    }

    if (!data?.success) {
      throw new Error(data?.error || ERRO_GENERICO);
    }

    return {
      qrcode: data.qrcode || data.qr_code_image || null,
      pixCopiaECola: data.pixCopiaECola || data.pix_copia_cola || data.qr_code,
      id_transacao: data.sicoob_id,
      txid: data.sicoob_id,
      // Valor efetivamente cobrado, apurado pelo servidor. A tela pode usar
      // isto para mostrar o valor real da cobranca em vez do que ela calculou.
      valor_cobrado: data.valor,
      coupon_code: data.cupom_aplicado ?? coupon_code
    };
  } catch (err) {
    console.error('sicoobApi - gerarPixSicoob', err?.message || err, { tipoInscricao, inscricao_id });
    throw new Error(err?.message || ERRO_GENERICO);
  }
};
