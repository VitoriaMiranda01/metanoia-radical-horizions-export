import { semAcento } from '@/utils/recepcao';

/**
 * Momento de joelhos (26/10/2026, pedido do Patrick): uma pagina A4 em
 * paisagem por acampante, so com o nome em letra grande, para a pessoa
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
  const paginas = nomes.map((n) => `<section><div class="corte"></div><div class="nome">${esc(n)}</div></section>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Momento de joelhos - Metanoia Radical</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  section { width: 297mm; height: 209mm; position: relative; display: flex; align-items: center; justify-content: center;
    padding: 14mm 16mm; page-break-after: always; break-after: page; overflow: hidden; }
  section:last-child { page-break-after: auto; break-after: auto; }
  .corte { position: absolute; top: 8mm; left: 10mm; right: 10mm; border-top: 1.5px dashed #888; }
  .nome { font-size: 85pt; font-weight: 700; line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
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
