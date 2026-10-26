import { dadosDoCracha, ehEquipeDaTrilha, ordenarCrachas } from '@/utils/crachas';
import { termosDaPessoa } from '@/utils/saude';
import { entregarArquivo } from '@/utils/entregarArquivo';

/**
 * Relacao de saude dos crachas (Patrick, 26/10/2026): quem tem problema de
 * saude, usa medicamento ou tem restricao alimentar -- essas pessoas levam uma
 * marcacao no cracha, feita a mao nesta edicao. A lista e a MESMA dos crachas
 * (acampantes da recepcao + equipe da trilha), na mesma ordem da impressao
 * (cor, nome), com um X em cada coluna que vira marcacao.
 *
 * Acampante: os dados vem de saude_acampantes() (o mesmo da tela Saude, entao os
 * numeros batem). Equipe da trilha: vem da ficha do equipante, que nao pergunta
 * medicamento (so problema de saude e restricao alimentar).
 */

const CAMPOS = [
  { chave: 'problema', rotulo: 'Saúde', detalhe: 'Problema de saúde', flag: 'tem_problema_saude', texto: 'condicoes_medicas' },
  { chave: 'medicamento', rotulo: 'Remédio', detalhe: 'Medicamento', flag: 'usa_medicamento', texto: 'medicamentos' },
  { chave: 'alimento', rotulo: 'Alimento', detalhe: 'Restrição alimentar', flag: 'tem_restricao_alimentar', texto: 'restricoes_alimentares' },
];

// Mesma regra da tela Saude: marcou "sim" OU escreveu algo que diz alguma coisa
// ("nao", "nenhum"... nao contam).
const temCampo = (saude, c) => !!(saude?.[c.flag] || termosDaPessoa(saude, c.chave).length > 0);

const descrito = (saude, c) => {
  if (!temCampo(saude, c)) return '';
  const t = String(saude?.[c.texto] || '').replace(/\s+/g, ' ').trim();
  return t || 'sim (não descreveu)';
};

/**
 * pessoas: lista de fetchCrachas(); saudePorChave: Map 'tipo:id' -> ficha de
 * saude. Devolve so quem tem alguma marcacao, na ordem dos crachas.
 */
export const montarRelacaoSaude = (pessoas, saudePorChave) => ordenarCrachas(pessoas)
  .map((p) => {
    const s = saudePorChave.get(`${p.tipo}:${p.id}`);
    const c = dadosDoCracha(p);
    const marcas = Object.fromEntries(CAMPOS.map((f) => [f.chave, temCampo(s, f)]));
    return {
      nome: c.nome || String(p.nome || '').toLocaleUpperCase('pt-BR'),
      grupo: c.grupo || '',
      numero: c.numero || '',
      tipo: ehEquipeDaTrilha(p) ? 'Equipe' : 'Acampante',
      marcas,
      detalhes: Object.fromEntries(CAMPOS.map((f) => [f.chave, descrito(s, f)])),
    };
  })
  .filter((l) => CAMPOS.some((f) => l.marcas[f.chave]));

export const contarRelacaoSaude = (linhas) => Object.fromEntries(
  CAMPOS.map((f) => [f.chave, linhas.filter((l) => l.marcas[f.chave]).length])
);

const hoje = () => new Date().toISOString().split('T')[0];

// ---- Excel ---------------------------------------------------------------------
export const exportarRelacaoSaudeExcel = async (linhas) => {
  const XLSX = await import('xlsx');
  const dados = linhas.map((l) => ({
    'Nome no crachá': l.nome,
    'Tipo': l.tipo,
    'Cor': l.grupo,
    'Nº': l.numero,
    ...Object.fromEntries(CAMPOS.map((f) => [f.rotulo, l.marcas[f.chave] ? 'X' : ''])),
    ...Object.fromEntries(CAMPOS.map((f) => [f.detalhe, l.detalhes[f.chave]])),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dados);
  ws['!cols'] = Object.keys(dados[0]).map((k) => ({
    wch: Math.min(60, Math.max(k.length, ...dados.map((d) => String(d[k] ?? '').length)) + 2),
  }));
  XLSX.utils.book_append_sheet(wb, ws, 'Marcações');
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await entregarArquivo(blob, `crachas_saude_${hoje()}.xlsx`);
};

// ---- PDF -----------------------------------------------------------------------
const VERDE = [0x9b, 0xbb, 0x59];
const CINZA = [90, 90, 90];
const CORES = {
  Vermelho: [220, 38, 38], Amarelo: [234, 179, 8], Verde: [22, 163, 74], Azul: [37, 99, 235], Roxo: [147, 51, 234],
};

export const exportarRelacaoSaudePdf = async (linhas) => {
  const [{ jsPDF }, { carregarFonte }] = await Promise.all([import('jspdf'), import('@/utils/relacaoNominal')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const fonte = await carregarFonte(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 28;
  const largura = W - 2 * M;
  const limite = H - M - 14;

  // Colunas: nome, cor, nº, 3 marcas, detalhes (o resto).
  const col = { nome: 190, cor: 62, num: 28, marca: 44 };
  const xNome = M;
  const xCor = xNome + col.nome;
  const xNum = xCor + col.cor;
  const xMarca = xNum + col.num;
  const xDet = xMarca + col.marca * CAMPOS.length;
  const larguraDet = M + largura - xDet;
  const LH = 11;
  let y = M;

  const cabecalhoPagina = (primeira) => {
    if (primeira) {
      doc.setFillColor(...VERDE);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.75);
      doc.rect(M, y, largura, 22, 'FD');
      doc.setFont(fonte, 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('CRACHÁS — QUEM LEVA MARCAÇÃO DE SAÚDE', M + largura / 2, y + 15.5, { align: 'center' });
      y += 22;
      const total = contarRelacaoSaude(linhas);
      doc.setFont(fonte, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...CINZA);
      doc.text(
        `${linhas.length} ${linhas.length === 1 ? 'pessoa' : 'pessoas'} · saúde ${total.problema} · remédio ${total.medicamento} · alimento ${total.alimento} · gerado em ${new Date().toLocaleDateString('pt-BR')}`,
        M, y + 12
      );
      y += 20;
    }
    doc.setFillColor(...VERDE);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(M, y, largura, 16, 'FD');
    doc.setFont(fonte, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Nome no crachá', xNome + 4, y + 11.5);
    doc.text('Cor', xCor + 4, y + 11.5);
    doc.text('Nº', xNum + 4, y + 11.5);
    CAMPOS.forEach((f, i) => doc.text(f.rotulo, xMarca + i * col.marca + col.marca / 2, y + 11.5, { align: 'center' }));
    doc.text('O que a pessoa informou', xDet + 4, y + 11.5);
    y += 16;
  };

  cabecalhoPagina(true);

  linhas.forEach((l) => {
    const detalhes = CAMPOS.filter((f) => l.marcas[f.chave])
      .map((f) => `${f.detalhe}: ${l.detalhes[f.chave]}`);
    doc.setFont(fonte, 'normal');
    doc.setFontSize(9);
    const partes = detalhes.flatMap((d) => doc.splitTextToSize(d, larguraDet - 8));
    const nomePartes = doc.splitTextToSize(l.nome, col.nome - 8);
    const altura = Math.max(partes.length, nomePartes.length, 1) * LH + 6;

    if (y + altura > limite) {
      doc.addPage();
      y = M;
      cabecalhoPagina(false);
    }

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.4);
    doc.rect(M, y, largura, altura);
    [xCor, xNum, xMarca, ...CAMPOS.map((_, i) => xMarca + (i + 1) * col.marca)].forEach((x) => doc.line(x, y, x, y + altura));

    doc.setFont(fonte, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(nomePartes, xNome + 4, y + 11);

    if (l.grupo) {
      doc.setFillColor(...(CORES[l.grupo] || [170, 170, 170]));
      doc.circle(xCor + 8, y + 8.5, 3.5, 'F');
      doc.setFont(fonte, 'normal');
      doc.text(l.grupo, xCor + 14, y + 11.5);
    }
    doc.setFont(fonte, 'bold');
    doc.text(String(l.numero), xNum + col.num / 2, y + 11.5, { align: 'center' });

    doc.setFontSize(13);
    CAMPOS.forEach((f, i) => {
      if (l.marcas[f.chave]) doc.text('X', xMarca + i * col.marca + col.marca / 2, y + 13, { align: 'center' });
    });

    doc.setFont(fonte, 'normal');
    doc.setFontSize(9);
    doc.text(partes, xDet + 4, y + 11);
    y += altura;
  });

  y += 8;
  if (y + 24 > limite) { doc.addPage(); y = M; }
  doc.setFont(fonte, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...CINZA);
  const nota = doc.splitTextToSize(
    'X = a marcação que a pessoa leva no crachá. Os acampantes e a equipe da trilha vêm da mesma lista dos crachás. A ficha do equipante não pergunta medicamento: para a equipe só saem saúde e alimento.',
    largura
  );
  doc.text(nota, M, y + 8);

  const total = doc.getNumberOfPages();
  for (let pg = 1; pg <= total; pg += 1) {
    doc.setPage(pg);
    doc.setFont(fonte, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`Metanoia Radical Serra · Página ${pg} de ${total}`, W / 2, H - 16, { align: 'center' });
  }

  await entregarArquivo(doc.output('blob'), `crachas_saude_${hoje()}.pdf`);
};
