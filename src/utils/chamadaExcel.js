import * as XLSX from 'xlsx';
import { COLUNAS, ROTULO_PRESENCA } from '@/utils/chamadaPdf';
import { entregarArquivo } from '@/utils/entregarArquivo';

/**
 * Excel da chamada da reuniao de escala (28/10/2026, Patrick). Mesmos dados e
 * colunas do PDF (`chamadaPdf.js`): aba "Resumo" com o total e a contagem por
 * situacao de cada area e uma aba por area (ordem alfabetica), pessoas em
 * ordem alfabetica dentro de cada uma.
 */

const compararTexto = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });

const nomeDaAba = (nome, usados) => {
  const base = (String(nome || 'Sem área').replace(/[\\/?*[\]:]/g, ' ').trim() || 'Sem área').slice(0, 31);
  let candidata = base;
  for (let n = 2; usados.has(candidata.toLowerCase()); n++) candidata = `${base.slice(0, 28)} ${n}`;
  usados.add(candidata.toLowerCase());
  return candidata;
};

const largurasDe = (linhas) => Object.keys(linhas[0]).map((k) => ({
  wch: Math.min(60, Math.max(k.length, ...linhas.map((l) => String(l[k] ?? '').length)) + 2)
}));

export const exportarChamadaExcel = async ({ pessoas, colunas, situacoes, area = '' }) => {
  const cols = colunas.filter((c) => COLUNAS[c]);
  if (cols.length === 0) throw new Error('Escolha ao menos uma coluna.');
  if (pessoas.length === 0) throw new Error('Ninguém nesta seleção.');

  const porArea = new Map();
  pessoas.forEach((p) => {
    const a = p.area || 'Sem área';
    if (!porArea.has(a)) porArea.set(a, []);
    porArea.get(a).push(p);
  });
  const areas = [...porArea.entries()].sort(([a], [b]) => compararTexto(a, b));

  const wb = XLSX.utils.book_new();
  const usados = new Set(['resumo']);

  const resumo = areas.map(([nome, lista]) => ({
    Área: nome,
    Total: lista.length,
    ...Object.fromEntries(situacoes.map((s) => [ROTULO_PRESENCA[s], lista.filter((p) => p.situacao === s).length]))
  }));
  const ws0 = XLSX.utils.json_to_sheet(resumo);
  ws0['!cols'] = largurasDe(resumo);
  XLSX.utils.book_append_sheet(wb, ws0, 'Resumo');

  areas.forEach(([nome, lista]) => {
    const linhas = [...lista].sort((a, b) => compararTexto(a.nome, b.nome))
      .map((p) => Object.fromEntries(cols.map((c) => [COLUNAS[c].rotulo, COLUNAS[c].valor(p)])));
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws['!cols'] = largurasDe(linhas);
    XLSX.utils.book_append_sheet(wb, ws, nomeDaAba(nome, usados));
  });

  const nome = situacoes.length === 3 ? 'completa' : situacoes.map((s) => ROTULO_PRESENCA[s]).join('_');
  const sufixo = area ? `_${area}` : '';
  const arquivo = `Chamada_${nome}${sufixo}_${new Date().toISOString().slice(0, 10)}.xlsx`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await entregarArquivo(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), arquivo);
  return pessoas.length;
};
