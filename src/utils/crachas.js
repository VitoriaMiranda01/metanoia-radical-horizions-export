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
 * a partir do canto de cima/esquerda da celula. A folha e desenhada em SVG com
 * o mesmo sistema de coordenadas do PDF (595,32 x 841,92 pt).
 *
 * Numero: tamanho da camisa (1 PP ... 7 XXG) ou 8 para TODO infiltrado -- e a
 * unica marca que identifica o infiltrado no cracha.
 */

export const NUMERO_DA_CAMISA = { PP: 1, P: 2, M: 3, G: 4, GG: 5, XG: 6, XXG: 7 };
export const TAMANHOS_CAMISA = Object.keys(NUMERO_DA_CAMISA);
export const NUMERO_INFILTRADO = 8;
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
  numero: p.infiltrado ? NUMERO_INFILTRADO : (NUMERO_DA_CAMISA[camisaNormalizada(p.camisa)] || null),
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
const ret = (x, y, w, h) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/>`;

/**
 * Um cracha (celula + moldura + conteudo) em SVG, com a celula em (x, y).
 * linha: 0-3, so para o topo da moldura medido em cada linha do modelo.
 */
const desenharCracha = (c, x, y, linha, base = '') => {
  const fio = CELULA.fio;
  const mx = x + MOLDURA.dx;
  const my = y + MOLDURA.topo[linha];
  const b = MOLDURA.borda;
  const { linhas, tamanho } = linhasDoNome(c.nome);
  const entre = NOME.entreLinhas * (tamanho / NOME.tamanho);
  const cx = x + NOME.centro;
  const nomes = linhas.map((l, i) =>
    `<text x="${n(cx)}" y="${n(y + NOME.base + i * entre)}" font-size="${tamanho}" font-weight="bold" text-anchor="middle">${esc(l)}</text>`);
  const baseCor = y + NOME.base + (linhas.length - 1) * entre + COR.abaixo;
  return `<g>
    <g fill="#000">
      ${ret(x, y, CELULA.largura + fio, fio)}${ret(x, y + CELULA.altura, CELULA.largura + fio, fio)}
      ${ret(x, y, fio, CELULA.altura + fio)}${ret(x + CELULA.largura, y, fio, CELULA.altura + fio)}
      ${ret(mx, my, MOLDURA.largura, b)}${ret(mx, my + MOLDURA.altura - b, MOLDURA.largura, b)}
      ${ret(mx, my, b, MOLDURA.altura)}${ret(mx + MOLDURA.largura - b, my, b, MOLDURA.altura)}
    </g>
    <g font-family="${FONTE}" fill="#000" style="font-kerning:none">
      ${nomes.join('')}
      <text x="${n(cx)}" y="${n(baseCor)}" font-size="${COR.tamanho}" font-weight="bold" text-anchor="middle">${esc(String(c.grupo || '').toLocaleUpperCase('pt-BR'))}</text>
      <text x="${n(x + NUMERO.x)}" y="${n(y + NUMERO.base)}" font-size="${NUMERO.tamanho}">${esc(c.numero)}</text>
    </g>
    <image href="${base}${IMAGEM_LOGO}" x="${n(x + LOGO.x)}" y="${n(y + LOGO.y)}" width="${LOGO.largura}" height="${LOGO.altura}" preserveAspectRatio="none"/>
    <image href="${base}${IMAGEM_ESCUDO}" x="${n(x + ESCUDO.x)}" y="${n(y + ESCUDO.y)}" width="${ESCUDO.largura}" height="${ESCUDO.altura}" preserveAspectRatio="none"/>
  </g>`;
};

/** Previa de um cracha so (a celula inteira, com o fio de corte). */
export const svgPreviaCracha = (c) => {
  const w = CELULA.largura + CELULA.fio;
  const h = CELULA.altura + CELULA.fio;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="100%" style="background:#fff;display:block">${desenharCracha(c, 0, 0, 0)}</svg>`;
};

const folhaSvg = (crachas, base) => {
  const partes = crachas.map((c, i) => {
    const linha = Math.floor(i / 2);
    return desenharCracha(c, CELULA.x[i % 2], CELULA.topo[linha], linha, base);
  });
  return `<svg class="folha" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOLHA.largura} ${FOLHA.altura}" width="210mm" height="297mm">${partes.join('')}</svg>`;
};

/**
 * Abre a folha numa aba nova e chama a impressao. crachas: [{nome, grupo, numero}]
 * ja na ordem. janela: aba ja aberta no clique (quando antes e preciso salvar
 * algo -- aberta depois da espera, o navegador bloqueia). Devolve false se o
 * navegador bloqueou a janela.
 */
export const imprimirCrachas = (crachas, janelaAberta = null) => {
  const base = window.location.origin;
  const folhas = [];
  for (let i = 0; i < crachas.length; i += POR_FOLHA) folhas.push(folhaSvg(crachas.slice(i, i + POR_FOLHA), base));
  const total = crachas.length;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Crachás - Metanoia Radical</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .folha { display: block; width: 210mm; height: 297mm; page-break-after: always; break-after: page; overflow: hidden; }
  .folha:last-of-type { page-break-after: auto; break-after: auto; }
  .aviso { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111; background: #fff7d6; border-bottom: 1px solid #e5c100; padding: 10px 16px; line-height: 1.5; }
  .aviso b { color: #000; }
  @media screen { body { background: #e5e5e5; } .folha { background: #fff; margin: 16px auto; box-shadow: 0 1px 6px rgba(0,0,0,.25); } }
  @media print { .aviso { display: none; } }
</style></head><body>
<div class="aviso">${total} ${total === 1 ? 'crachá' : 'crachás'} em ${folhas.length} ${folhas.length === 1 ? 'folha' : 'folhas'} A4.
Para sair no tamanho exato do modelo, na janela de impressão escolha <b>Escala: 100% (tamanho real)</b> — nunca "Ajustar à página" —,
<b>Margens: Nenhuma</b> e desligue <b>Cabeçalhos e rodapés</b>. Corte pelo fio fino em volta de cada crachá.</div>
${folhas.join('')}
<script>
  (function () {
    var fontes = (document.fonts && document.fonts.ready) || Promise.resolve();
    var imagens = ['${IMAGEM_LOGO}', '${IMAGEM_ESCUDO}'].map(function (src) {
      return new Promise(function (ok) { var i = new Image(); i.onload = ok; i.onerror = ok; i.src = '${base}' + src; });
    });
    window.addEventListener('load', function () {
      Promise.all([fontes].concat(imagens)).then(function () { setTimeout(function () { window.print(); }, 300); });
    });
  })();
</script>
</body></html>`;

  const janela = janelaAberta || window.open('', '_blank');
  if (!janela) return false;
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  return true;
};
