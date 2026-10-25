import { carregarFonte } from '@/utils/relacaoNominal';

/**
 * PDF da tela da saude (25/10/2026, Patrick): mesmo visual dos outros PDFs
 * (faixa verde #9BBB59 no titulo, Carlito), em A4 RETRATO porque a lider le
 * pelo celular. Cada pessoa vira um cartao: faixa clara com o nome e, abaixo,
 * "Rotulo | valor" so das colunas escolhidas (campo vazio nao aparece).
 * O Resumo (quantos por problema/remedio/alimento) vai ao final, se pedido.
 * jspdf so carrega quando alguem exporta.
 */

const VERDE = [0x9b, 0xbb, 0x59];
const VERDE_CLARO = [0xea, 0xf1, 0xdd];
const CINZA = [90, 90, 90];

const M = 28; // margem
const FONTE = 10;
const LH = 12.5; // altura de linha
const COL_ROTULO = 118;

export const exportarSaudePdf = async (pessoas, colunas, resumo) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const fonte = await carregarFonte(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const largura = W - 2 * M;
  const limite = H - M - 14;
  let y = M;

  const novaPagina = () => { doc.addPage(); y = M; };
  const garantir = (altura) => { if (y + altura > limite) novaPagina(); };

  const faixa = (texto, tamanho, cor = VERDE, altura = 20) => {
    garantir(altura + LH * 2);
    doc.setFillColor(...cor);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.75);
    doc.rect(M, y, largura, altura, 'FD');
    doc.setFont(fonte, 'bold');
    doc.setFontSize(tamanho);
    doc.setTextColor(0, 0, 0);
    doc.text(texto, M + largura / 2, y + altura / 2 + tamanho * 0.35, { align: 'center', maxWidth: largura - 8 });
    y += altura;
  };

  const hoje = new Date().toLocaleDateString('pt-BR');
  faixa('SAÚDE DOS ACAMPANTES', 14, VERDE, 22);
  doc.setFont(fonte, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text(`${pessoas.length} ${pessoas.length === 1 ? 'acampante' : 'acampantes'} · gerado em ${hoje}`, M, y + 12);
  y += 20;

  const temNome = colunas.some((c) => c.chave === 'nome');
  const demais = colunas.filter((c) => c.chave !== 'nome');

  pessoas.forEach((p, i) => {
    // linhas ja quebradas, para saber o tamanho antes de desenhar
    const linhas = demais
      .map((c) => ({ rotulo: c.rotulo, texto: String(c.valor(p) ?? '').trim() }))
      .filter((l) => l.texto)
      .map((l) => {
        doc.setFont(fonte, 'normal');
        doc.setFontSize(FONTE);
        return { ...l, partes: doc.splitTextToSize(l.texto, largura - COL_ROTULO - 8) };
      });

    garantir(22 + (linhas[0] ? linhas[0].partes.length * LH + 3 : 0));
    doc.setFillColor(...VERDE_CLARO);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(M, y, largura, 18, 'FD');
    doc.setFont(fonte, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(temNome ? String(p.nome || '') : `Acampante ${i + 1}`, M + 5, y + 12.5, { maxWidth: largura - 10 });
    y += 18;

    linhas.forEach((l) => {
      garantir(l.partes.length * LH + 3);
      doc.setFont(fonte, 'bold');
      doc.setFontSize(FONTE);
      doc.setTextColor(...CINZA);
      doc.text(l.rotulo, M + 5, y + 10, { maxWidth: COL_ROTULO - 8 });
      doc.setFont(fonte, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(l.partes, M + COL_ROTULO, y + 10);
      y += l.partes.length * LH + 3;
    });

    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.5);
    doc.line(M, y + 2, M + largura, y + 2);
    y += 9;
  });

  if (resumo && resumo.length > 0) {
    novaPagina();
    faixa('RESUMO', 14, VERDE, 22);
    y += 6;
    const tipos = [...new Set(resumo.map((r) => r.Tipo))];
    tipos.forEach((tipo) => {
      faixa(tipo, 11, VERDE_CLARO, 18);
      y += 4;
      resumo.filter((r) => r.Tipo === tipo).forEach((r) => {
        const titulo = `${r.Item} — ${r.Quantidade} (${r.Confirmados} confirmados, ${r['Só inscritos']} só inscritos)`;
        doc.setFont(fonte, 'bold');
        doc.setFontSize(FONTE);
        const t = doc.splitTextToSize(titulo, largura - 10);
        doc.setFont(fonte, 'normal');
        doc.setFontSize(9);
        const n = doc.splitTextToSize(r.Pessoas || '', largura - 20);
        garantir(t.length * LH + Math.min(n.length, 2) * 11 + 6);
        doc.setFont(fonte, 'bold');
        doc.setFontSize(FONTE);
        doc.setTextColor(0, 0, 0);
        doc.text(t, M + 5, y + 10);
        y += t.length * LH;
        doc.setFont(fonte, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...CINZA);
        n.forEach((linha) => {
          garantir(11);
          doc.text(linha, M + 15, y + 9);
          y += 11;
        });
        y += 6;
      });
      y += 4;
    });
  }

  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg += 1) {
    doc.setPage(pg);
    doc.setFont(fonte, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`Metanoia Radical Serra · Página ${pg} de ${total}`, W / 2, H - 16, { align: 'center' });
  }

  doc.save(`saude_acampantes_${new Date().toISOString().split('T')[0]}.pdf`);
};
