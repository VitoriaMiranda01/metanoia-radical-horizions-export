/**
 * EQUIPE DE TRILHA - GRUPOS (23/10/2026, Patrick): reproduz a planilha "Equipe
 * de trilha 37" -- um bloco por cor (Roxo, Vermelho, Amarelo, Verde, Azul),
 * cada um com as faixas GUIAS, INIMIGO, ESPIRITO SANTO, INVISÍVEIS, MARCADOR e
 * PASTOR INVISÍVEL e, embaixo de cada faixa, só o nome dos escalados (coluna A,
 * ordem alfabética), como na planilha. Quem está sem cor vai para o fim da
 * própria faixa no último grupo (Azul).
 * As bibliotecas (jspdf, exceljs) só carregam ao exportar.
 */

// Áreas da equipe de trilha, na ordem da planilha. `a`: nome da área sem acento.
export const SECOES_TRILHA = [
  { t: 'GUIAS', a: 'guia' },
  { t: 'INIMIGO', a: 'inimigo' },
  { t: 'ESPIRITO SANTO', a: 'espirito santo' },
  { t: 'INVISÍVEIS', a: 'invisivel' },
  { t: 'MARCADOR', a: 'marcador' },
  { t: 'PASTOR INVISÍVEL', a: 'pastor invisivel' }
];
export const AREAS_TRILHA = SECOES_TRILHA.map((s) => s.a);

const COR = {
  ROXO: { bg: '7030A0', fg: 'FFFFFF', faixa: '800080' },
  VERMELHO: { bg: 'FF0000', fg: 'FFFFFF' },
  AMARELO: { bg: 'FFFF00', fg: '000000' },
  VERDE: { bg: '92D050', fg: '000000' },
  AZUL: { bg: '00B0F0', fg: '000000' }
};
const TITULO = 'EQUIPE DE TRILHA - GRUPOS DA 37ª EDIÇÃO';
const TITULO_FUNDO = '92D050';
const LARGURAS = [44.89, 47.44, 50.89, 9.66]; // A..D, em caracteres (como na planilha)

const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const comparar = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
const nomeDoArquivo = (ext) => `Equipe_de_Trilha_${new Date().toISOString().slice(0, 10)}.${ext}`;
const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * linhas: de montarLinhasRelacao. Devolve [{ cor, secoes: [{ titulo, nomes }] }]
 * na ordem da planilha. Quem está sem cor entra no fim da própria faixa do
 * último grupo (Azul).
 */
export const montarEquipeTrilha = (linhas) => {
  const trilha = linhas.filter((l) => AREAS_TRILHA.includes(sem(l.areaBase)));
  if (trilha.length === 0) throw new Error('Ninguém escalado na equipe de trilha.');
  const cores = Object.keys(COR);
  const corDe = (l) => (sem(l.corBruta) && sem(l.corBruta) !== 'sem' ? sem(l.corBruta).toUpperCase() : '');
  const nomes = (area, cor) => trilha
    .filter((l) => sem(l.areaBase) === area && corDe(l) === cor)
    .sort((a, b) => comparar(a.nome, b.nome))
    .map((l) => l.nome);
  return cores.map((cor, i) => ({
    cor,
    secoes: SECOES_TRILHA.map((s) => ({
      titulo: s.t,
      nomes: [...nomes(s.a, cor), ...(i === cores.length - 1 ? nomes(s.a, '') : [])]
    })).filter((s) => s.nomes.length > 0)
  })).filter((g) => g.secoes.length > 0);
};

const totalDe = (grupos) => grupos.reduce((n, g) => n + g.secoes.reduce((m, s) => m + s.nomes.length, 0), 0);

// Sequência de linhas da planilha: { tipo: 'titulo' | 'grupo' | 'faixa' | 'nome' | 'vazia', ... }
const sequencia = (grupos) => {
  const out = [{ tipo: 'titulo' }];
  grupos.forEach((g, i) => {
    if (i > 0) out.push({ tipo: 'vazia' }, { tipo: 'vazia' });
    out.push({ tipo: 'grupo', texto: `GRUPO ${g.cor}`, cor: COR[g.cor] }, { tipo: 'vazia' });
    g.secoes.forEach((s) => {
      out.push({ tipo: 'faixa', texto: s.titulo, cor: { ...COR[g.cor], bg: COR[g.cor].faixa || COR[g.cor].bg } });
      s.nomes.forEach((n) => out.push({ tipo: 'nome', texto: n }));
    });
  });
  return out;
};

// ------------------------------------------------------------------ Excel

export const exportarTrilhaExcel = async (grupos) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metanoia Radical Serra';
  const ws = wb.addWorksheet('GRUPOS TRILHA', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  ws.columns = LARGURAS.map((width) => ({ width }));

  const fino = { style: 'thin', color: { argb: 'FF000000' } };
  const bordas = { top: fino, left: fino, bottom: fino, right: fino };
  const preencher = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } });

  sequencia(grupos).forEach((it, idx) => {
    const r = idx + 1;
    const row = ws.getRow(r);
    row.height = 12.75;
    const fundo = it.tipo === 'titulo' ? { bg: TITULO_FUNDO, fg: '000000' } : it.cor;
    [1, 2, 3, 4].forEach((c) => {
      const cell = row.getCell(c);
      cell.border = bordas;
      cell.font = { name: 'Arial', size: 11, bold: it.tipo !== 'nome' && it.tipo !== 'vazia', color: { argb: `FF${fundo ? fundo.fg : '000000'}` } };
      cell.alignment = { horizontal: it.tipo === 'nome' ? 'left' : 'center', vertical: 'bottom' };
      if (fundo) cell.fill = preencher(fundo.bg);
    });
    if (it.tipo === 'titulo') row.getCell(1).value = TITULO;
    else if (it.texto) row.getCell(1).value = it.texto;
    if (['titulo', 'grupo', 'faixa'].includes(it.tipo)) ws.mergeCells(r, 1, r, 4);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo('xlsx');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return totalDe(grupos);
};

// ------------------------------------------------------------------ PDF

export const exportarTrilhaPdf = async (grupos) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const margem = 30;
  const soma = LARGURAS.reduce((a, b) => a + b, 0);
  const larguras = LARGURAS.map((w) => ((doc.internal.pageSize.getWidth() - 2 * margem) * w) / soma);
  const largura = larguras.reduce((a, b) => a + b, 0);
  const limite = doc.internal.pageSize.getHeight() - margem;
  const RH = 14;
  let y = margem;

  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);

  sequencia(grupos).forEach((it) => {
    if (y + RH > limite) { doc.addPage(); y = margem; }
    const fundo = it.tipo === 'titulo' ? { bg: TITULO_FUNDO, fg: '000000' } : it.cor;
    const larga = ['titulo', 'grupo', 'faixa'].includes(it.tipo);
    doc.setFillColor(...rgb(fundo ? fundo.bg : 'FFFFFF'));
    if (larga) {
      doc.rect(margem, y, largura, RH, 'FD');
    } else {
      let x = margem;
      larguras.forEach((w) => { doc.rect(x, y, w, RH, 'FD'); x += w; });
    }
    const texto = it.tipo === 'titulo' ? TITULO : it.texto;
    if (texto) {
      doc.setFont('helvetica', it.tipo === 'nome' ? 'normal' : 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...rgb(fundo ? fundo.fg : '000000'));
      if (larga) doc.text(texto, margem + largura / 2, y + RH * 0.72, { align: 'center' });
      else doc.text(texto, margem + 3, y + RH * 0.72);
    }
    y += RH;
  });

  doc.save(nomeDoArquivo('pdf'));
  return totalDe(grupos);
};
