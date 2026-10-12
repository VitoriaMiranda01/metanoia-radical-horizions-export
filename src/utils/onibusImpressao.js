import * as XLSX from 'xlsx';
import { documentoDe, telefoneDe, textoComposicao } from '@/utils/onibus';

/**
 * Saidas das listas dos onibus (12/10/2026): a folha para imprimir (uma
 * pagina A4 por onibus, para entregar ao responsavel) e a planilha (uma aba
 * por onibus). Colunas: No, Nome, Grupo, CPF/Documento, Telefone, Presenca.
 */

const CORES = {
  Vermelho: '#ef4444', Amarelo: '#eab308', Verde: '#22c55e', Azul: '#3b82f6', Roxo: '#a855f7',
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const paginaDoOnibus = (o, totalOnibus, geradaEm) => {
  let n = 0;
  let grupoAtual = null;
  const linhas = [];
  o.pessoas.forEach((p) => {
    const grupo = CORES[p.grupo_trailha] ? p.grupo_trailha : 'Sem grupo';
    if (grupo !== grupoAtual) {
      grupoAtual = grupo;
      const qtd = o.composicao.find((c) => c.grupo === grupo)?.qtd || 0;
      linhas.push(`<tr class="grupo"><td colspan="6"><span class="bola" style="background:${CORES[grupo] || '#9ca3af'}"></span>${esc(grupo)} <span class="qtd">(${qtd})</span></td></tr>`);
    }
    n += 1;
    linhas.push(`<tr>
      <td class="num">${n}</td>
      <td>${esc(p.nome)}</td>
      <td class="nowrap"><span class="bola" style="background:${CORES[grupo] || '#9ca3af'}"></span>${esc(grupo)}</td>
      <td class="nowrap">${esc(documentoDe(p))}</td>
      <td class="nowrap">${esc(telefoneDe(p))}</td>
      <td class="presenca"><span class="caixa"></span></td>
    </tr>`);
  });

  return `<section class="pagina">
    <header>
      <div>
        <h1>Ônibus ${o.numero} <span class="de">de ${totalOnibus}</span></h1>
        <p class="comp">${o.pessoas.length} acampantes · ${esc(textoComposicao(o.composicao))}${o.lugares ? ` · ${o.lugares} lugares` : ''}</p>
      </div>
      <div class="dir">
        <p class="evento">Metanoia Radical</p>
        <p class="data">Lista gerada em ${esc(geradaEm)}</p>
      </div>
    </header>
    <table>
      <thead><tr><th class="num">Nº</th><th>Nome</th><th>Grupo</th><th>CPF / Documento</th><th>Telefone</th><th class="presenca">Presença</th></tr></thead>
      <tbody>${linhas.join('')}</tbody>
    </table>
    <footer>Responsável pelo ônibus: ____________________________________________</footer>
  </section>`;
};

/** Abre a folha numa aba nova e chama a impressao. lista: os onibus a imprimir. */
export const imprimirOnibus = (lista, totalOnibus, geradaEm) => {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Listas dos ônibus - Metanoia Radical</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 11px; }
  .pagina { page-break-after: always; padding: 4px 0; }
  .pagina:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
  h1 { font-size: 22px; margin: 0; }
  h1 .de { font-size: 13px; font-weight: normal; color: #555; }
  .comp { margin: 3px 0 0; font-size: 12px; }
  .dir { text-align: right; }
  .evento { margin: 0; font-weight: bold; font-size: 13px; }
  .data { margin: 2px 0 0; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  /* Linhas baixas para ~47 nomes caberem numa A4; se passar, o cabecalho da tabela repete na folha seguinte. */
  th, td { border: 1px solid #bbb; padding: 3px 6px; text-align: left; vertical-align: middle; }
  thead { display: table-header-group; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  tr { page-break-inside: avoid; }
  tr.grupo td { background: #f5f5f5; font-weight: bold; font-size: 12px; }
  .qtd { font-weight: normal; color: #555; }
  .num { width: 32px; text-align: right; }
  .nowrap { white-space: nowrap; }
  .presenca { width: 70px; text-align: center; }
  .caixa { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #111; border-radius: 2px; }
  .bola { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
  footer { margin-top: 14px; font-size: 12px; }
  @media screen { body { padding: 16px; background: #fff; } .pagina { max-width: 800px; margin: 0 auto 32px; } }
</style></head><body>
${lista.map((o) => paginaDoOnibus(o, totalOnibus, geradaEm)).join('')}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 200); });</script>
</body></html>`;

  const janela = window.open('', '_blank');
  if (!janela) return false;
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  return true;
};

/** Planilha: aba "Resumo" e uma aba por onibus. */
export const exportarOnibusExcel = (onibus, semLugar, geradaEm) => {
  const wb = XLSX.utils.book_new();
  const resumo = onibus.map((o) => ({
    'Ônibus': o.numero,
    'Acampantes': o.pessoas.length,
    'Lugares': o.lugares || '-',
    'Grupos': textoComposicao(o.composicao),
  }));
  if (semLugar.length) resumo.push({ 'Ônibus': 'Sem lugar', 'Acampantes': semLugar.length, 'Lugares': '-', 'Grupos': '-' });
  resumo.push({}, { 'Ônibus': `Gerada em ${geradaEm}` });
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  wsResumo['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  const aba = (pessoas, nome) => {
    const ws = XLSX.utils.json_to_sheet(pessoas.map((p, i) => ({
      'Nº': i + 1,
      'Nome': p.nome || '-',
      'Grupo': p.grupo_trailha || 'Sem grupo',
      'CPF / Documento': documentoDe(p),
      'Telefone': telefoneDe(p),
      'Presença': '',
    })));
    ws['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, nome);
  };
  onibus.forEach((o) => aba(o.pessoas, `Ônibus ${o.numero}`));
  if (semLugar.length) aba(semLugar, 'Sem lugar');

  const hoje = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Onibus_Metanoia_Radical_${hoje}.xlsx`);
};
