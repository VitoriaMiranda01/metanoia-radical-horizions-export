/**
 * ARTE DA EQUIPE DE TRILHA (24/10/2026, Patrick): a arte de cada grupo que a
 * Victória montava à mão no Canva — faixa com a cor do grupo, a linha dos
 * GUIAS e embaixo INIMIGO, INFILTRADOS e ESPÍRITO SANTO, cada um com foto e
 * nome. Desenhada em canvas, 1920x1080 (16:9), uma imagem PNG por grupo.
 *
 * As medidas são as da arte original (1280x720) e o canvas é escalado 1,5x.
 * Quantidade livre: se um papel tiver mais gente, os cartões encolhem.
 */

export const CORES_ARTE = ['ROXO', 'VERMELHO', 'AMARELO', 'VERDE', 'AZUL'];

// faixa: fundo da faixa do topo; destaque: textos, moldura dos guias e
// etiquetas dos guias; etiqueta: cor do texto nas etiquetas dos guias.
const PALETA = {
  ROXO: { faixa: '#5b1a8f', destaque: '#b04cff', etiqueta: '#ffffff' },
  VERMELHO: { faixa: '#7e1016', destaque: '#ff2323', etiqueta: '#ffffff' },
  AMARELO: { faixa: '#77781f', destaque: '#ffea00', etiqueta: '#111111' },
  VERDE: { faixa: '#1f7a2e', destaque: '#3be541', etiqueta: '#ffffff' },
  AZUL: { faixa: '#195a8c', destaque: '#2ea9f0', etiqueta: '#ffffff' }
};

const W = 1280;
const H = 720;
const ESCALA = 1.5;
const FONTE = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif';
const FONTE_TEXTO = '"Segoe UI", Arial, sans-serif';

// ------------------------------------------------------------------ ícones
// Traço em uma caixa de 64x64 (desenhados em Path2D, na cor do grupo).
const ICONES = {
  guia: [
    'M14 31 C14 13 50 13 50 31',
    'M10 31 H54 V39 H10 Z',
    'M18 31 L14 39 M26 31 L22 39 M34 31 L30 39 M42 31 L38 39 M50 31 L46 39',
    'M12 39 L10 59 L20 56 L25 60 L32 56 L39 60 L44 56 L54 59 L52 39',
    'M22 43 L20 54 M42 43 L44 54 M32 43 L32 52',
    'M22 22 C24 19 27 18 30 18'
  ],
  inimigo: [
    'M32 60 L32 24',
    'M17 12 Q17 26 32 26 Q47 26 47 12',
    'M32 26 L32 6',
    'M28 11 L32 4 L36 11',
    'M13 17 L17 10 L21 17',
    'M43 17 L47 10 L51 17'
  ],
  infiltrados: [
    'M10 28 C10 33 54 33 54 28 C54 24 10 24 10 28 Z',
    'M20 26 C20 11 26 12 32 15 C38 12 44 11 44 26',
    'M20 22 L44 22',
    'M18 44 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
    'M34 44 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0',
    'M30 43 Q32 41 34 43',
    'M18 42 L14 39 M46 42 L50 39'
  ],
  espirito: [
    'M38 32 C37 26 42 22 47 25 L49 27 L56 29 L49 31',
    'M47 31 C46 43 32 50 18 46 L8 51 L12 42 C18 38 26 38 33 36',
    'M33 36 C26 31 22 21 24 11 C32 17 38 25 40 31',
    'M29 34 C21 31 16 25 16 18 C22 22 26 26 31 30'
  ]
};

const desenharIcone = (ctx, nome, x, y, tamanho, cor, girar = 0) => {
  ctx.save();
  ctx.translate(x, y);
  if (girar) ctx.rotate(girar);
  const k = tamanho / 64;
  ctx.scale(k, k);
  ctx.translate(-32, -32);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ICONES[nome].forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.restore();
};

// ------------------------------------------------------------------ apoio
const retanguloRedondo = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Texto numa largura máxima: diminui a fonte até caber.
const ajustarFonte = (ctx, texto, peso, tamanho, familia, largura) => {
  let t = tamanho;
  ctx.font = `${peso} ${t}px ${familia}`;
  while (t > 8 && ctx.measureText(texto).width > largura) {
    t -= 0.5;
    ctx.font = `${peso} ${t}px ${familia}`;
  }
  return t;
};

const carregarImagem = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Não carregou: ${src}`));
  img.src = src;
});

let logoPromessa = null;
const carregarLogo = () => {
  if (!logoPromessa) logoPromessa = carregarImagem('/images/arte-trilha-logo.png').catch(() => null);
  return logoPromessa;
};

// Fundo escuro com leve granulado (como a textura da arte original).
const desenharFundo = (ctx) => {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#24213f');
  g.addColorStop(0.55, '#16152b');
  g.addColorStop(1, '#0c0c16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // granulado determinístico (mesma arte sempre igual)
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
};

const desenharCabecalho = (ctx, cor, paleta, logo, edicao) => {
  ctx.fillStyle = paleta.faixa;
  ctx.fillRect(0, 33, W, 102);
  if (logo) {
    const lw = 330;
    const lh = lw * (logo.height / logo.width);
    ctx.drawImage(logo, 68, 84 - lh / 2, lw, lh);
  }
  // etiquetas brancas da edição, empilhadas
  const linhas = [edicao.titulo, ...edicao.datas].filter(Boolean);
  const cx = 535;
  const alt = 22;
  let y = 84 - (linhas.length * alt + (linhas.length - 1) * 2) / 2;
  linhas.forEach((linha) => {
    ctx.font = `800 15px ${FONTE_TEXTO}`;
    const tw = Math.min(ctx.measureText(linha).width + 16, 250);
    ajustarFonte(ctx, linha, 800, 15, FONTE_TEXTO, 240);
    ctx.fillStyle = '#ffffff';
    retanguloRedondo(ctx, cx - tw / 2, y, tw, alt, 5);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(linha, cx, y + alt / 2 + 1);
    y += alt + 2;
  });
  // GRUPO X
  ctx.fillStyle = '#ffffff';
  ajustarFonte(ctx, `GRUPO ${cor}`, 900, 46, FONTE, 560);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`GRUPO ${cor}`, 945, 86);
};

// Cartão branco com a foto (preenche o quadro, cortando o que sobra).
const desenharCartao = (ctx, x, y, w, h, img, borda) => {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  retanguloRedondo(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.restore();
  const m = Math.max(5, w * 0.05);
  const px = x + m;
  const py = y + m;
  const pw = w - 2 * m;
  const ph = h - 2 * m;
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(px, py, pw, ph);
  if (img) {
    const k = Math.max(pw / img.width, ph / img.height);
    const sw = pw / k;
    const sh = ph / k;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, px, py, pw, ph);
  }
  ctx.strokeStyle = borda;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, pw, ph);
};

const desenharEtiqueta = (ctx, texto, cx, y, larguraMax, fundo, corTexto) => {
  const t = ajustarFonte(ctx, texto, 700, 14, FONTE_TEXTO, larguraMax - 14);
  const tw = Math.min(ctx.measureText(texto).width + 14, larguraMax);
  const h = Math.max(20, t + 8);
  ctx.fillStyle = fundo;
  retanguloRedondo(ctx, cx - tw / 2, y, tw, h, 4);
  ctx.fill();
  ctx.fillStyle = corTexto;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, cx, y + h / 2 + 1);
};

const desenharGuias = (ctx, paleta, guias) => {
  // título e ícone à esquerda
  ctx.fillStyle = paleta.destaque;
  ctx.font = `900 44px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUIAS', 190, 238);
  desenharIcone(ctx, 'guia', 190, 312, 74, paleta.destaque);
  if (guias.length === 0) return;

  const n = guias.length;
  const x0 = 312;
  const largura = 906;
  const gap = 18;
  const pad = 9;
  let cw = 165;
  let ch = 214;
  const cabe = (largura - 2 * pad - (n - 1) * gap) / n;
  if (cabe < cw) { ch = ch * (cabe / cw); cw = cabe; }
  const pw = n * cw + (n - 1) * gap + 2 * pad;
  const px = x0 + (largura - pw) / 2;
  const py = 163;
  ctx.fillStyle = paleta.destaque;
  retanguloRedondo(ctx, px, py, pw, ch + 2 * pad, 6);
  ctx.fill();
  guias.forEach((p, i) => {
    const x = px + pad + i * (cw + gap);
    desenharCartao(ctx, x, py + pad, cw, ch, p.imagem, paleta.faixa);
    desenharEtiqueta(ctx, p.nome, x + cw / 2, py + ch + 2 * pad + 4, cw + gap - 2, paleta.destaque, paleta.etiqueta);
  });
};

// Linha de baixo: [ícone + texto em pé] + cartões, para cada papel.
const desenharLinhaDeBaixo = (ctx, paleta, secoes) => {
  const usadas = secoes.filter((s) => s.pessoas.length > 0);
  if (usadas.length === 0) return;
  const COLUNA = 72; // ícone + texto em pé
  const gap = 17;
  const entre = 38;
  const xi = 50;
  const xf = 1230;
  let cw = 166;
  let ch = 212;
  const total = (k) => usadas.reduce((a, s) => a + COLUNA + s.pessoas.length * k + (s.pessoas.length - 1) * gap, 0)
    + (usadas.length - 1) * entre;
  if (total(cw) > xf - xi) {
    const cartoes = usadas.reduce((a, s) => a + s.pessoas.length, 0);
    const fixo = total(0);
    const novo = (xf - xi - fixo) / cartoes;
    ch = ch * (novo / cw);
    cw = novo;
  }
  let x = xi + (xf - xi - total(cw)) / 2;
  const y = 447;
  usadas.forEach((s) => {
    // ícone e texto em pé, centrados na altura do cartão
    desenharIcone(ctx, s.icone, x + 18, y + ch / 2, 46, paleta.destaque, s.icone === 'inimigo' ? Math.PI / 4 : 0);
    ctx.save();
    ctx.translate(x + 54, y + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = paleta.destaque;
    ajustarFonte(ctx, s.titulo, 900, 22, FONTE, ch);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.titulo, 0, 0);
    ctx.restore();
    x += COLUNA;
    s.pessoas.forEach((p, i) => {
      desenharCartao(ctx, x, y, cw, ch, p.imagem, paleta.faixa);
      desenharEtiqueta(ctx, p.nome, x + cw / 2, y + ch + 5, cw + gap - 2, '#ffffff', '#222222');
      x += cw + (i < s.pessoas.length - 1 ? gap : 0);
    });
    x += entre;
  });
};

/**
 * grupo: { cor, guias, inimigo, infiltrados, espirito } -- cada um uma lista
 *   de { nome, imagem (HTMLImageElement|ImageBitmap|null) }.
 * edicao: { titulo: '36ª EDIÇÃO', datas: ['04, 05 e 06 de setembro', 'de 2026'] }
 * Devolve um Blob PNG 1920x1080.
 */
export const desenharArteGrupo = async (grupo, edicao) => {
  const paleta = PALETA[grupo.cor];
  const logo = await carregarLogo();
  const canvas = document.createElement('canvas');
  canvas.width = W * ESCALA;
  canvas.height = H * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  desenharFundo(ctx);
  desenharCabecalho(ctx, grupo.cor, paleta, logo, edicao);
  desenharGuias(ctx, paleta, grupo.guias);
  desenharLinhaDeBaixo(ctx, paleta, [
    { titulo: 'INIMIGO', icone: 'inimigo', pessoas: grupo.inimigo },
    { titulo: 'INFILTRADOS', icone: 'infiltrados', pessoas: grupo.infiltrados },
    { titulo: 'ESPÍRITO SANTO', icone: 'espirito', pessoas: grupo.espirito }
  ]);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

// "04, 05 e 06 de setembro de 2026" -> ['04, 05 e 06 de setembro', 'de 2026']
export const quebrarDatas = (texto) => {
  const m = String(texto || '').match(/^(.*)\s(de \d{4})$/);
  return m ? [m[1], m[2]] : [String(texto || '')].filter(Boolean);
};
