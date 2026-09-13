/**
 * Quem aprovou (ou rejeitou) uma inscrição de equipante.
 *
 * O carimbo é escrito pelo servidor, na função `decidir_inscricao`, a partir
 * do crachá de quem clicou — nunca pelo navegador. Aqui só traduzimos as
 * quatro colunas (`decidido_por`, `decidido_por_tipo`, `decidido_por_igreja`,
 * `decidido_em`) para uma frase legível.
 *
 * Vale para os dois lados: a mesma tela de Aprovações é usada por
 * organizadores e por igrejas parceiras, então a frase precisa deixar claro
 * de onde veio a decisão.
 */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
               'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const quandoLegivel = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${hora}:${min}`;
};

/**
 * Devolve null quando ainda não há decisão (inscrição pendente, ou ficha
 * antiga de antes deste registro existir) — a tela não deve inventar autor.
 *
 * Quando há, devolve:
 *   verbo   'Aprovada' | 'Rejeitada' | 'Decidida'
 *   por     nome de quem assinou
 *   origem  'organizador' ou '25 - METODISTA NOVA SUÍÇA'
 *   quando  '13 set 03:20'  (null se a data não veio)
 *   frase   'Aprovada por Bruno · organizador · 13 set 03:20'
 */
export function decisaoDaInscricao(inscricao) {
  const por = (inscricao?.decidido_por || '').trim();
  if (!por) return null;

  const status = (inscricao?.status || '').toLowerCase();
  const verbo = status === 'aprovado' ? 'Aprovada'
    : status === 'rejeitado' ? 'Rejeitada'
      : 'Decidida';

  const ehParceiro = inscricao.decidido_por_tipo === 'parceiro';
  const origem = ehParceiro
    ? (inscricao.decidido_por_igreja || 'igreja parceira')
    : 'organizador';

  const quando = quandoLegivel(inscricao.decidido_em);

  return {
    verbo,
    por,
    origem,
    ehParceiro,
    quando,
    frase: [`${verbo} por ${por}`, origem, quando].filter(Boolean).join(' · ')
  };
}
