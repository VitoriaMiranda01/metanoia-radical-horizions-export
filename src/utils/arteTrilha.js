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
// forte / etiquetaForte: as mesmas funções no fundo BRANCO (o destaque claro,
// como o amarelo, some no branco).
const PALETA = {
  ROXO: { faixa: '#5b1a8f', destaque: '#b04cff', etiqueta: '#ffffff', forte: '#8a2be2', etiquetaForte: '#ffffff' },
  VERMELHO: { faixa: '#7e1016', destaque: '#ff2323', etiqueta: '#ffffff', forte: '#d61a1f', etiquetaForte: '#ffffff' },
  AMARELO: { faixa: '#77781f', destaque: '#ffea00', etiqueta: '#111111', forte: '#c9a200', etiquetaForte: '#111111' },
  VERDE: { faixa: '#1f7a2e', destaque: '#3be541', etiqueta: '#ffffff', forte: '#1f9e2c', etiquetaForte: '#ffffff' },
  AZUL: { faixa: '#195a8c', destaque: '#2ea9f0', etiqueta: '#ffffff', forte: '#1683cc', etiquetaForte: '#ffffff' }
};

export const FUNDOS_ARTE = [
  { valor: 'escuro', rotulo: 'Escuro' },
  { valor: 'branco', rotulo: 'Branco' }
];

// Cores que mudam com o fundo.
const temaDe = (paleta, fundo) => (fundo === 'branco'
  ? { ...paleta, branco: true, texto: paleta.forte, etiquetaFundo: paleta.forte, etiquetaTexto: paleta.etiquetaForte }
  : { ...paleta, branco: false, texto: paleta.destaque, etiquetaFundo: paleta.destaque, etiquetaTexto: paleta.etiqueta });

const W = 1280;
const H = 720;
const ESCALA = 1.5;
const FONTE = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Arial, sans-serif';
const FONTE_TEXTO = '"Segoe UI", Arial, sans-serif';

// ------------------------------------------------------------------ ícones
// Traço em uma caixa de 64x64 (desenhados em Path2D, na cor do grupo).
const ICONES = {
  // keffiyeh/turbante: copa pequena, faixa torcida e o pano comprido caindo
  // até embaixo, com dobras e a barra recortada (25/10/2026, Patrick).
  guia: [
    'M18 19 C18 5 46 5 46 19',
    'M14 19 H50 V26 H14 Z',
    'M21 19 L17 26 M28 19 L24 26 M35 19 L31 26 M42 19 L38 26 M49 19 L45 26',
    'M16 26 C14 38 11 50 8 62 L18 58 L24 63 L32 58 L40 63 L46 58 L56 62 C53 50 50 38 48 26',
    'M23 31 C22 41 20 50 18 56 M41 31 C42 41 44 50 46 56',
    'M32 31 L32 52',
    'M24 11 C26 9 28 8.5 31 8.5'
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

// Fundo escuro com leve granulado (como a textura da arte original), ou branco.
const desenharFundo = (ctx, tema) => {
  if (tema.branco) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    return;
  }
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
const desenharCartao = (ctx, x, y, w, h, img, borda, branco = false) => {
  ctx.save();
  ctx.shadowColor = branco ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = branco ? 8 : 10;
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
  ctx.lineWidth = branco ? 3 : 1.5;
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
  ctx.fillStyle = paleta.texto;
  ctx.font = `900 44px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUIAS', 190, 238);
  desenharIcone(ctx, 'guia', 190, 316, 80, paleta.texto);
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
  if (paleta.branco) {
    // fundo branco: moldura só no contorno e uma barra entre os cartões
    ctx.strokeStyle = paleta.forte;
    ctx.lineWidth = 3;
    retanguloRedondo(ctx, px, py, pw, ch + 2 * pad, 6);
    ctx.stroke();
    ctx.fillStyle = paleta.forte;
    for (let i = 1; i < n; i += 1) {
      const bx = px + pad + i * (cw + gap) - gap / 2;
      retanguloRedondo(ctx, bx - 3, py + pad, 6, ch, 3);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = paleta.destaque;
    retanguloRedondo(ctx, px, py, pw, ch + 2 * pad, 6);
    ctx.fill();
  }
  guias.forEach((p, i) => {
    const x = px + pad + i * (cw + gap);
    desenharCartao(ctx, x, py + pad, cw, ch, p.imagem, paleta.faixa, paleta.branco);
    desenharEtiqueta(ctx, p.nome, x + cw / 2, py + ch + 2 * pad + 4, cw + gap - 2, paleta.etiquetaFundo, paleta.etiquetaTexto);
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
    desenharIcone(ctx, s.icone, x + 18, y + ch / 2, 46, paleta.texto, s.icone === 'inimigo' ? Math.PI / 4 : 0);
    ctx.save();
    ctx.translate(x + 54, y + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = paleta.texto;
    ajustarFonte(ctx, s.titulo, 900, 22, FONTE, ch);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.titulo, 0, 0);
    ctx.restore();
    x += COLUNA;
    s.pessoas.forEach((p, i) => {
      desenharCartao(ctx, x, y, cw, ch, p.imagem, paleta.faixa, paleta.branco);
      if (paleta.branco) {
        // fundo branco: o nome solto, na cor do grupo (como na arte do roxo)
        ctx.fillStyle = paleta.forte;
        ajustarFonte(ctx, p.nome, 700, 15, FONTE_TEXTO, cw + gap - 4);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.nome, x + cw / 2, y + ch + 16);
      } else {
        desenharEtiqueta(ctx, p.nome, x + cw / 2, y + ch + 5, cw + gap - 2, '#ffffff', '#222222');
      }
      x += cw + (i < s.pessoas.length - 1 ? gap : 0);
    });
    x += entre;
  });
};

/**
 * grupo: { cor, guias, inimigo, infiltrados, espirito } -- cada um uma lista
 *   de { nome, imagem (HTMLImageElement|ImageBitmap|null) }.
 * edicao: { titulo: '36ª EDIÇÃO', datas: ['04, 05 e 06 de setembro', 'de 2026'] }
 * fundo: 'escuro' (padrão) ou 'branco' (modelo da arte antiga do roxo).
 * Devolve um Blob PNG 1920x1080.
 */
export const desenharArteGrupo = async (grupo, edicao, { fundo = 'escuro' } = {}) => {
  const paleta = temaDe(PALETA[grupo.cor], fundo);
  const logo = await carregarLogo();
  const canvas = document.createElement('canvas');
  canvas.width = W * ESCALA;
  canvas.height = H * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  desenharFundo(ctx, paleta);
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
