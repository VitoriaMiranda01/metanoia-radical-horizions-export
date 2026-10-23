/**
 * EQUIPE DE TRILHA - GRUPOS (23/10/2026, Patrick): reproduz a planilha "Equipe
 * de trilha 37" com os escalados. Sai pelo "Por área" quando alguma área da
 * equipe de trilha é marcada.
 *
 * Como a planilha é (a coluna A dela fica escondida; o que aparece é B, C, D):
 *  - Faixa do título em verde 70AD47; logo abaixo, um bloco por cor na ordem
 *    Roxo, Vermelho, Amarelo, Verde, Azul: faixa "GRUPO X", uma linha em branco
 *    e as faixas GUIAS, INIMIGO, ESPIRITO SANTO, INVISÍVEIS, MARCADOR e PASTOR
 *    INVISÍVEL. Cada faixa aparece mesmo vazia (uma linha em branco; a do
 *    Pastor Invisível sempre tem pelo menos 4 linhas).
 *  - Linha: NOME | IGREJA | coluna estreita vazia, Arial 10.
 *  - O líder da Guia e o líder da Invisível de cada cor vêm primeiro, com a
 *    linha inteira pintada (Calibri 11 negrito). Os demais em ordem alfabética.
 *  - Quem está sem cor vai para o fim da própria faixa, no último grupo (Azul).
 * As bibliotecas (jspdf, exceljs) só carregam ao exportar.
 */

// Áreas da equipe de trilha, na ordem da planilha. `a`: nome da área sem acento.
export const SECOES_TRILHA = [
  { t: 'GUIAS', a: 'guia' },
  { t: 'INIMIGO', a: 'inimigo' },
  { t: 'ESPIRITO SANTO', a: 'espirito santo' },
  { t: 'INVISÍVEIS', a: 'invisivel', min: 1 },
  { t: 'MARCADOR', a: 'marcador' },
  { t: 'PASTOR INVISÍVEL', a: 'pastor invisivel', min: 4 }
];
export const AREAS_TRILHA = SECOES_TRILHA.map((s) => s.a);

const BRANCO = 'FFFFFF';
const PRETO = '000000';
// grupo/faixa: cor das faixas; guia/invisivel: linha pintada do líder.
const CORES = {
  ROXO: { faixa: { bg: '800080', fg: BRANCO }, grupo: { bg: '7030A0', fg: BRANCO }, guia: { bg: '7030A0', fg: BRANCO }, invisivel: { bg: '7030A0', fg: BRANCO } },
  VERMELHO: { faixa: { bg: 'FF0000', fg: BRANCO }, grupo: { bg: 'FF0000', fg: BRANCO }, guia: { bg: 'FF0000', fg: BRANCO }, invisivel: { bg: 'FF0000', fg: BRANCO } },
  AMARELO: { faixa: { bg: 'FFFF00', fg: PRETO }, grupo: { bg: 'FFFF00', fg: PRETO }, guia: { bg: 'FFFF00', fg: PRETO }, invisivel: { bg: 'FFFF00', fg: PRETO } },
  VERDE: { faixa: { bg: '70AD47', fg: PRETO }, grupo: { bg: '70AD47', fg: PRETO }, guia: { bg: '92D050', fg: PRETO }, invisivel: { bg: '00B050', fg: PRETO } },
  AZUL: { faixa: { bg: '4472C4', fg: BRANCO }, grupo: { bg: '4472C4', fg: BRANCO }, guia: { bg: '00B0F0', fg: PRETO }, invisivel: { bg: '4472C4', fg: BRANCO } }
};
const TITULO = 'EQUIPE DE TRILHA - GRUPOS DA 37ª EDIÇÃO';
const TITULO_COR = { bg: '70AD47', fg: PRETO };
const LARGURAS = [44.89, 47.44, 50.89, 9.66]; // A (escondida), B, C, D -- em caracteres
const ALTURA = 12.75;
const ALTURA_LIDER = 13.5;

const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const comparar = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
const nomeDoArquivo = (ext) => `Equipe_de_Trilha_${new Date().toISOString().slice(0, 10)}.${ext}`;
const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const ehAreaDaTrilha = (area) => AREAS_TRILHA.includes(sem(area));

/**
 * linhas: de montarLinhasRelacao (só as das áreas da trilha que entram);
 * atuacoesPorArea: catálogo da tela de escalas (para saber quem é líder).
 * Devolve a lista de linhas da planilha:
 *   { tipo: 'titulo' | 'grupo' | 'faixa', texto, cor }
 *   { tipo: 'pessoa', nome, igreja, cor? (linha pintada) }
 *   { tipo: 'vazia' }
 */
export const montarEquipeTrilha = (linhas, atuacoesPorArea = {}) => {
  const trilha = linhas.filter((l) => ehAreaDaTrilha(l.areaBase));
  if (trilha.length === 0) throw new Error('Ninguém escalado na equipe de trilha.');
  const areas = new Set(trilha.map((l) => sem(l.areaBase)));
  const secoes = SECOES_TRILHA.filter((s) => areas.has(s.a));
  const cores = Object.keys(CORES);

  const corDe = (l) => {
    const c = sem(l.corBruta).toUpperCase();
    return CORES[c] ? c : '';
  };
  const ehLider = (l) => {
    const lista = atuacoesPorArea[l.areaBase] || [];
    const base = l.atuacaoBruta || lista.find((x) => x.ehPadrao)?.atuacao || '';
    return !!lista.find((x) => x.atuacao === base)?.ehLider;
  };
  const ordenar = (a, b) => (Number(b.lider) - Number(a.lider)) || comparar(a.nome, b.nome);

  const out = [{ tipo: 'titulo', texto: TITULO, cor: TITULO_COR }];
  cores.forEach((cor, i) => {
    const paleta = CORES[cor];
    out.push({ tipo: 'grupo', texto: `GRUPO ${cor}`, cor: paleta.grupo }, { tipo: 'vazia' });
    secoes.forEach((s) => {
      out.push({ tipo: 'faixa', texto: s.t, cor: paleta.faixa });
      const daCor = trilha.filter((l) => sem(l.areaBase) === s.a && corDe(l) === cor)
        .map((l) => ({ ...l, lider: ehLider(l) })).sort(ordenar);
      const semCor = i === cores.length - 1
        ? trilha.filter((l) => sem(l.areaBase) === s.a && !corDe(l)).sort((a, b) => comparar(a.nome, b.nome))
        : [];
      const pessoas = [
        ...daCor.map((l) => ({
          tipo: 'pessoa', nome: l.nome, igreja: l.igreja,
          cor: l.lider && (s.a === 'guia' || s.a === 'invisivel') ? paleta[s.a] : null
        })),
        ...semCor.map((l) => ({ tipo: 'pessoa', nome: l.nome, igreja: l.igreja, cor: null }))
      ];
      out.push(...pessoas);
      for (let n = pessoas.length; n < (s.min || 1); n += 1) out.push({ tipo: 'vazia' });
    });
  });
  return out;
};

const totalDe = (itens) => itens.filter((i) => i.tipo === 'pessoa').length;
const ehFaixa = (it) => it.tipo === 'titulo' || it.tipo === 'grupo' || it.tipo === 'faixa';

// ------------------------------------------------------------------ Excel

export const exportarTrilhaExcel = async (itens) => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metanoia Radical Serra';
  const ws = wb.addWorksheet('GRUPOS TRILHA', {
    // sem tamanho de papel, como a original (o Excel usa o padrão)
    pageSetup: {
      orientation: 'landscape',
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0, footer: 0 }
    },
    views: [{ topLeftCell: 'B1' }]
  });
  ws.columns = LARGURAS.map((width, i) => ({ width, hidden: i === 0 }));

  const fino = { style: 'thin', color: { argb: 'FF000000' } };
  const bordas = { top: fino, left: fino, bottom: fino, right: fino };
  const preencher = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } });
  const fonte = (nome, tamanho, cor, negrito) => ({ name: nome, size: tamanho, bold: negrito, color: { argb: `FF${cor}` } });

  itens.forEach((it, idx) => {
    const r = idx + 1;
    const row = ws.getRow(r);
    row.height = it.tipo === 'pessoa' && it.cor ? ALTURA_LIDER : ALTURA;
    if (ehFaixa(it)) {
      // a faixa vai de A a D (A escondida), como na planilha
      row.getCell(1).value = it.texto;
      [1, 2, 3, 4].forEach((c) => {
        const cell = row.getCell(c);
        cell.font = fonte('Arial', 11, it.cor.fg, true);
        cell.alignment = { horizontal: 'center' };
        cell.fill = preencher(it.cor.bg);
        cell.border = bordas;
      });
      ws.mergeCells(r, 1, r, 4);
      return;
    }
    if (it.tipo === 'pessoa') {
      row.getCell(2).value = it.nome;
      row.getCell(3).value = it.igreja || null;
    }
    [2, 3, 4].forEach((c) => {
      const cell = row.getCell(c);
      cell.font = it.cor ? fonte('Calibri', 11, it.cor.fg, true) : fonte('Arial', 10, PRETO, false);
      cell.alignment = { horizontal: 'left' };
      cell.fill = preencher(it.cor ? it.cor.bg : BRANCO);
      cell.border = bordas;
    });
  });

  // A fonte padrão da planilha é Arial 10 (o exceljs grava Calibri 11). O Excel
  // mede a largura das colunas pela fonte padrão, então sem isso a tabela
  // impressa sai ~7 % mais larga que a original. jszip vem com o exceljs.
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  const estilos = await zip.file('xl/styles.xml').async('string');
  zip.file('xl/styles.xml', estilos.replace(/<font>[\s\S]*?<\/font>/,
    '<font><sz val="10"/><color rgb="FF000000"/><name val="Arial"/><family val="2"/></font>'));
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo('xlsx');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return totalDe(itens);
};

// ------------------------------------------------------------------ PDF

// Medidas tiradas do PDF que o próprio Excel gera da planilha original (página
// Carta encaixada no A4 paisagem): colunas em x = 91 / 340 / 606 / 657 pt,
// topo em 54 pt, linhas de 11,75 pt e fontes reduzidas na mesma proporção.
const PDF = { x0: 91, larguras: [249, 266, 51], topo: 54, rodape: 54, k: 0.948, kAltura: 11.75 / 12.75 };

export const exportarTrilhaPdf = async (itens) => {
  const { jsPDF } = await import('jspdf');
  const { carregarFonte } = await import('./relacaoNominal');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const calibri = await carregarFonte(doc);
  const { larguras, x0, topo, k } = PDF;
  const largura = larguras.reduce((a, b) => a + b, 0);
  const limite = doc.internal.pageSize.getHeight() - PDF.rodape;
  let y = topo;

  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);

  const escrever = (texto, x, w, h, { fonte, estilo, tamanho, cor, centro }) => {
    doc.setFont(fonte, estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...rgb(cor));
    let s = String(texto);
    while (s.length > 1 && doc.getTextWidth(s) > w - 4) s = s.slice(0, -1);
    const base = y + h - 2.6;
    if (centro) doc.text(s, x + w / 2, base, { align: 'center' });
    else doc.text(s, x + 2, base);
  };

  itens.forEach((it) => {
    const h = (it.tipo === 'pessoa' && it.cor ? ALTURA_LIDER : ALTURA) * PDF.kAltura;
    // faixa não fica sozinha no pé da página: desce junto com a primeira linha
    if (y + h * (ehFaixa(it) ? 2 : 1) > limite) { doc.addPage(); y = topo; }
    if (ehFaixa(it)) {
      doc.setFillColor(...rgb(it.cor.bg));
      doc.rect(x0, y, largura, h, 'FD');
      escrever(it.texto, x0, largura, h, { fonte: 'helvetica', estilo: 'bold', tamanho: 11 * k, cor: it.cor.fg, centro: true });
    } else {
      let x = x0;
      larguras.forEach((w, c) => {
        doc.setFillColor(...rgb(it.cor ? it.cor.bg : BRANCO));
        doc.rect(x, y, w, h, 'FD');
        const texto = it.tipo === 'pessoa' ? [it.nome, it.igreja, ''][c] : '';
        if (texto) {
          escrever(texto, x, w, h, it.cor
            ? { fonte: calibri, estilo: 'bold', tamanho: 11 * k, cor: it.cor.fg }
            : { fonte: 'helvetica', estilo: 'normal', tamanho: 10 * k, cor: PRETO });
        }
        x += w;
      });
    }
    y += h;
  });

  doc.save(nomeDoArquivo('pdf'));
  return totalDe(itens);
};
