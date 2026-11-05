import { formatEventDateRange } from '@/utils/eventDateFormat';

/**
 * Equipante menor de idade na aprovacao (Patrick, 05/11/2026, 20261105a).
 *
 * Nao ha mais carta: quem aprova (pastor parceiro, ou organizador nas igrejas
 * sem parceiro) declara que falou com o responsavel. O texto da declaracao
 * fica gravado pela versao (menor_declaracao_versao = '20261105a'); mudar o
 * texto aqui pede versao nova no banco.
 */

export const DECLARACAO_MENOR_TITULO = 'Atenção!';
export const DECLARACAO_MENOR_TEXTO =
  'Ao confirmar, o pastor responsável declara estar ciente da participação do menor de idade no '
  + 'Projeto Metanoia Radical e confirma que os pais ou responsáveis legais autorizaram sua '
  + 'participação, bem como que o menor estará acompanhado por um responsável durante todo o projeto.';
export const DECLARACAO_MENOR_PEDIDO =
  'Por favor, confirme somente se todas essas condições estiverem atendidas.';

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
const semCodigo = (igreja) => String(igreja || '').replace(/^\s*\d+\s*-\s*/, '').trim();
const ehPastor = (nome) => /^(pr\.?|pra\.?|pastor|pastora)\s/i.test(String(nome || '').trim());

/** Link do WhatsApp (celular brasileiro) com a mensagem pronta. */
export const linkWhatsApp = (telefone, texto) => {
  let d = String(telefone || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return `https://wa.me/55${d}?text=${encodeURIComponent(texto)}`;
};

/**
 * Mensagem para o pastor mandar ao responsavel do menor.
 * menor: item de menores_da_aprovacao; ctx: { quem, edicao, eventoInicio, eventoFim }.
 */
export const mensagemParaResponsavel = (menor, ctx = {}) => {
  const fem = String(menor?.sexo || '').toLowerCase().startsWith('f');
  const o = fem ? 'a' : 'o';
  const ele = fem ? 'ela' : 'ele';
  const dele = fem ? 'dela' : 'dele';
  const filho = fem ? 'sua filha' : 'seu filho';
  const nomeMenor = String(menor?.nome || '').trim();
  const pNome = primeiroNome(nomeMenor);
  const resp = primeiroNome(menor?.responsavel_nome);
  const acomp = menor?.acompanhante?.pessoa?.nome || menor?.acompanhante_nome || '';

  const quem = ctx.quem || {};
  const igreja = semCodigo(quem.papel === 'parceiro' ? (menor?.igreja || quem.igreja) : quem.igreja);
  let apresentacao;
  if (quem.papel === 'parceiro') {
    const nome = String(quem.nome || '').trim();
    apresentacao = nome
      ? `Aqui é ${ehPastor(nome) ? nome : `o pastor ${nome}`}${igreja ? `, da igreja ${igreja}` : ''}.`
      : `Aqui é o pastor${igreja ? ` da igreja ${igreja}` : ''}.`;
  } else {
    apresentacao = `Aqui é ${quem.nome ? `${quem.nome}, ` : ''}da organização do Metanoia Radical Serra.`;
  }

  const datas = formatEventDateRange(ctx.eventoInicio, ctx.eventoFim);
  const edicao = ctx.edicao ? `${ctx.edicao}ª edição` : 'próxima edição';

  const partes = [
    `Olá${resp ? `, ${resp}` : ''}! Tudo bem? A paz do Senhor!`,
    apresentacao,
    `${filho.charAt(0).toUpperCase()}${filho.slice(1)}, ${nomeMenor}, se inscreveu para servir como equipante na ${edicao} do Metanoia Radical Serra${datas ? `, nos dias ${datas}` : ''}. Como ${ele} é menor de idade, precisamos que você, como responsável, esteja ciente e autorize a participação ${dele}.`,
  ];
  if (acomp) {
    partes.push(`Na inscrição, ${pNome} informou que quem vai acompanhá-l${o} durante todo o projeto é *${acomp}*, que também vai servir nesta edição. Lembrando que ${ele} precisa estar acompanhad${o} durante todo o evento.`);
    partes.push(`Você autoriza a participação de ${pNome} e confirma ${acomp} como acompanhante ${dele}? Se estiver tudo certo, é só responder esta mensagem com *"Autorizo"*.`);
  } else {
    partes.push(`Lembrando que ${ele} precisa estar acompanhad${o} por um adulto responsável durante todo o evento. Você autoriza a participação de ${pNome}? Se estiver tudo certo, é só responder esta mensagem com *"Autorizo"*.`);
  }
  partes.push('Qualquer dúvida, estou à disposição. Deus abençoe!');
  return partes.join('\n\n');
};

/** Situacao do acompanhante, para tag e aviso. */
export const SITUACAO_ACOMPANHANTE = {
  encontrado: { rotulo: 'Acompanhante encontrado', cor: 'green' },
  varios: { rotulo: 'Vários equipantes com nome parecido: escolha o acompanhante', cor: 'amber' },
  nao_encontrado: { rotulo: 'Inscrição do acompanhante ainda não encontrada no sistema', cor: 'amber' },
  menor: { rotulo: 'O acompanhante informado também é menor de idade — isso não pode', cor: 'red' },
  sem_nome: { rotulo: 'O menor não informou o acompanhante', cor: 'red' },
};

/** Mapa id do menor -> item, e id do acompanhante -> [menores]. */
export const indexarMenores = (itens = []) => {
  const porId = new Map();
  const acompanhanteDe = new Map();
  itens.forEach((m) => {
    porId.set(m.id, m);
    const p = m.acompanhante?.pessoa;
    if (p?.id) {
      if (!acompanhanteDe.has(p.id)) acompanhanteDe.set(p.id, []);
      acompanhanteDe.get(p.id).push({ id: m.id, nome: m.nome });
    }
  });
  return { porId, acompanhanteDe };
};
