import { dividirEmOnibus, montarOnibusFechados } from '@/utils/onibus';

/**
 * Ajudas da recepcao dos acampantes (25/10/2026, migration 20261025g), usadas
 * pela tela /recepcao e pelo modulo "Presenca dos Acampantes".
 */

export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const chave = (p) => `${p.tipo}:${p.id}`;

export const horaCurta = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

export const dataHora = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

// "Recepção: Bruna" -> "Bruna".
export const quemFez = (quem) => String(quem || '').replace(/^Recepção: /, '');

// Pessoas da lista do banco no formato das contas dos onibus.
export const comoParticipante = (p) => ({ ...p, grupo_trailha: p.grupo || null });

/**
 * Onibus de cada um, igual as Listas dos onibus do organizador. Divisao
 * fechada: o que foi gravado (inclusive quem o organizador pos a mao).
 * Aberta: a conta ao vivo, com o numero de onibus e os lugares salvos. Vai
 * todo mundo da lista: o banco ja so manda pago, isento ou com pagamento
 * agendado (26/10/2026: antes o agendado ficava fora dos onibus).
 * Devolve { onibus, semLugar, fechada, porPessoa: Map(chave -> numero) }.
 */
export const onibusDaRecepcao = (pessoas, cfg = {}) => {
  const fechada = !!cfg.fechada_em;
  const numero = Number(cfg.numero) || 4;
  const lugares = Array.isArray(cfg.lugares) ? cfg.lugares : [];
  const lista = pessoas.map(comoParticipante);
  const r = fechada
    ? montarOnibusFechados(lista, numero, lugares, (p) => p.onibus || null)
    : dividirEmOnibus(lista, numero, lugares.slice(0, numero));
  const porPessoa = new Map();
  r.onibus.forEach((o) => o.pessoas.forEach((p) => porPessoa.set(chave(p), o.numero)));
  return { ...r, fechada, porPessoa };
};

export const PDF_TERMO_BUCKET = 'termo-responsabilidade-acampante';
export const PDF_TERMO_ARQUIVO = 'termo_de_responsabilidade_e_orientacoes_metanoia_radical_serra_acampante.pdf';
