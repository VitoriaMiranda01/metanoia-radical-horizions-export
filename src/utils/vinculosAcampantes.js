import { normalizarBusca } from '@/utils/busca';

/**
 * Vinculos entre acampantes nos grupos de trilha (Patrick, 12/10/2026).
 *
 * Quem vem junto (conjuge, amigo, parente) fica em grupos DIFERENTES -- a troca
 * de grupo e estrategica. A tela so AVISA quando dois vinculados ficam no mesmo
 * grupo: com 5 grupos e 6 amigos, alguem fica junto.
 *
 * No banco (migration 20261012a) o vinculo guarda o que B e de A ("B e PAI /
 * MÃE de A"); quem olha do lado de B ve o espelho (A e FILHO / FILHA de B).
 */

export const TIPOS_VINCULO = [
  { valor: 'CONJUGE', rotulo: 'Cônjuge' },
  { valor: 'PAI / MÃE', rotulo: 'Pai/Mãe' },
  { valor: 'FILHO / FILHA', rotulo: 'Filho(a)' },
  { valor: 'IRMÃO / IRMÃ', rotulo: 'Irmão(ã)' },
  { valor: 'AVÔ / AVÓ', rotulo: 'Avô/Avó' },
  { valor: 'NETO / NETA', rotulo: 'Neto(a)' },
  { valor: 'TIO / TIA', rotulo: 'Tio(a)' },
  { valor: 'SOBRINHO / SOBRINHA', rotulo: 'Sobrinho(a)' },
  { valor: 'PRIMO / PRIMA', rotulo: 'Primo(a)' },
  { valor: 'AMIGO / AMIGA', rotulo: 'Amigo(a)' },
  { valor: 'COLEGA DE TRABALHO', rotulo: 'Colega de trabalho' },
  { valor: 'COLEGA DE ESCOLA', rotulo: 'Colega de escola' },
  { valor: 'VIZINHO / VIZINHA', rotulo: 'Vizinho(a)' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

const ROTULOS = Object.fromEntries(TIPOS_VINCULO.map((t) => [t.valor, t.rotulo]));
const VALORES = new Set(TIPOS_VINCULO.map((t) => t.valor));

const ESPELHO = {
  'PAI / MÃE': 'FILHO / FILHA',
  'FILHO / FILHA': 'PAI / MÃE',
  'AVÔ / AVÓ': 'NETO / NETA',
  'NETO / NETA': 'AVÔ / AVÓ',
  'TIO / TIA': 'SOBRINHO / SOBRINHA',
  'SOBRINHO / SOBRINHA': 'TIO / TIA',
};

export const rotuloDoTipo = (tipo) => ROTULOS[tipo] || tipo || 'Outro';

/** O que o OUTRO e de quem esta olhando (meuId). */
export const tipoVistoPor = (vinculo, meuId) =>
  (vinculo.a === meuId ? vinculo.tipo : (ESPELHO[vinculo.tipo] || vinculo.tipo));

/**
 * Familia/turma cadastrada de uma vez (23/10/2026): B e tipoB de A, C e tipoC
 * de A -> o que C e de B. Quando nao da para deduzir, OUTRO.
 */
const ENTRE_SI = {
  'FILHO / FILHA|FILHO / FILHA': 'IRMÃO / IRMÃ',
  'IRMÃO / IRMÃ|IRMÃO / IRMÃ': 'IRMÃO / IRMÃ',
  'CONJUGE|FILHO / FILHA': 'FILHO / FILHA',
  'FILHO / FILHA|CONJUGE': 'PAI / MÃE',
  'PAI / MÃE|PAI / MÃE': 'CONJUGE',
  'PAI / MÃE|IRMÃO / IRMÃ': 'FILHO / FILHA',
  'IRMÃO / IRMÃ|PAI / MÃE': 'PAI / MÃE',
  'FILHO / FILHA|PAI / MÃE': 'AVÔ / AVÓ',
  'PAI / MÃE|FILHO / FILHA': 'NETO / NETA',
};
const MESMO_TIPO = new Set(['AMIGO / AMIGA', 'COLEGA DE TRABALHO', 'COLEGA DE ESCOLA', 'VIZINHO / VIZINHA']);
export const tipoEntreSi = (tipoB, tipoC) =>
  ENTRE_SI[`${tipoB}|${tipoC}`] || (tipoB === tipoC && MESMO_TIPO.has(tipoB) ? tipoB : 'OUTRO');

/** Resposta da inscricao ("AMIGO / AMIGA", "NÃO TENHO"...) -> tipo de vinculo. */
export const tipoDaInscricao = (resposta) => (VALORES.has(resposta) ? resposta : 'OUTRO');

// Igual ao _nome_comparavel do banco: sem acento, caixa, pontuacao e sem
// "de/da/do/dos/das/e".
const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
export const nomeComparavel = (nome) => normalizarBusca(nome)
  .replace(/[^a-z]+/g, ' ')
  .split(' ')
  .filter((p) => p && !PARTICULAS.has(p))
  .join(' ');

export const temVaiCom = (a) =>
  !!a?.conhecido_no_projeto && a.conhecido_no_projeto !== 'NÃO TENHO' && !!String(a.nome_familiar_conhecido || '').trim();

/** Map id -> [{ id, vinculo, outroId, tipo }] (tipo ja visto do lado de quem olha). */
export const indexarVinculos = (vinculos) => {
  const mapa = new Map();
  const add = (meu, outro, v) => {
    if (!mapa.has(meu)) mapa.set(meu, []);
    mapa.get(meu).push({ id: v.id, vinculo: v, outroId: outro, tipo: tipoVistoPor(v, meu) });
  };
  vinculos.forEach((v) => { add(v.a, v.b, v); add(v.b, v.a, v); });
  return mapa;
};

/** Vinculos cujos dois acampantes estao hoje no mesmo grupo. */
export const vinculosEmConflito = (vinculos, porId) => vinculos.filter((v) => {
  const ga = porId.get(v.a)?.grupo_trailha;
  return !!ga && ga === porId.get(v.b)?.grupo_trailha;
});

/**
 * Candidatos para o nome escrito no "vai com": nome igual (exato) ou parecido
 * (mesmo primeiro nome e o ultimo sobrenome escrito presente; ou todas as
 * palavras escritas presentes; ou, se escreveu so um nome, o mesmo primeiro
 * nome). Os exatos vem primeiro.
 */
export const candidatosPara = (texto, acampantes, excluirId, nomesComparaveis) => {
  const alvo = nomeComparavel(texto);
  if (!alvo) return [];
  const palavras = alvo.split(' ');
  const primeira = palavras[0];
  const ultima = palavras[palavras.length - 1];
  const achados = [];
  acampantes.forEach((a) => {
    if (a.id === excluirId) return;
    const nome = nomesComparaveis?.get(a.id) ?? nomeComparavel(a.nome);
    if (!nome) return;
    if (nome === alvo) { achados.push({ acampante: a, exato: true }); return; }
    const dele = nome.split(' ');
    const parecido = palavras.length === 1
      ? dele[0] === primeira
      : (dele[0] === primeira && dele.includes(ultima)) || palavras.every((p) => dele.includes(p));
    if (parecido) achados.push({ acampante: a, exato: false });
  });
  return achados
    .sort((x, y) => (y.exato - x.exato) || String(x.acampante.nome).localeCompare(String(y.acampante.nome), 'pt-BR'))
    .slice(0, 6);
};

/**
 * Sugestoes vindas da inscricao. Some quando:
 *  - um organizador ja confirmou (vinculo com origem = quem escreveu), ou
 *  - quem escreveu ja tem vinculo com alguem que bate com o nome escrito
 *    (ex.: o outro lado ja foi confirmado).
 * As ignoradas voltam com ignorada = true (aba "Ignoradas").
 */
export const montarSugestoes = (acampantes, vinculos, ignoradas, porAcampante) => {
  const nomes = new Map(acampantes.map((a) => [a.id, nomeComparavel(a.nome)]));
  const confirmadas = new Set(vinculos.map((v) => v.origem).filter(Boolean));
  const lista = [];
  acampantes.forEach((a) => {
    if (!temVaiCom(a) || confirmadas.has(a.id)) return;
    const candidatos = candidatosPara(a.nome_familiar_conhecido, acampantes, a.id, nomes);
    const jaLigados = new Set((porAcampante.get(a.id) || []).map((x) => x.outroId));
    if (candidatos.some((c) => jaLigados.has(c.acampante.id))) return;
    lista.push({
      acampante: a,
      texto: String(a.nome_familiar_conhecido).trim(),
      resposta: a.conhecido_no_projeto,
      tipo: tipoDaInscricao(a.conhecido_no_projeto),
      candidatos,
      ignorada: ignoradas.has(a.id),
    });
  });
  return lista.sort((x, y) =>
    (y.candidatos[0]?.exato ? 1 : 0) - (x.candidatos[0]?.exato ? 1 : 0)
    || String(x.acampante.nome).localeCompare(String(y.acampante.nome), 'pt-BR'));
};

/** Texto da coluna "Não pode ficar com" (tabela e planilha). */
export const textoDosVinculos = (lista, porId) => (lista || [])
  .map((x) => {
    const outro = porId.get(x.outroId);
    if (!outro) return null;
    return `${outro.nome} (${rotuloDoTipo(x.tipo)}${outro.grupo_trailha ? ` · ${outro.grupo_trailha}` : ''})`;
  })
  .filter(Boolean)
  .join('; ');
