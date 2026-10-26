import { semAcento } from '@/utils/recepcao';
import { carregarFonte } from '@/utils/relacaoNominal';
import { entregarArquivo } from '@/utils/entregarArquivo';

/**
 * Momento de joelhos (26/10/2026, pedido do Patrick): duas por pagina A4 em
 * paisagem (nomes divididos por uma linha tracejada), so com o nome em letra grande, para a pessoa
 * mostrar no momento especial do projeto. Mesmo formato do documento
 * "joelhos 36.docx". Entram todos da lista da recepcao (a folha sai antes
 * da chamada), em ordem alfabetica.
 */
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Tamanho da letra (pt): 85 como no documento; nomes compridos diminuem para caber em meia folha.
export const tamanhoDoNome = (n) => (n.length > 46 ? 54 : n.length > 26 ? 68 : 85);

export const nomesMomentoDeJoelhos = (pessoas) => {
  const vistos = new Set();
  return (pessoas || [])
    .map((p) => String(p.nome || '').trim().replace(/\s+/g, ' ').toUpperCase())
    .filter((n) => n && !vistos.has(semAcento(n)) && vistos.add(semAcento(n)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

// Devolve false se o navegador bloqueou a janela.
export const imprimirMomentoDeJoelhos = (pessoas) => {
  const nomes = nomesMomentoDeJoelhos(pessoas);
  const paginas = [];
  for (let i = 0; i < nomes.length; i += 2) {
    const metade = (n) => `<div class="metade"><div class="nome" style="font-size:${tamanhoDoNome(n)}pt">${esc(n)}</div></div>`;
    paginas.push(`<section>${metade(nomes[i])}${nomes[i + 1] ? `<div class="corte"></div>${metade(nomes[i + 1])}` : ''}</section>`);
  }
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Momento de joelhos - Metanoia Radical</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  section { width: 297mm; height: 209mm; position: relative; padding: 0 12mm 0 30mm; overflow: hidden;
    page-break-after: always; break-after: page; }
  section:last-child { page-break-after: auto; break-after: auto; }
  .metade { height: 104mm; display: flex; align-items: center; overflow: hidden; }
  .corte { position: absolute; top: 104.5mm; left: 30mm; right: 12mm; border-top: 1px dashed #333; }
  .nome { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 85pt; line-height: 1.15; overflow-wrap: anywhere; }
  @media screen { section { margin: 0 auto 12px; border: 1px solid #ccc; } body { background: #eee; padding: 12px; } }
</style></head><body>${paginas}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body></html>`;
  const janela = window.open('', '_blank');
  if (!janela) return false;
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  return true;
};

const nomeDoArquivo = (ext) => `momento_de_joelhos_${new Date().toISOString().split('T')[0]}.${ext}`;

// PDF A4 paisagem, dois nomes por folha com a linha tracejada no meio (jspdf so carrega ao exportar).
export const exportarMomentoDeJoelhosPdf = async (pessoas) => {
  const nomes = nomesMomentoDeJoelhos(pessoas);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const fonte = await carregarFonte(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const x = 85; // ~30 mm
  const largura = W - x - 34;
  doc.setFont(fonte, 'normal');
  doc.setTextColor(0, 0, 0);

  const nome = (n, topo) => {
    let tam = tamanhoDoNome(n);
    let linhas;
    for (;;) {
      doc.setFontSize(tam);
      linhas = doc.splitTextToSize(n, largura);
      if (linhas.length * tam * 1.15 <= H / 2 - 24 || tam <= 30) break;
      tam -= 2;
    }
    const lh = tam * 1.15;
    const y0 = topo + (H / 2 - linhas.length * lh) / 2 + tam * 0.85;
    linhas.forEach((l, i) => doc.text(l, x, y0 + i * lh));
  };

  for (let i = 0; i < nomes.length; i += 2) {
    if (i > 0) doc.addPage();
    nome(nomes[i], 0);
    if (nomes[i + 1]) {
      doc.setLineWidth(0.75);
      doc.setDrawColor(51, 51, 51);
      doc.setLineDashPattern([4, 3], 0);
      doc.line(x, H / 2, W - 34, H / 2);
      doc.setLineDashPattern([], 0);
      nome(nomes[i + 1], H / 2);
    }
  }
  await entregarArquivo(doc.output('blob'), nomeDoArquivo('pdf'));
};

// Word (.docx) montado a mao em cima do jszip: A4 paisagem, uma tabela de duas
// linhas de altura fixa por folha (cada nome centralizado na sua metade, linha tracejada embaixo da primeira).
export const exportarMomentoDeJoelhosDocx = async (pessoas) => {
  const nomes = nomesMomentoDeJoelhos(pessoas);
  const JSZip = (await import('jszip')).default;
  const LINHA = 5900;
  const celula = (n, tracejado) => `<w:tc><w:tcPr><w:tcW w:w="15700" w:type="dxa"/>${
    tracejado ? '<w:tcBorders><w:bottom w:val="dashed" w:sz="6" w:space="0" w:color="333333"/></w:tcBorders>' : ''
  }<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="1134" w:right="400"/></w:pPr>${
    n ? `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="${tamanhoDoNome(n) * 2}"/><w:szCs w:val="${tamanhoDoNome(n) * 2}"/></w:rPr><w:t xml:space="preserve">${esc(n)}</w:t></w:r>` : ''
  }</w:p></w:tc>`;
  const linha = (n, tracejado) => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${LINHA}" w:hRule="exact"/></w:trPr>${celula(n, tracejado)}</w:tr>`;
  const tabela = (a, b) => `<w:tbl><w:tblPr><w:tblW w:w="15700" w:type="dxa"/><w:tblInd w:w="567" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="15700"/></w:tblGrid>${linha(a, !!b)}${linha(b, false)}</w:tbl>`;
  // paragrafo minusculo entre as tabelas: leva a quebra de pagina
  const separador = '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>';
  let corpo = '';
  for (let i = 0; i < nomes.length; i += 2) {
    corpo += (i > 0 ? separador : '') + tabela(nomes[i], nomes[i + 1] || '');
  }
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', { createFolders: false });
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', { createFolders: false });
  zip.file('word/document.xml', documento, { createFolders: false });
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  await entregarArquivo(blob, nomeDoArquivo('docx'));
};
