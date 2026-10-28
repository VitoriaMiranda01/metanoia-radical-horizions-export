import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { entregarArquivo } from '@/utils/entregarArquivo';
import { carregarFonte } from '@/utils/relacaoNominal';

/**
 * PDF da chamada da reuniao de escala (27/10/2026, Patrick). Reescrito em
 * 28/10/2026: em vez de uma secao por situacao, uma faixa por AREA (ordem
 * alfabetica) com todo mundo junto e a coluna PRESENCA (Presente / Ausente /
 * Sem chamada, colorida). Quem gera escolhe as colunas e as situacoes.
 *
 * pessoas: [{ nome, area, whatsapp, igreja, situacao: 'presentes' | 'ausentes' | 'sem', ... }]
 * colunas: chaves de COLUNAS na ordem em que aparecem no PDF.
 * area: nome da area quando o PDF e de uma area so (vai no titulo).
 *
 * A4 (retrato; paisagem quando as colunas escolhidas nao cabem), Carlito
 * (mesmas medidas da Calibri), faixa verde como na relacao nominal. jspdf so
 * carrega quando alguem exporta.
 */

const compararTexto = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
const MAIUSC = (t) => String(t || '').toLocaleUpperCase('pt-BR');
const igrejaDe = (p) => {
  const n = String(nomeDaIgreja(p) || '').trim();
  if (/^OUTRA\b/i.test(n)) return String(p?.igreja_outra || '').trim();
  return n.replace(/^\d+\s*-\s*/, '').trim();
};

export const ROTULO_PRESENCA = { presentes: 'Presente', ausentes: 'Ausente', sem: 'Sem chamada' };
export const PLURAL = { presentes: (n) => (n === 1 ? 'presente' : 'presentes'), ausentes: (n) => (n === 1 ? 'ausente' : 'ausentes'), sem: () => 'sem chamada' };
export const COR_PRESENCA = { presentes: [22, 128, 60], ausentes: [190, 30, 30], sem: [200, 105, 0] };

// peso = largura relativa em pt numa folha retrato de 523 pt.
export const COLUNAS = {
  nome: { rotulo: 'Nome', peso: 190, valor: (p) => MAIUSC(String(p.nome || '').replace(/\s+/g, ' ').trim()) },
  igreja: { rotulo: 'Igreja', peso: 170, valor: (p) => MAIUSC(igrejaDe(p)) },
  telefone: { rotulo: 'Telefone', peso: 100, valor: (p) => (p.whatsapp ? formatarTelefone(p.whatsapp) : '') },
  presenca: { rotulo: 'Presença', peso: 75, valor: (p) => ROTULO_PRESENCA[p.situacao] || '' },
  atuacao: { rotulo: 'Atuação', peso: 110, valor: (p) => String(p.atuacao || (p.eh_lider ? 'Líder' : '')) },
  cor: { rotulo: 'Cor', peso: 60, valor: (p) => String(p.cor || '') },
  pago: { rotulo: 'Pago', peso: 40, valor: (p) => (p.pago ? 'Sim' : 'Não') },
  marcado_por: { rotulo: 'Marcado por', peso: 120, valor: (p) => String(p.marcado_por || '') }
};

const M = { x: 36, topo: 40, rodape: 36, faixa: 17.25, linha: 14.25, recuo: 3 };
const LARGURA_RETRATO = 523;

export const exportarChamadaPdf = async ({ pessoas, colunas, situacoes, area = '' }) => {
  const cols = colunas.filter((c) => COLUNAS[c]);
  if (cols.length === 0) throw new Error('Escolha ao menos uma coluna.');
  const somaPesos = cols.reduce((n, c) => n + COLUNAS[c].peso, 0);
  const paisagem = somaPesos > LARGURA_RETRATO + 40;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: paisagem ? 'landscape' : 'portrait' });
  const fonte = await carregarFonte(doc);
  const largura = doc.internal.pageSize.getWidth() - 2 * M.x;
  const larguras = cols.map((c) => (COLUNAS[c].peso / somaPesos) * largura);
  const xs = larguras.reduce((acc, w, i) => [...acc, acc[i] + w], [M.x]);
  const limite = doc.internal.pageSize.getHeight() - M.rodape;
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const tituloGeral = `CHAMADA · ${situacoes.length === 3 ? 'PRESENTES, AUSENTES E SEM CHAMADA'
    : situacoes.map((s) => MAIUSC(ROTULO_PRESENCA[s])).join(' E ')}${area ? ` · ${MAIUSC(area)}` : ''} (${pessoas.length})`;
  let y = M.topo;
  let inicio = M.topo;

  doc.setLineWidth(0.75);
  doc.setDrawColor(0, 0, 0);

  const caber = (texto, max, tamanho) => {
    let s = String(texto || '');
    doc.setFontSize(tamanho);
    while (s.length > 1 && doc.getTextWidth(s) > max) s = s.slice(0, -1);
    return s;
  };

  const verticais = () => { if (y > inicio) xs.forEach((x) => doc.line(x, inicio, x, y)); };

  const faixa = (texto, tamanho) => {
    if (y + M.faixa > limite) novaPagina();
    verticais();
    doc.setFillColor(0x9b, 0xbb, 0x59);
    doc.setTextColor(0, 0, 0);
    doc.rect(M.x, y, largura, M.faixa, 'FD');
    doc.setFont(fonte, 'bold');
    doc.setFontSize(tamanho);
    doc.text(caber(texto, largura - 2 * M.recuo, tamanho), M.x + largura / 2, y + 12.4, { align: 'center' });
    y += M.faixa;
    inicio = y;
  };

  const linha = (valores, estilo, corTexto = {}) => {
    if (y + M.linha > limite) novaPagina();
    doc.line(M.x, y, M.x + largura, y);
    doc.line(M.x, y + M.linha, M.x + largura, y + M.linha);
    valores.forEach((v, i) => {
      const cor = corTexto[cols[i]] || [0, 0, 0];
      doc.setTextColor(cor[0], cor[1], cor[2]);
      doc.setFont(fonte, corTexto[cols[i]] ? 'bold' : estilo);
      doc.text(caber(v, larguras[i] - 2 * M.recuo, 10), xs[i] + M.recuo, y + 10.6);
    });
    doc.setTextColor(0, 0, 0);
    y += M.linha;
  };

  const cabecalho = () => linha(cols.map((c) => MAIUSC(COLUNAS[c].rotulo)), 'bold');

  function novaPagina() {
    verticais();
    doc.addPage();
    y = M.topo;
    inicio = M.topo;
    faixa(tituloGeral, 12);
    cabecalho();
  }

  faixa(tituloGeral, 13);
  doc.setFont(fonte, 'normal');
  doc.setFontSize(8.5);
  doc.text(`Gerado em ${agora}`, M.x + largura, y + 10, { align: 'right' });
  y += 14;
  inicio = y;

  if (pessoas.length === 0) {
    doc.setFontSize(10);
    doc.text('Ninguém nesta seleção.', M.x, y + 10);
  } else {
    cabecalho();
    const porArea = new Map();
    pessoas.forEach((p) => {
      const a = p.area || 'Sem área';
      if (!porArea.has(a)) porArea.set(a, []);
      porArea.get(a).push(p);
    });
    [...porArea.entries()].sort(([a], [b]) => compararTexto(a, b)).forEach(([nomeArea, lista]) => {
      if (y + M.faixa + M.linha > limite) novaPagina();
      const conta = (s) => lista.filter((p) => p.situacao === s).length;
      const detalhe = situacoes.length > 1
        ? ` · ${situacoes.map((s) => `${conta(s)} ${PLURAL[s](conta(s))}`).join(' · ')}`
        : '';
      faixa(`${MAIUSC(nomeArea)} (${lista.length})${detalhe}`, 11);
      [...lista].sort((a, b) => compararTexto(a.nome, b.nome)).forEach((p) => {
        const cor = COR_PRESENCA[p.situacao];
        linha(cols.map((c) => COLUNAS[c].valor(p)), 'normal', cor ? { presenca: cor } : {});
      });
    });
    verticais();
  }

  const total = doc.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    doc.setPage(n);
    doc.setFont(fonte, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`Página ${n} de ${total}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 18, { align: 'center' });
  }

  const nome = situacoes.length === 3 ? 'completa' : situacoes.map((s) => ROTULO_PRESENCA[s]).join('_');
  const sufixo = area ? `_${area}` : '';
  const arquivo = `Chamada_${nome}${sufixo}_${new Date().toISOString().slice(0, 10)}.pdf`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  await entregarArquivo(doc.output('blob'), arquivo);
  return pessoas.length;
};
