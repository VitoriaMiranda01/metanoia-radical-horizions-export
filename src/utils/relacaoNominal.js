import { nomeDaIgreja } from '@/constants/igrejas';

/**
 * RELAÇÃO NOMINAL da escala (17/10/2026, Patrick): o mesmo modelo da planilha
 * "Preliminar 23082026.xlsx - NOMINAL" -- NOME | IGREJA | ÁREA, Calibri, a
 * faixa verde do título, bordas finas pretas -- em PDF e em Excel, de tres
 * jeitos:
 *   geral  -- todo mundo em ordem alfabetica;
 *   igreja -- uma faixa verde por igreja, as pessoas em ordem alfabetica;
 *   area   -- uma faixa verde por area, as pessoas em ordem alfabetica.
 *
 * Uma linha por AREA (quem esta em duas areas aparece duas vezes). A coluna
 * A coluna Area traz o nome da area e, se a pessoa tem cor, a cor (Guia azul).
 * Quem ficou em "Não será escalado" nao entra.
 *
 * Medidas tiradas do PDF modelo (pagina Carta): tabela a 9,5 pt da esquerda e
 * 36,85 pt do topo; colunas de 198,75 / 213 / 162 pt; faixa de 17,25 pt; linha
 * de 14,25 pt; Calibri 10,7 pt (titulo 13,65 pt negrito); verde #9BBB59.
 * O PDF usa a Carlito (public/fonts, licenca OFL), que tem as mesmas medidas
 * da Calibri; o Excel usa a propria Calibri.
 *
 * As bibliotecas (jspdf, exceljs) so carregam quando alguem exporta.
 */

export const MODOS_RELACAO = {
  // 22/10/2026 (Patrick): a ESCALA OFICIAL no modelo da planilha "Escala 36ª
  // EDIÇÃO OFICIAL" (ver escalaOficial.js) e a antiga "Escala geral" virou
  // "Escala nominal".
  oficial: { rotulo: 'Escala oficial', titulo: 'ESCALA OFICIAL', arquivo: 'Oficial' },
  geral: { rotulo: 'Escala nominal', titulo: 'RELAÇÃO NOMINAL', arquivo: 'Nominal' },
  igreja: { rotulo: 'Por igreja', titulo: 'RELAÇÃO NOMINAL POR IGREJA', arquivo: 'Por_igreja' },
  area: { rotulo: 'Por área', titulo: 'RELAÇÃO NOMINAL POR ÁREA', arquivo: 'Por_area' }
};

const VERDE = '9BBB59';
const MAIUSC = (t) => String(t || '').toLocaleUpperCase('pt-BR');
const compararTexto = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });

// "64 - METODISTA CENTENÁRIO" -> "METODISTA CENTENÁRIO"; OUTRA -> o que digitaram.
const igrejaDaRelacao = (eq) => {
  const n = String(nomeDaIgreja(eq) || '').trim();
  if (/^OUTRA\b/i.test(n)) {
    const digitada = String(eq?.igreja_outra || '').trim();
    return digitada;
  }
  return n.replace(/^\d+\s*-\s*/, '').trim();
};

/**
 * Colunas EXTRAS que o organizador pode marcar ao exportar (27/10/2026,
 * Patrick): vão depois das colunas do modelo. `pt`: largura no PDF (pontos);
 * `ch`: largura no Excel (caracteres). Só equipantes, só organizador (a tela de
 * escalas já é só dele).
 */
export const COLUNAS_EXTRAS = [
  { id: 'whatsapp', rotulo: 'WHATSAPP', pt: 85, ch: 17 },
  { id: 'idade', rotulo: 'IDADE', pt: 35, ch: 8 },
  { id: 'nascimento', rotulo: 'NASCIMENTO', pt: 62, ch: 13 },
  { id: 'atuacao', rotulo: 'ATUAÇÃO', pt: 90, ch: 22 },
  { id: 'cor', rotulo: 'COR', pt: 50, ch: 11 }
];
export const valorExtra = (linha, coluna) => String(linha?.extras?.[coluna.id] ?? '');

const dadosExtras = (a, atuacoesPorArea) => {
  const lista = atuacoesPorArea?.[a.allocatedArea] || [];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(a.data_nascimento || ''));
  let idade = a.idade ?? '';
  if (m) {
    const hoje = new Date();
    idade = hoje.getFullYear() - Number(m[1])
      - ((hoje.getMonth() + 1 < Number(m[2]) || (hoje.getMonth() + 1 === Number(m[2]) && hoje.getDate() < Number(m[3]))) ? 1 : 0);
  }
  const cor = a.cor && String(a.cor).toLocaleLowerCase('pt-BR') !== 'sem' ? String(a.cor) : '';
  return {
    whatsapp: a.whatsapp || '',
    idade: idade === '' || idade == null ? '' : String(idade),
    nascimento: m ? `${m[3]}/${m[2]}/${m[1]}` : '',
    atuacao: a.atuacao || lista.find((x) => x.ehPadrao)?.atuacao || '',
    cor: cor ? cor.charAt(0).toLocaleUpperCase('pt-BR') + cor.slice(1).toLocaleLowerCase('pt-BR') : ''
  };
};

/**
 * allocations: as linhas da tela de escalas ({ nome, igreja, igreja_outra,
 * allocatedArea }).
 */
export const montarLinhasRelacao = (allocations, atuacoesPorArea = {}) => (allocations || [])
  .filter((a) => a.allocatedArea && a.allocatedArea !== 'Não será escalado')
  .map((a) => {
    // Area + cor (19/10/2026, Patrick, voltando atras do pedido de 17/10):
    // "Guia azul", "Invisível vermelho"... para quem tem cor. Area sem cor
    // (ou atuacao que nao usa cor) fica so com o nome. O agrupamento "por
    // area" continua pelo nome da area, sem a cor.
    return {
      nome: MAIUSC(String(a.nome || '').replace(/\s+/g, ' ').trim()),
      igreja: MAIUSC(igrejaDaRelacao(a)),
      area: a.cor ? `${a.allocatedArea} ${String(a.cor).toLocaleLowerCase('pt-BR')}` : a.allocatedArea,
      areaBase: a.allocatedArea,
      // usados pela escala oficial (escalaOficial.js)
      id: a.id,
      atuacaoBruta: a.atuacao || null,
      corBruta: a.cor || null,
      extras: dadosExtras(a, atuacoesPorArea)
    };
  })
  .sort((x, y) => compararTexto(x.nome, y.nome) || compararTexto(x.area, y.area));

export const agruparRelacao = (linhas, modo) => {
  if (modo === 'geral') return [{ titulo: null, linhas }];
  const chave = modo === 'igreja' ? (l) => l.igreja || 'SEM IGREJA' : (l) => MAIUSC(l.areaBase);
  const grupos = new Map();
  linhas.forEach((l) => {
    const k = chave(l);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === 'SEM IGREJA') - (b === 'SEM IGREJA') || compararTexto(a, b))
    .map(([titulo, ls]) => ({ titulo, linhas: ls }));
};

const nomeDoArquivo = (modo, ext) =>
  `Relacao_Nominal_${MODOS_RELACAO[modo].arquivo}_${new Date().toISOString().slice(0, 10)}.${ext}`;

// ------------------------------------------------------------------ PDF

const PT = {
  x0: 9.505, y0: 36.85,
  colunas: [198.75, 213, 162],
  faixa: 17.25, linha: 14.25,
  baseFaixa: 13.24, baseLinha: 11.2,
  recuo: 2.6,
  fonte: 10.725, fonteTitulo: 13.65, fonteGrupo: 11.5, fonteMinima: 8.5,
  limite: 36.85 + 954 * 0.75
};

const paraBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

export const carregarFonte = async (doc) => {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const [reg, neg] = await Promise.all(['Carlito-Regular.ttf', 'Carlito-Bold.ttf'].map(async (f) => {
      const r = await fetch(`${base}fonts/${f}`);
      if (!r.ok) throw new Error(f);
      return paraBase64(await r.arrayBuffer());
    }));
    doc.addFileToVFS('Carlito-Regular.ttf', reg);
    doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
    doc.addFileToVFS('Carlito-Bold.ttf', neg);
    doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
    return 'Carlito';
  } catch (e) {
    console.warn('relacaoNominal: fonte Carlito indisponivel, usando Helvetica', e);
    return 'helvetica';
  }
};

export const exportarRelacaoPdf = async (grupos, modo, extras = []) => {
  if (modo === 'oficial') return (await import('./escalaOficial')).exportarOficialPdf(grupos, extras);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: extras.length ? 'landscape' : 'portrait' });
  const fonte = await carregarFonte(doc);
  // Com colunas extras a folha vira paisagem e as colunas encolhem para caber.
  const pesos = [...PT.colunas, ...extras.map((c) => c.pt)];
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const fator = extras.length ? Math.min(1, (doc.internal.pageSize.getWidth() - 2 * PT.x0) / somaPesos) : 1;
  const colunas = pesos.map((w) => w * fator);
  const limite = extras.length ? doc.internal.pageSize.getHeight() - PT.y0 : PT.limite;
  const largura = colunas.reduce((a, b) => a + b, 0);
  const xs = colunas.reduce((acc, w, i) => [...acc, acc[i] + w], [PT.x0]);
  let y = PT.y0;
  let inicioPagina = PT.y0;

  doc.setLineWidth(0.75);
  doc.setDrawColor(0, 0, 0);

  const textoQueCabe = (texto, max, tamanho) => {
    let t = tamanho;
    doc.setFontSize(t);
    while (doc.getTextWidth(texto) > max && t > PT.fonteMinima) {
      t -= 0.25;
      doc.setFontSize(t);
    }
    let s = texto;
    while (s.length > 1 && doc.getTextWidth(s) > max) s = s.slice(0, -1);
    return s;
  };

  const fecharPagina = () => {
    // linhas verticais da parte de dados desta pagina
    if (y > inicioPagina) {
      xs.forEach((x) => doc.line(x, inicioPagina, x, y));
    }
  };

  const novaPagina = () => {
    fecharPagina();
    doc.addPage();
    y = PT.y0;
    inicioPagina = PT.y0;
    if (extras.length) cabecalho();
  };

  const faixa = (texto, tamanho) => {
    if (y + PT.faixa > limite) novaPagina();
    fecharPagina();
    doc.setFillColor(0x9b, 0xbb, 0x59);
    doc.rect(PT.x0, y, largura, PT.faixa, 'F');
    doc.rect(PT.x0, y, largura, PT.faixa, 'S');
    doc.setFont(fonte, 'bold');
    const t = textoQueCabe(texto, largura - 2 * PT.recuo, tamanho);
    doc.text(t, PT.x0 + largura / 2, y + PT.baseFaixa, { align: 'center' });
    y += PT.faixa;
    inicioPagina = y;
  };

  const desenhar = (valores, estilo) => {
    if (y + PT.linha > limite) novaPagina();
    doc.line(PT.x0, y, PT.x0 + largura, y);
    doc.line(PT.x0, y + PT.linha, PT.x0 + largura, y + PT.linha);
    doc.setFont(fonte, estilo);
    valores.forEach((valor, i) => {
      const t = textoQueCabe(String(valor || ''), colunas[i] - 2 * PT.recuo, PT.fonte);
      doc.text(t, xs[i] + PT.recuo, y + PT.baseLinha);
    });
    y += PT.linha;
  };
  const linha = (l) => desenhar([l.nome, l.igreja, l.area, ...extras.map((c) => valorExtra(l, c))], 'normal');
  // Com colunas extras, uma linha de rotulos no topo de cada pagina.
  function cabecalho() {
    desenhar(['NOME', 'IGREJA', 'ÁREA', ...extras.map((c) => c.rotulo)], 'bold');
  }

  faixa(MODOS_RELACAO[modo].titulo, PT.fonteTitulo);
  if (extras.length) cabecalho();
  grupos.forEach((g) => {
    if (g.titulo) {
      // a faixa do grupo nao fica sozinha no pe da pagina
      if (y + PT.faixa + PT.linha > limite) novaPagina();
      faixa(`${g.titulo} (${g.linhas.length})`, PT.fonteGrupo);
    }
    g.linhas.forEach(linha);
  });
  fecharPagina();

  doc.save(nomeDoArquivo(modo, 'pdf'));
  return grupos.reduce((n, g) => n + g.linhas.length, 0);
};

// ------------------------------------------------------------------ Excel

export const exportarRelacaoExcel = async (grupos, modo, extras = []) => {
  if (modo === 'oficial') return (await import('./escalaOficial')).exportarOficialExcel(grupos, extras);
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metanoia Radical Serra';
  const ncol = 3 + extras.length;
  const indices = Array.from({ length: ncol }, (_, i) => i + 1);
  const ws = wb.addWorksheet('NOMINAL', {
    pageSetup: {
      paperSize: 1, orientation: extras.length ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.13, right: 0.4, top: 0.51, bottom: 0.4, header: 0.2, footer: 0.2 }
    },
    views: [{ showGridLines: false }]
  });
  ws.columns = [{ width: 37.3 }, { width: 40 }, { width: 30.3 }, ...extras.map((c) => ({ width: c.ch }))];

  const fino = { style: 'thin', color: { argb: 'FF000000' } };
  const bordas = { top: fino, left: fino, bottom: fino, right: fino };
  const fonteDados = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };

  const faixa = (texto, tamanho) => {
    const row = ws.addRow([texto, ...Array(ncol - 1).fill('')]);
    row.height = 17.25;
    // estilo nas celulas ANTES de mesclar (senao a borda some nas outras)
    indices.forEach((i) => {
      const c = row.getCell(i);
      c.font = { name: 'Calibri', size: tamanho, bold: true, color: { argb: 'FF000000' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${VERDE}` } };
      c.border = bordas;
    });
    ws.mergeCells(row.number, 1, row.number, ncol);
  };

  faixa(MODOS_RELACAO[modo].titulo, 14);
  if (extras.length) {
    const cab = ws.addRow(['NOME', 'IGREJA', 'ÁREA', ...extras.map((c) => c.rotulo)]);
    cab.height = 14.25;
    indices.forEach((i) => {
      cab.getCell(i).font = { ...fonteDados, bold: true };
      cab.getCell(i).border = bordas;
      cab.getCell(i).alignment = { vertical: 'bottom', shrinkToFit: true };
    });
  }
  grupos.forEach((g) => {
    if (g.titulo) faixa(`${g.titulo} (${g.linhas.length})`, 12);
    g.linhas.forEach((l) => {
      const row = ws.addRow([l.nome, l.igreja, l.area, ...extras.map((c) => valorExtra(l, c))]);
      row.height = 14.25;
      indices.forEach((i) => {
        const c = row.getCell(i);
        c.font = fonteDados;
        c.border = bordas;
        c.alignment = { vertical: 'bottom', shrinkToFit: true };
      });
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo(modo, 'xlsx');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return grupos.reduce((n, g) => n + g.linhas.length, 0);
};
