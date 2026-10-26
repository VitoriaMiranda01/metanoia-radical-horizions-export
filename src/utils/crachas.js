import { GROUPS } from '@/utils/gruposTrailha';

/**
 * Crachas dos acampantes (Patrick, 26/10/2026). Copia fiel do modelo
 * CRACHA.pdf (Word): folha A4 com 8 crachas (2 colunas x 4 linhas), cada um
 * numa celula de corte de 97,2 x 63,3 mm com fio fino; dentro, a moldura preta
 * de 89,7 x 51,7 mm. Nome em Arial Negrito 20 pt (maiusculas, centralizado,
 * quebra em ate 2 linhas), a cor em Arial Negrito 10 pt logo abaixo, e em
 * baixo a logo do Metanoia, o numero (Arial 18 pt) e o escudo.
 *
 * Todas as medidas abaixo foram tiradas do PDF, em pontos (1 pt = 1/72 pol),
 * a partir do canto de cima/esquerda da celula. O cracha sai num PDF com a
 * mesma pagina do modelo (595,32 x 841,92 pt), para imprimir ou mandar para
 * a grafica.
 *
 * Numero: tamanho da camisa (1 PP ... 7 XXG) ou 8 para toda a equipe da
 * trilha que tem cracha (Infiltrados, Espirito Santo e Inimigo, 26/10/2026) --
 * e a unica marca que identifica o infiltrado no cracha.
 */

export const NUMERO_DA_CAMISA = { PP: 1, P: 2, M: 3, G: 4, GG: 5, XG: 6, XXG: 7 };
export const TAMANHOS_CAMISA = Object.keys(NUMERO_DA_CAMISA);
export const NUMERO_INFILTRADO = 8;
// Areas da escala cujos escalados ganham cracha (o banco manda em p.area).
export const AREAS_COM_CRACHA = ['Infiltrados', 'Espírito Santo', 'Inimigo'];
export const ehEquipeDaTrilha = (p) => !!p.infiltrado || AREAS_COM_CRACHA.includes(p.area);
export const POR_FOLHA = 8;

export const camisaNormalizada = (c) => {
  const t = String(c || '').trim().toUpperCase();
  return NUMERO_DA_CAMISA[t] ? t : null;
};

/** Nome como sai no cracha: maiusculas, espacos simples. */
export const nomeDoCracha = (nome) => String(nome || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');

/** O que vai impresso no cracha da pessoa; numero/grupo null = falta dado. */
export const dadosDoCracha = (p) => ({
  nome: nomeDoCracha(p.nome),
  grupo: GROUPS.includes(p.grupo) ? p.grupo : null,
  numero: ehEquipeDaTrilha(p) ? NUMERO_INFILTRADO : (NUMERO_DA_CAMISA[camisaNormalizada(p.camisa)] || null),
});

/**
 * Situacao do cracha: 'pendente' (sem cor ou sem camisa: nao imprime),
 * 'nao_impresso', 'alterado' (nome/cor/numero mudou depois de impresso) ou
 * 'impresso'.
 */
export const situacaoDoCracha = (p) => {
  const c = dadosDoCracha(p);
  if (!c.nome || !c.grupo || !c.numero) return 'pendente';
  const i = p.impresso;
  if (!i) return 'nao_impresso';
  if (i.nome !== c.nome || (i.grupo || null) !== c.grupo || Number(i.numero) !== c.numero) return 'alterado';
  return 'impresso';
};

/** Ordem da impressao (e da tela): cores na ordem fixa e, dentro, por nome. */
export const ordenarCrachas = (lista) => [...lista].sort((a, b) => {
  const ga = GROUPS.indexOf(a.grupo); const gb = GROUPS.indexOf(b.grupo);
  const oa = ga < 0 ? 99 : ga; const ob = gb < 0 ? 99 : gb;
  if (oa !== ob) return oa - ob;
  return nomeDoCracha(a.nome).localeCompare(nomeDoCracha(b.nome), 'pt-BR');
});

// ---- Geometria (pt), medida no CRACHA.pdf -----------------------------------
const FOLHA = { largura: 595.32, altura: 841.92 };
const CELULA = { x: [22.68, 298.08], topo: [7.08, 186.48, 365.76, 545.16], largura: 275.4, altura: 179.4, fio: 0.48 };
// Moldura: 11,04 pt para dentro da celula; topo de cada linha medido a parte.
const MOLDURA = { dx: 11.04, topo: [10.92, 10.8, 10.92, 10.8], largura: 254.28, altura: 146.64, borda: 4.44 };
const NOME = { centro: 138.3, base: 51.84, tamanho: 20.04, entreLinhas: 22.98, larguraMax: 245.4, minimo: 14 };
const COR = { tamanho: 9.96, abaixo: 13.56 };
const NUMERO = { x: 128.52, base: 137.16, tamanho: 18 };
const LOGO = { x: 23.64, y: 113.04, largura: 53.52, altura: 35.16 };
const ESCUDO = { x: 201.84, y: 114.48, largura: 28.56, altura: 34.32 };
const FONTE = "Arial, 'Liberation Sans', Arimo, Helvetica, sans-serif";

export const IMAGEM_LOGO = '/images/cracha-logo.jpg';
export const IMAGEM_ESCUDO = '/images/cracha-escudo.jpg';

let contexto = null;
const larguraTexto = (texto, tamanho) => {
  if (!contexto) contexto = document.createElement('canvas').getContext('2d');
  contexto.font = `bold ${tamanho}px ${FONTE}`;
  // O Word nao aproxima pares de letras ("AY", "VA"); o navegador sim.
  contexto.fontKerning = 'none';
  return contexto.measureText(texto).width;
};

const quebrar = (texto, tamanho) => {
  const linhas = [];
  let atual = '';
  texto.split(' ').forEach((palavra) => {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (!atual || larguraTexto(tentativa, tamanho) <= NOME.larguraMax) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  });
  if (atual) linhas.push(atual);
  return linhas;
};

/**
 * Linhas do nome e tamanho da letra. Como no modelo, 20 pt em ate 2 linhas;
 * so um nome que nao cabe assim (raro) diminui a letra, ate 14 pt.
 */
export const linhasDoNome = (nome) => {
  let tamanho = NOME.tamanho;
  let linhas = quebrar(nome, tamanho);
  const cabe = (ls, t) => ls.length <= 2 && ls.every((l) => larguraTexto(l, t) <= NOME.larguraMax);
  while (!cabe(linhas, tamanho) && tamanho > NOME.minimo) {
    tamanho = Math.max(NOME.minimo, tamanho - 0.5);
    linhas = quebrar(nome, tamanho);
  }
  return { linhas, tamanho };
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const n = (v) => Number(v.toFixed(2));

/**
 * Tudo que vai num cracha, em pt, com a celula em (x, y): retangulos pretos
 * (fio de corte e moldura), textos e imagens. A previa (SVG) e o PDF desenham
 * a partir daqui, para sairem iguais. linha: 0-3 (topo da moldura medido em
 * cada linha do modelo).
 */
const montarCracha = (c, x, y, linha) => {
  const fio = CELULA.fio;
  const mx = x + MOLDURA.dx;
  const my = y + MOLDURA.topo[linha];
  const b = MOLDURA.borda;
  const { linhas, tamanho } = linhasDoNome(c.nome);
  const entre = NOME.entreLinhas * (tamanho / NOME.tamanho);
  const cx = x + NOME.centro;
  return {
    retangulos: [
      [x, y, CELULA.largura + fio, fio], [x, y + CELULA.altura, CELULA.largura + fio, fio],
      [x, y, fio, CELULA.altura + fio], [x + CELULA.largura, y, fio, CELULA.altura + fio],
      [mx, my, MOLDURA.largura, b], [mx, my + MOLDURA.altura - b, MOLDURA.largura, b],
      [mx, my, b, MOLDURA.altura], [mx + MOLDURA.largura - b, my, b, MOLDURA.altura],
    ],
    textos: [
      ...linhas.map((l, i) => ({ texto: l, x: cx, y: y + NOME.base + i * entre, tamanho, negrito: true, centro: true })),
      { texto: String(c.grupo || '').toLocaleUpperCase('pt-BR'), x: cx, y: y + NOME.base + (linhas.length - 1) * entre + COR.abaixo,
        tamanho: COR.tamanho, negrito: true, centro: true },
      { texto: String(c.numero ?? ''), x: x + NUMERO.x, y: y + NUMERO.base, tamanho: NUMERO.tamanho, negrito: false, centro: false },
    ],
    imagens: [
      { src: IMAGEM_LOGO, x: x + LOGO.x, y: y + LOGO.y, largura: LOGO.largura, altura: LOGO.altura },
      { src: IMAGEM_ESCUDO, x: x + ESCUDO.x, y: y + ESCUDO.y, largura: ESCUDO.largura, altura: ESCUDO.altura },
    ],
  };
};

/** Previa de um cracha so (a celula inteira, com o fio de corte), em SVG. */
export const svgPreviaCracha = (c) => {
  const w = CELULA.largura + CELULA.fio;
  const h = CELULA.altura + CELULA.fio;
  const m = montarCracha(c, 0, 0, 0);
  const rets = m.retangulos.map(([rx, ry, rw, rh]) => `<rect x="${n(rx)}" y="${n(ry)}" width="${n(rw)}" height="${n(rh)}"/>`).join('');
  const textos = m.textos.map((t) => `<text x="${n(t.x)}" y="${n(t.y)}" font-size="${t.tamanho}"${t.negrito ? ' font-weight="bold"' : ''}${t.centro ? ' text-anchor="middle"' : ''}>${esc(t.texto)}</text>`).join('');
  const imagens = m.imagens.map((im) => `<image href="${im.src}" x="${n(im.x)}" y="${n(im.y)}" width="${im.largura}" height="${im.altura}" preserveAspectRatio="none"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="100%" style="background:#fff;display:block">
    <g fill="#000">${rets}</g><g font-family="${FONTE}" fill="#000" style="font-kerning:none">${textos}</g>${imagens}</svg>`;
};

const comoDataUrl = async (src) => {
  const resposta = await fetch(src);
  if (!resposta.ok) throw new Error('Não consegui carregar a arte do crachá. Tente de novo.');
  const blob = await resposta.blob();
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = () => falha(new Error('Não consegui carregar a arte do crachá.'));
    leitor.readAsDataURL(blob);
  });
};

// Os textos vao no PDF como imagem de 600 dpi desenhada com a Arial do
// computador (a fonte do modelo; ela nao pode ser embutida no site). Fios,
// moldura e imagens vao em vetor/original.
const DPI_TEXTO = 600;
const ALTURA_TEXTO = 150; // pt a partir do topo da celula: cobre nome, cor e numero

const textosComoImagem = (textos, x, y) => {
  const escala = DPI_TEXTO / 72;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(CELULA.largura * escala);
  canvas.height = Math.ceil(ALTURA_TEXTO * escala);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fontKerning = 'none';
  textos.forEach((t) => {
    ctx.font = `${t.negrito ? 'bold ' : ''}${t.tamanho * escala}px ${FONTE}`;
    ctx.textAlign = t.centro ? 'center' : 'left';
    ctx.fillText(t.texto, (t.x - x) * escala, (t.y - y) * escala);
  });
  return canvas;
};

/**
 * Gera o PDF dos crachas (folha A4 do tamanho do modelo, 8 por folha) e
 * entrega o arquivo: no computador baixa; no celular abre o compartilhar.
 * crachas: [{nome, grupo, numero}] ja na ordem.
 */
export const gerarPdfCrachas = async (crachas, nomeArquivo) => {
  const [{ jsPDF }, { entregarArquivo }, logo, escudo] = await Promise.all([
    import('jspdf'), import('@/utils/entregarArquivo'), comoDataUrl(IMAGEM_LOGO), comoDataUrl(IMAGEM_ESCUDO),
  ]);
  const dados = { [IMAGEM_LOGO]: logo, [IMAGEM_ESCUDO]: escudo };
  const doc = new jsPDF({ unit: 'pt', format: [FOLHA.largura, FOLHA.altura], orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Crachás - Metanoia Radical' });
  crachas.forEach((c, i) => {
    const pos = i % POR_FOLHA;
    if (i > 0 && pos === 0) doc.addPage([FOLHA.largura, FOLHA.altura], 'portrait');
    const linha = Math.floor(pos / 2);
    const x = CELULA.x[pos % 2];
    const y = CELULA.topo[linha];
    const m = montarCracha(c, x, y, linha);
    doc.setFillColor(0, 0, 0);
    m.retangulos.forEach(([rx, ry, rw, rh]) => doc.rect(rx, ry, rw, rh, 'F'));
    m.imagens.forEach((im) => doc.addImage(dados[im.src], 'JPEG', im.x, im.y, im.largura, im.altura, im.src, 'NONE'));
    doc.addImage(textosComoImagem(m.textos, x, y), 'PNG', x, y, CELULA.largura, ALTURA_TEXTO, undefined, 'FAST');
  });
  await entregarArquivo(doc.output('blob'), nomeArquivo);
};
