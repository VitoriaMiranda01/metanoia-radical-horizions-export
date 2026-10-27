import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { entregarArquivo } from '@/utils/entregarArquivo';
import { carregarFonte } from '@/utils/relacaoNominal';

/**
 * PDF da chamada da reuniao de escala (27/10/2026, Patrick): presentes,
 * ausentes e sem chamada, com NOME | IGREJA | TELEFONE, uma faixa por area.
 * Uma situacao por secao (cada secao comeca numa pagina nova).
 *
 * secoes: [{ rotulo, pessoas: [{ nome, area, whatsapp, igreja... }] }]
 * area: nome da area quando o PDF e de uma area so (vai no cabecalho).
 *
 * Folha A4 retrato, Carlito (mesmas medidas da Calibri), faixa verde como na
 * relacao nominal. jspdf so carrega quando alguem exporta.
 */

const compararTexto = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
const MAIUSC = (t) => String(t || '').toLocaleUpperCase('pt-BR');
const igrejaDe = (p) => {
  const n = String(nomeDaIgreja(p) || '').trim();
  if (/^OUTRA\b/i.test(n)) return String(p?.igreja_outra || '').trim();
  return n.replace(/^\d+\s*-\s*/, '').trim();
};

const M = { x: 36, topo: 40, rodape: 36, faixa: 17.25, linha: 14.25, recuo: 3 };
const COLUNAS = [205, 200, 118];

export const exportarChamadaPdf = async (secoes, area = '') => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const fonte = await carregarFonte(doc);
  const largura = COLUNAS.reduce((a, b) => a + b, 0);
  const xs = COLUNAS.reduce((acc, w, i) => [...acc, acc[i] + w], [M.x]);
  const limite = doc.internal.pageSize.getHeight() - M.rodape;
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  let y = M.topo;
  let inicio = M.topo;
  let titulo = '';

  doc.setLineWidth(0.75);
  doc.setDrawColor(0, 0, 0);

  const caber = (texto, max, tamanho) => {
    let s = String(texto || '');
    doc.setFontSize(tamanho);
    while (s.length > 1 && doc.getTextWidth(s) > max) s = s.slice(0, -1);
    return s;
  };

  const verticais = () => { if (y > inicio) xs.forEach((x) => doc.line(x, inicio, x, y)); };

  const faixa = (texto, tamanho, verde = true) => {
    if (y + M.faixa > limite) novaPagina();
    verticais();
    if (verde) doc.setFillColor(0x9b, 0xbb, 0x59);
    doc.rect(M.x, y, largura, M.faixa, verde ? 'FD' : 'S');
    doc.setFont(fonte, 'bold');
    doc.setFontSize(tamanho);
    doc.text(caber(texto, largura - 2 * M.recuo, tamanho), M.x + largura / 2, y + 12.4, { align: 'center' });
    y += M.faixa;
    inicio = y;
  };

  const linha = (valores, estilo) => {
    if (y + M.linha > limite) novaPagina();
    doc.line(M.x, y, M.x + largura, y);
    doc.line(M.x, y + M.linha, M.x + largura, y + M.linha);
    doc.setFont(fonte, estilo);
    valores.forEach((v, i) => doc.text(caber(v, COLUNAS[i] - 2 * M.recuo, 10), xs[i] + M.recuo, y + 10.6));
    y += M.linha;
  };

  const cabecalho = () => linha(['NOME', 'IGREJA', 'TELEFONE'], 'bold');

  function novaPagina() {
    verticais();
    doc.addPage();
    y = M.topo;
    inicio = M.topo;
    faixa(titulo, 12);
    cabecalho();
  }

  secoes.forEach((s, i) => {
    if (i > 0) { verticais(); doc.addPage(); y = M.topo; inicio = M.topo; }
    const pessoas = s.pessoas || [];
    titulo = `CHAMADA · ${MAIUSC(s.rotulo)}${area ? ` · ${MAIUSC(area)}` : ''} (${pessoas.length})`;
    faixa(titulo, 13);
    doc.setFont(fonte, 'normal');
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${agora}`, M.x + largura, y + 10, { align: 'right' });
    y += 14;
    inicio = y;
    if (pessoas.length === 0) {
      doc.setFontSize(10);
      doc.text('Ninguém nesta situação.', M.x, y + 10);
      return;
    }
    cabecalho();
    const porArea = new Map();
    pessoas.forEach((p) => {
      const a = p.area || 'Sem área';
      if (!porArea.has(a)) porArea.set(a, []);
      porArea.get(a).push(p);
    });
    [...porArea.entries()].sort(([a], [b]) => compararTexto(a, b)).forEach(([nomeArea, lista]) => {
      if (!area) {
        if (y + M.faixa + M.linha > limite) novaPagina();
        faixa(`${MAIUSC(nomeArea)} (${lista.length})`, 11);
      }
      [...lista].sort((a, b) => compararTexto(a.nome, b.nome)).forEach((p) => {
        linha([MAIUSC(String(p.nome || '').replace(/\s+/g, ' ').trim()), MAIUSC(igrejaDe(p)), p.whatsapp ? formatarTelefone(p.whatsapp) : ''], 'normal');
      });
    });
    verticais();
  });

  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setFont(fonte, 'normal');
    doc.setFontSize(8);
    doc.text(`Página ${n} de ${total}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 18, { align: 'center' });
  }

  const nome = secoes.length === 1 ? secoes[0].rotulo : 'completa';
  const sufixo = area ? `_${area}` : '';
  const arquivo = `Chamada_${nome}${sufixo}_${new Date().toISOString().slice(0, 10)}.pdf`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  await entregarArquivo(doc.output('blob'), arquivo);
  return secoes.reduce((n, s) => n + (s.pessoas || []).length, 0);
};
