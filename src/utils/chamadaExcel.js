import { COLUNAS, ROTULO_PRESENCA, PLURAL, COR_PRESENCA } from '@/utils/chamadaPdf';
import { entregarArquivo } from '@/utils/entregarArquivo';

/**
 * Excel da chamada da reuniao de escala (28/10/2026, Patrick: "a mesma coisa
 * do PDF, mas no Excel"). Mesma montagem do PDF (`chamadaPdf.js`) numa aba so:
 * faixa verde com o titulo, "Gerado em", cabecalho, e uma faixa verde por AREA
 * (ordem alfabetica, com total e contagem por situacao) seguida das pessoas em
 * ordem alfabetica, com a coluna Presenca colorida. exceljs so carrega ao exportar.
 */

const compararTexto = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
const MAIUSC = (t) => String(t || '').toLocaleUpperCase('pt-BR');

const VERDE = 'FF9BBB59';
const PRETO = 'FF000000';
const argb = ([r, g, b]) => `FF${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export const exportarChamadaExcel = async ({ pessoas, colunas, situacoes, area = '' }) => {
  const cols = colunas.filter((c) => COLUNAS[c]);
  if (cols.length === 0) throw new Error('Escolha ao menos uma coluna.');

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metanoia Radical Serra';
  const somaPesos = cols.reduce((n, c) => n + COLUNAS[c].peso, 0);
  const ws = wb.addWorksheet('CHAMADA', {
    pageSetup: {
      orientation: somaPesos > 563 ? 'landscape' : 'portrait',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.55, bottom: 0.5, header: 0, footer: 0 }
    }
  });
  ws.columns = cols.map((c) => ({ width: Math.max(8, Math.round(COLUNAS[c].peso / 5)) }));

  const fino = { style: 'thin', color: { argb: PRETO } };
  const bordas = { top: fino, left: fino, bottom: fino, right: fino };
  const fonte = (tamanho, negrito, cor = PRETO) => ({ name: 'Calibri', size: tamanho, bold: negrito, color: { argb: cor } });
  const faixa = (texto, tamanho) => {
    const row = ws.addRow([texto]);
    row.height = 18;
    cols.forEach((_, i) => {
      const cell = row.getCell(i + 1);
      cell.font = fonte(tamanho, true);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
      cell.border = bordas;
    });
    if (cols.length > 1) ws.mergeCells(row.number, 1, row.number, cols.length);
  };
  const linha = (valores, negrito, corPorColuna = {}) => {
    const row = ws.addRow(valores);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = fonte(10, negrito || !!corPorColuna[c], corPorColuna[c] || PRETO);
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = bordas;
    });
  };

  const tituloGeral = `CHAMADA · ${situacoes.length === 3 ? 'PRESENTES, AUSENTES E SEM CHAMADA'
    : situacoes.map((s) => MAIUSC(ROTULO_PRESENCA[s])).join(' E ')}${area ? ` · ${MAIUSC(area)}` : ''} (${pessoas.length})`;
  faixa(tituloGeral, 13);
  const gerado = ws.addRow([`Gerado em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`]);
  gerado.getCell(1).font = fonte(8.5, false);
  if (cols.length > 1) ws.mergeCells(gerado.number, 1, gerado.number, cols.length);
  gerado.getCell(1).alignment = { horizontal: 'right' };

  if (pessoas.length === 0) {
    ws.addRow(['Ninguém nesta seleção.']);
  } else {
    linha(cols.map((c) => MAIUSC(COLUNAS[c].rotulo)), true);
    ws.views = [{ state: 'frozen', ySplit: ws.rowCount }];
    ws.pageSetup.printTitlesRow = `${ws.rowCount}:${ws.rowCount}`;

    const porArea = new Map();
    pessoas.forEach((p) => {
      const a = p.area || 'Sem área';
      if (!porArea.has(a)) porArea.set(a, []);
      porArea.get(a).push(p);
    });
    [...porArea.entries()].sort(([a], [b]) => compararTexto(a, b)).forEach(([nomeArea, lista]) => {
      const conta = (s) => lista.filter((p) => p.situacao === s).length;
      const detalhe = situacoes.length > 1
        ? ` · ${situacoes.map((s) => `${conta(s)} ${PLURAL[s](conta(s))}`).join(' · ')}`
        : '';
      faixa(`${MAIUSC(nomeArea)} (${lista.length})${detalhe}`, 11);
      [...lista].sort((a, b) => compararTexto(a.nome, b.nome)).forEach((p) => {
        const cor = COR_PRESENCA[p.situacao];
        linha(cols.map((c) => COLUNAS[c].valor(p)), false, cor ? { presenca: argb(cor) } : {});
      });
    });
  }

  const nome = situacoes.length === 3 ? 'completa' : situacoes.map((s) => ROTULO_PRESENCA[s]).join('_');
  const sufixo = area ? `_${area}` : '';
  const arquivo = `Chamada_${nome}${sufixo}_${new Date().toISOString().slice(0, 10)}.xlsx`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  const buffer = await wb.xlsx.writeBuffer();
  await entregarArquivo(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), arquivo);
  return pessoas.length;
};
