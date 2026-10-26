import { semAcento } from '@/utils/recepcao';

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
    const metade = (n) => `<div class="metade"><div class="nome${n.length > 36 ? ' longo' : ''}">${esc(n)}</div></div>`;
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
  .nome.longo { font-size: 68pt; }
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
