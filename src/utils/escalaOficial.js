import { carregarFonte } from './relacaoNominal';

/**
 * ESCALA OFICIAL (22/10/2026, Patrick): reproduz a planilha "Escala 36ª EDIÇÃO
 * OFICIAL.xlsx" -- paisagem A4, impressa a 78 %, rodapé com o número da
 * página, logo + título no topo e, para cada área, uma faixa com o nome, a
 * linha verde NOME | IGREJA | ATUAÇÃO e as pessoas numeradas (número em
 * verde). Nome e igreja em Calibri 11; número, atuação e títulos em Arial 11
 * negrito.
 *
 * O que as cores da planilha significam (tudo tem um motivo):
 *  - ATUAÇÃO pintada com a cor do grupo (Vermelho FF0000, Roxo 7030A0, Verde
 *    92D050, Azul 00B0F0, Amarelo FFFF00) nas áreas divididas por cor. Na
 *    Invisível só o líder de cada cor é pintado (são ~20 pessoas por cor).
 *  - Linha inteira pintada = o líder da cor: líder de cada cor na Invisível
 *    ("LÍDER / VERDE") e o primeiro de cada cor nos Guias e na Recepção Sítio.
 *  - Fotografia: Líder em verde 00B050 e Drone em laranja F79646.
 *  - Barra = sub-área do bloco de cima (com o nome; na planilha o nome ficou escondido) (Mesa crachá no Estacionamento,
 *    Copa na Cozinha, Contêiner na Cristolândia, Família no Dia do
 *    Arrebatamento): verde, menos a do Contêiner, que é branca.
 *  - Dentro de cada área: líder, atuações especiais (na ordem do catálogo) e a
 *    atuação padrão por último; nas áreas por cor, as cores seguem a ordem que
 *    a planilha usa em cada área. Nomes em ordem alfabética.
 *
 * As bibliotecas (jspdf, exceljs) só carregam ao exportar.
 */

const VERDE = '9BBB59';
const LARGURAS = [3.71, 4.86, 53.86, 50.29, 29.57]; // A..E, em caracteres
const PX_COLUNA = LARGURAS.map((w) => Math.trunc(w * 7 + 5));
const CABECALHO = ['NOME', 'IGREJA', 'ATUAÇÃO'];
const TITULO = 'METANÓIA RADICAL SERRA';
const SUBTITULO = 'ESCALA DE TRABALHO  - 36ª EDIÇÃO';
const ESCALA = 0.78; // zoom de impressão da planilha

const COR = {
  VERMELHO: { bg: 'FF0000', fg: 'FFFFFF' },
  ROXO: { bg: '7030A0', fg: 'FFFFFF' },
  VERDE: { bg: '92D050', fg: '000000' },
  AZUL: { bg: '00B0F0', fg: '000000' },
  AMARELO: { bg: 'FFFF00', fg: '000000' }
};
// Linha de líder da Invisível usa tons mais escuros no verde e no azul.
const COR_LIDER_INVISIVEL = { VERDE: { bg: '00B050', fg: 'FFFFFF' }, AZUL: { bg: '4F81BD', fg: 'FFFFFF' } };
const FOTO_LIDER = { bg: '00B050', fg: '000000' };
const FOTO_DRONE = { bg: 'F79646', fg: '000000' };

const AREAS_COM_COR = ['espirito santo', 'fotografia', 'guia', 'infiltrados', 'inimigo', 'invisivel', 'marcador', 'pastor invisivel', 'recepcao sitio'];
const ORDEM_COR_PADRAO = ['VERMELHO', 'VERDE', 'ROXO', 'AZUL', 'AMARELO'];
const ORDEM_COR = {
  invisivel: ['VERDE', 'AZUL', 'ROXO', 'VERMELHO', 'AMARELO'],
  infiltrados: ['VERDE', 'VERMELHO', 'ROXO', 'AZUL', 'AMARELO'],
  'pastor invisivel': ['VERDE', 'ROXO', 'AZUL', 'AMARELO', 'VERMELHO'],
  inimigo: ['ROXO', 'VERMELHO', 'VERDE', 'AMARELO', 'AZUL'],
  'espirito santo': ['ROXO', 'AZUL', 'AMARELO', 'VERMELHO', 'VERDE'],
  marcador: ['AZUL', 'AMARELO', 'ROXO', 'VERDE', 'VERMELHO'],
  fotografia: ['VERMELHO', 'ROXO', 'VERDE', 'AZUL', 'AMARELO']
};

// Blocos na ordem da planilha. `a`: começo do nome da área (sem acento, minúsculo).
// `sub`: áreas que a planilha põe no fim do bloco, depois de uma barra vazia.
const BLOCOS = [
  { t: 'RECEPÇÃO IGREJA', a: ['recepcao igreja'], semTitulo: true },
  { t: 'COZINHA', a: ['cozinha igreja'] },
  { t: 'SOM/ MULTI MIDIA', a: ['som / multimidia'] },
  { t: 'ESTACIONAMENTO', a: ['estacionamento'], sub: [{ a: ['mesa cracha'], barra: VERDE, nome: 'MESA CRACHÁ' }] },
  { t: 'RECEPÇÃO SÍTIO', a: ['recepcao sitio'] },
  { t: 'APRESENTADORES', a: ['apresentadores'] },
  { t: 'FAMÍLIA MUÇULMANA', a: ['familia mu'] },
  { t: 'SEGURANÇA', a: ['seguranca'] },
  { t: 'COZINHA', a: ['cozinha'], sub: [{ a: ['copa'], barra: VERDE, nome: 'COPA' }] },
  { t: 'LOGÍSTICA', a: ['logistica'] },
  { t: 'INVISÍVEL', a: ['invisivel'] },
  { t: 'FOTOGRAFIA', a: ['fotografia'] },
  { t: 'MARCADOR', a: ['marcador'] },
  { t: 'PRIMEIROS SOCORROS', a: ['primeiros socorros'] },
  { t: 'GUIAS', a: ['guia'] },
  { t: 'INIMIGOS', a: ['inimigo'] },
  { t: 'ESPÍRITO SANTO', a: ['espirito santo'] },
  { t: 'PASTOR INVISÍVEL', a: ['pastor invisivel'] },
  { t: 'INFILTRADOS', a: ['infiltrados'] },
  { t: 'CRISTOLÂNDIA', a: ['cristolandia'], sub: [{ a: ['conteiner'], barra: 'FFFFFF', nome: 'CONTÊINER' }] },
  { t: 'PRESÍDIO', a: ['presidio'] },
  { t: 'FALSA BAIANA', a: ['falsa baiana'] },
  { t: 'CRACOLÂNDIA', a: ['cracolandia'] },
  { t: 'DIA DO ARREBATAMENTO', a: ['dia do arrebatamento'], sub: [{ a: ['familia'], barra: VERDE, nome: 'FAMÍLIA' }] },
  { t: 'HOSPITAL', a: ['hospital'] },
  { t: 'DEPRESSÃO', a: ['depressao'] },
  { t: 'PASTOR ENFORCADO', a: ['pastor enforcado'] },
  { t: 'IGREJA SUBTERRÂNEA', a: ['igreja subterranea'] },
  { t: 'PERSEGUIDOS', a: ['perseguidos'] },
  { t: 'TÚMULO', a: ['tumulo'] },
  { t: 'SELVA', a: ['selva'] },
  { t: 'ATAQUE / MADRUGADA', a: ['ataque'] },
  { t: 'BASE OPERACIONAL', a: ['base operacional'] },
  { t: 'SOM / PROJEÇÃO', a: ['som / projecao'] },
  { t: 'SECRETARIA', a: ['secretaria'] },
  { t: 'EQUIPE DE MANUTENÇÃO', a: ['equipe de manutencao'] },
  { t: 'ORAÇÃO ITINERANTE TRILHA A', a: ['oracao itinerante'], atuacao: 'trilha a' },
  { t: 'ORAÇÃO ITINERANTE TRILHA B', a: ['oracao itinerante'], atuacao: 'trilha b' }
];

const MAIUSC = (t) => String(t || '').toLocaleUpperCase('pt-BR');
const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const comparar = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
const nomeDoArquivo = (ext) => `Escala_Oficial_${new Date().toISOString().slice(0, 10)}.${ext}`;
const totalDe = (itens) => itens.reduce((n, i) => n + (i.linhas ? i.linhas.length : 0), 0);

/**
 * linhas: de montarLinhasRelacao ({ id, nome, igreja, areaBase, atuacaoBruta,
 * corBruta }); atuacoesPorArea: { [area]: [{ atuacao, ehPadrao, ehLider,
 * semCor }] } (catálogo da tela de escalas).
 * Devolve a lista de itens do documento: { tipo: 'bloco', titulo, semTitulo,
 * linhas: [{ nome, igreja, texto, atuacaoBg, atuacaoFg, inteira }] } ou
 * { tipo: 'barra', cor }.
 */
export const montarEscalaOficial = (linhas, atuacoesPorArea = {}) => {
  const catalogo = (area) => atuacoesPorArea[area] || [];
  const detalhe = (l) => {
    const lista = catalogo(l.areaBase);
    const base = l.atuacaoBruta || lista.find((x) => x.ehPadrao)?.atuacao || '';
    const def = lista.find((x) => x.atuacao === base);
    return {
      base,
      padrao: !l.atuacaoBruta || !!def?.ehPadrao,
      lider: !!def?.ehLider,
      semCor: !!def?.semCor,
      ordem: Math.max(lista.findIndex((x) => x.atuacao === base), 0)
    };
  };
  // Líderes da área Guia: a mesma pessoa é pintada também na Recepção Sítio.
  const guiasLideres = new Set(linhas.filter((l) => sem(l.areaBase) === 'guia' && detalhe(l).lider).map((l) => l.id));

  const preparar = (l) => {
    const d = detalhe(l);
    const area = sem(l.areaBase);
    const cor = l.corBruta && l.corBruta !== 'sem' && !d.semCor ? MAIUSC(sem(l.corBruta)) : '';
    let texto = MAIUSC(d.base);
    if (area === 'oracao itinerante') texto = 'ORAÇÃO ITINERANTE';
    else if (cor && area !== 'recepcao sitio') {
      if (d.lider && area === 'invisivel') texto = `LÍDER / ${cor}`;
      else if (d.lider && area === 'guia') texto = cor;
      else texto = d.padrao ? cor : `${texto} / ${cor}`;
    }

    // Área dividida por cor e pessoa sem cor (o líder da área não conta): vai
    // para o fim da área. A atuação vem sempre primeiro: só quem está na
    // atuação padrão mostra "SEM COR"; atuação especial sem cor mostra só a atuação.
    const semCorNoFim = !cor && !d.semCor && !d.lider && AREAS_COM_COR.some((a) => area.startsWith(a));
    if (semCorNoFim && d.padrao) {
      texto = area === 'recepcao sitio' ? `${texto} / SEM COR` : 'SEM COR';
    }

    let atuacaoCor = null;
    if (cor && COR[cor] && area !== 'invisivel') atuacaoCor = COR[cor];
    if (area === 'fotografia' && d.lider && !cor) atuacaoCor = FOTO_LIDER;
    if (area === 'fotografia' && sem(d.base) === 'drone') atuacaoCor = FOTO_DRONE;

    let inteira = null;
    if (cor && COR[cor]) {
      if (area === 'invisivel' && d.lider) inteira = COR_LIDER_INVISIVEL[cor] || COR[cor];
      else if (area === 'guia' && d.lider) inteira = COR[cor];
      else if (area === 'recepcao sitio' && guiasLideres.has(l.id)) inteira = COR[cor];
    }

    const sequencia = ORDEM_COR[Object.keys(ORDEM_COR).find((k) => area.startsWith(k))] || ORDEM_COR_PADRAO;
    let grupo;
    if (cor) grupo = 100 + Math.max(sequencia.indexOf(cor), 0);
    else if (semCorNoFim) grupo = 900;
    else if (d.lider) grupo = 0;
    else if (!d.padrao) grupo = 1;
    else grupo = 50;

    return {
      nome: l.nome, igreja: l.igreja, texto, atuacaoCor, inteira,
      grupo, lider: d.lider || (area === 'recepcao sitio' && guiasLideres.has(l.id)), ordem: d.ordem, atuacaoNorm: sem(d.base), areaNorm: area, areaOriginal: l.areaBase
    };
  };

  const ordenar = (a, b) =>
    a.grupo - b.grupo || (Number(b.lider) - Number(a.lider)) || a.ordem - b.ordem || comparar(a.nome, b.nome);

  const itens = [];
  const usadas = new Set();
  const doBloco = (alvo, preds) => alvo
    .filter((l) => preds(l))
    .sort(ordenar);

  const preparadas = linhas.map(preparar);
  const casa = (l, b) => b.a.some((p) => l.areaNorm.startsWith(p)) && (!b.atuacao || l.atuacaoNorm === b.atuacao);
  const subCasa = (l, s) => s.a.some((p) => l.areaNorm.startsWith(p));

  // Cada linha vai para o primeiro bloco (ou sub-área) que a reconhece.
  const destino = new Map();
  preparadas.forEach((l) => {
    for (let i = 0; i < BLOCOS.length; i += 1) {
      if (casa(l, BLOCOS[i])) { destino.set(l, `b${i}`); return; }
      const j = (BLOCOS[i].sub || []).findIndex((s) => subCasa(l, s));
      if (j >= 0) { destino.set(l, `s${i}.${j}`); return; }
    }
  });

  BLOCOS.forEach((b, i) => {
    const principais = doBloco(preparadas, (l) => destino.get(l) === `b${i}`);
    if (principais.length) {
      itens.push({ tipo: 'bloco', titulo: b.t, semTitulo: !!b.semTitulo, linhas: principais });
      principais.forEach((l) => usadas.add(l));
    }
    (b.sub || []).forEach((s, j) => {
      const subs = doBloco(preparadas, (l) => destino.get(l) === `s${i}.${j}`);
      if (!subs.length) return;
      itens.push({ tipo: 'barra', cor: s.barra, nome: s.nome });
      itens.push({ tipo: 'bloco', titulo: null, semTitulo: true, linhas: subs });
      subs.forEach((l) => usadas.add(l));
    });
  });

  // Áreas que a planilha não conhece: no fim, em ordem alfabética.
  const restantes = new Map();
  preparadas.filter((l) => !usadas.has(l)).forEach((l) => {
    const k = MAIUSC(l.areaOriginal);
    if (!restantes.has(k)) restantes.set(k, []);
    restantes.get(k).push(l);
  });
  [...restantes.entries()].sort(([a], [b]) => comparar(a, b)).forEach(([titulo, ls]) => {
    itens.push({ tipo: 'bloco', titulo, linhas: ls.sort(ordenar) });
  });

  return itens.map((i) => (i.linhas
    ? { ...i, linhas: i.linhas.map((l) => ({
      nome: l.nome, igreja: l.igreja, texto: l.texto, atuacaoCor: l.atuacaoCor, inteira: l.inteira
    })) }
    : i));
};

const carregarLogo = async () => {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const r = await fetch(`${base}images/escala-logo.jpg`);
    if (!r.ok) throw new Error('logo');
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  } catch (e) {
    console.warn('escalaOficial: logo indisponivel', e);
    return null;
  }
};

const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ------------------------------------------------------------------ PDF

export const exportarOficialPdf = async (itens) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const [logo, calibri] = await Promise.all([carregarLogo(), carregarFonte(doc)]);
  const PX = 0.75 * ESCALA; // pt por pixel da planilha
  const RH = 15.75 * ESCALA;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  const topo = 0.98958 * 72;
  const limite = alturaPagina - 0.7874 * 72;
  const xs = PX_COLUNA.reduce((acc, w, i) => [...acc, acc[i] + w * PX], [0.27778 * 72]);
  const fonteDados = 11 * ESCALA;
  let y = topo;

  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);

  const encaixar = (texto, max, tamanho) => {
    let t = tamanho;
    doc.setFontSize(t);
    while (doc.getTextWidth(texto) > max && t > 5.5) { t -= 0.25; doc.setFontSize(t); }
    let s = texto;
    while (s.length > 1 && doc.getTextWidth(s) > max) s = s.slice(0, -1);
    return s;
  };

  // c: índice 1..4 (B..E)
  const celula = (c, texto, { fundo = 'FFFFFF', cor = '000000', negrito = false, fonte = 'arial', centro = false, direita = false } = {}) => {
    const x = xs[c];
    const w = PX_COLUNA[c] * PX;
    doc.setFillColor(...rgb(fundo));
    doc.rect(x, y, w, RH, 'FD');
    if (texto === '' || texto == null) return;
    doc.setFont(fonte === 'calibri' ? calibri : 'helvetica', negrito ? 'bold' : 'normal');
    doc.setTextColor(...rgb(cor));
    const t = encaixar(String(texto), w - 4, fonteDados);
    if (centro) doc.text(t, x + w / 2, y + RH * 0.72, { align: 'center' });
    else if (direita) doc.text(t, x + w - 2, y + RH * 0.72, { align: 'right' });
    else doc.text(t, x + 2, y + RH * 0.72);
    doc.setTextColor(0, 0, 0);
  };
  const larguraTabela = xs[5] - xs[1];

  const novaPagina = () => { doc.addPage(); y = topo; };

  // Cabeçalho (linhas 1 a 8 da planilha): moldura, logo e título.
  doc.setLineWidth(1.1);
  doc.line(xs[1], topo, xs[5], topo);
  doc.line(xs[1], topo, xs[1], topo + 8 * RH);
  doc.setLineWidth(0.5);
  if (logo) {
    doc.addImage(`data:image/jpeg;base64,${logo}`, 'JPEG',
      xs[2] + (160655 / 9525) * PX, topo + RH + (8890 / 9525) * PX, (2787015 / 9525) * PX, (1150620 / 9525) * PX);
  }
  doc.setFont('times', 'bold');
  doc.setFontSize(30 * ESCALA);
  doc.text(TITULO, xs[2] + (3301999 / 9525 + 4951730 / 9525 / 2) * PX,
    topo + RH + (187325 / 9525) * PX + 4.7 * PX + 30 * ESCALA * 0.9, { align: 'center' });
  doc.setFontSize(14 * ESCALA);
  doc.text(SUBTITULO, xs[2] + (3841750 / 9525 + 4053205 / 9525 / 2) * PX,
    topo + 4 * RH + (163419 / 9525) * PX + 4.7 * PX + 14 * ESCALA * 0.9, { align: 'center' });
  y = topo + 8 * RH;

  let faltam = 0; // linhas que o próximo bloco ainda precisa de espaço
  itens.forEach((item) => {
    if (item.tipo === 'barra') {
      if (y + RH > limite) novaPagina();
      doc.setFillColor(...rgb(item.cor));
      doc.rect(xs[1], y, larguraTabela, RH, 'FD');
      if (item.nome) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fonteDados);
        doc.setTextColor(0, 0, 0);
        doc.text(item.nome, xs[1] + larguraTabela / 2, y + RH * 0.72, { align: 'center' });
      }
      y += RH;
      return;
    }
    faltam = (item.titulo && !item.semTitulo ? 1 : 0) + 2;
    if (y + faltam * RH > limite) novaPagina();
    if (item.titulo && !item.semTitulo) {
      doc.setFillColor(255, 255, 255);
      doc.rect(xs[1], y, larguraTabela, RH, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fonteDados);
      doc.text(encaixar(item.titulo, larguraTabela - 4, fonteDados), xs[1] + larguraTabela / 2, y + RH * 0.72, { align: 'center' });
      y += RH;
    }
    celula(1, '', { fundo: VERDE });
    CABECALHO.forEach((t, i) => celula(i + 2, t, { fundo: VERDE, negrito: true, centro: true }));
    y += RH;
    item.linhas.forEach((l, n) => {
      if (y + RH > limite) novaPagina();
      const ci = l.inteira;
      celula(1, n + 1, { fundo: VERDE, negrito: true, direita: true });
      celula(2, l.nome, { fonte: 'calibri', ...(ci ? { fundo: ci.bg, cor: ci.fg, negrito: true } : {}) });
      celula(3, l.igreja, { fonte: 'calibri', ...(ci ? { fundo: ci.bg, cor: ci.fg, negrito: true } : {}) });
      const ac = ci || l.atuacaoCor;
      celula(4, l.texto, { negrito: true, centro: true, ...(ac ? { fundo: ac.bg, cor: ac.fg } : {}) });
      y += RH;
    });
  });

  // Rodapé: número da página à direita (&R&P da planilha).
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    doc.setFont(calibri, 'normal');
    doc.setFontSize(fonteDados);
    doc.setTextColor(0, 0, 0);
    doc.text(String(p), larguraPagina - 0.5118 * 72, alturaPagina - 0.315 * 72, { align: 'right' });
  }

  doc.save(nomeDoArquivo('pdf'));
  return totalDe(itens);
};

// ------------------------------------------------------------------ Excel

export const exportarOficialExcel = async (itens) => {
  const ExcelJS = (await import('exceljs')).default;
  const logo = await carregarLogo();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Metanoia Radical Serra';
  const ws = wb.addWorksheet('ESCALA ATUAL', {
    pageSetup: {
      paperSize: 9, orientation: 'landscape', scale: 78,
      margins: { left: 0.27778, right: 0.511811, top: 0.98958, bottom: 0.787402, header: 0.31496, footer: 0.31496 }
    },
    headerFooter: { oddFooter: '&R&P' },
    views: [{ showGridLines: false, zoomScale: 90 }]
  });
  ws.columns = LARGURAS.map((width) => ({ width }));

  const fino = { style: 'thin', color: { argb: 'FF000000' } };
  const bordas = { top: fino, left: fino, bottom: fino, right: fino };
  const preencher = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } });
  const arial = (extra = {}) => ({ name: 'Arial', size: 11, ...extra });
  const calibri = (extra = {}) => ({ name: 'Calibri', size: 11, ...extra });

  for (let r = 1; r <= 8; r += 1) ws.getRow(r).height = 15.75;
  const medio = { style: 'medium', color: { argb: 'FF000000' } };
  [2, 3, 4, 5].forEach((c) => { ws.getCell(1, c).border = { top: medio, ...(c === 2 ? { left: medio } : {}) }; });
  for (let r = 2; r <= 8; r += 1) ws.getCell(r, 2).border = { left: medio };

  if (logo) {
    const id = wb.addImage({ base64: logo, extension: 'jpeg' });
    ws.addImage(id, { tl: { col: 2 + 160655 / 3638550, row: 1 + 8890 / 200025 }, ext: { width: 292.6, height: 120.8 } });
  }
  // O título e o subtítulo da planilha são caixas de texto; aqui são células
  // mescladas, e os espaços no fim deslocam o centro para onde a caixa ficava.
  ws.mergeCells('D2:E4');
  ws.getCell('D2').value = `${TITULO}${' '.repeat(13)}`;
  ws.getCell('D2').font = { name: 'Cambria', size: 30, bold: true };
  ws.getCell('D2').alignment = { horizontal: 'center', vertical: 'bottom' };
  ws.mergeCells('D5:E6');
  ws.getCell('D5').value = `${SUBTITULO}${' '.repeat(29)}`;
  ws.getCell('D5').font = { name: 'Cambria', size: 14, bold: true };
  ws.getCell('D5').alignment = { horizontal: 'center', vertical: 'bottom' };

  let linha = 9;
  const barra = (hex, nome) => {
    const row = ws.getRow(linha);
    row.getCell(2).value = nome || null;
    [2, 3, 4, 5].forEach((i) => {
      row.getCell(i).fill = preencher(hex);
      row.getCell(i).border = bordas;
      row.getCell(i).font = arial({ bold: true });
      row.getCell(i).alignment = { horizontal: 'center', vertical: 'bottom' };
    });
    ws.mergeCells(linha, 2, linha, 5);
    row.height = 15.75;
    linha += 1;
  };

  itens.forEach((item) => {
    if (item.tipo === 'barra') { barra(item.cor, item.nome); return; }

    if (item.titulo && !item.semTitulo) {
      const faixa = ws.getRow(linha);
      faixa.getCell(2).value = item.titulo;
      [2, 3, 4, 5].forEach((i) => {
        faixa.getCell(i).font = arial({ bold: true });
        faixa.getCell(i).alignment = { horizontal: 'center', vertical: 'bottom' };
        faixa.getCell(i).fill = preencher('FFFFFF');
        faixa.getCell(i).border = bordas;
      });
      ws.mergeCells(linha, 2, linha, 5);
      faixa.height = 15.75;
      linha += 1;
    }

    const cab = ws.getRow(linha);
    CABECALHO.forEach((t, i) => { cab.getCell(i + 3).value = t; });
    [2, 3, 4, 5].forEach((i) => {
      cab.getCell(i).font = arial({ bold: i > 2 });
      cab.getCell(i).alignment = { horizontal: 'center', vertical: 'bottom' };
      cab.getCell(i).fill = preencher(VERDE);
      cab.getCell(i).border = bordas;
    });
    cab.height = 15.75;
    linha += 1;

    item.linhas.forEach((l, n) => {
      const row = ws.getRow(linha);
      row.values = [null, null, n + 1, l.nome, l.igreja, l.texto];
      row.height = 15.75;
      const ci = l.inteira;
      row.getCell(2).fill = preencher(VERDE);
      row.getCell(2).font = arial({ bold: true, color: { argb: 'FF000000' } });
      [3, 4].forEach((i) => {
        row.getCell(i).font = calibri({ color: { argb: ci ? `FF${ci.fg}` : 'FF000000' }, bold: !!ci });
        row.getCell(i).alignment = { horizontal: 'left', vertical: 'bottom' };
        row.getCell(i).fill = preencher(ci ? ci.bg : 'FFFFFF');
      });
      const ac = ci || l.atuacaoCor;
      row.getCell(5).font = arial({ bold: true, color: { argb: ac ? `FF${ac.fg}` : 'FF000000' } });
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'bottom' };
      row.getCell(5).fill = preencher(ac ? ac.bg : 'FFFFFF');
      [2, 3, 4, 5].forEach((i) => { row.getCell(i).border = bordas; });
      linha += 1;
    });
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
  return totalDe(itens);
};
