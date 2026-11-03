import * as XLSX from 'xlsx';
import { formatCPF } from '@/utils/formatters';
import { COLUMN_DEFINITIONS } from '@/utils/columnVisibility';
import { carregarFonte } from '@/utils/relacaoNominal';
import { entregarArquivo } from '@/utils/entregarArquivo';

/**
 * Exportar da tela de Pagamentos (03/11/2026, Patrick): PDF e Excel com as
 * colunas escolhidas em caixinhas, no modelo do exportar da Saude. `valorDe`
 * e o valorDaColuna da pagina: assim o arquivo sai com o mesmo texto da tela.
 * jspdf so carrega quando alguem exporta.
 */

const ptBR = (a, b) => String(a).localeCompare(String(b), 'pt-BR');
const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');

// Colunas que a tela nao tem (ou que saem diferentes no arquivo).
const EXTRAS = [
  { key: 'situacao', label: 'Situação (PAGOU / NÃO PAGOU)', group: 'Pagamento',
    valor: (i) => (i.quitado ? 'PAGOU' : 'NÃO PAGOU') },
  { key: 'data_hora', label: 'Data e hora do pagamento', group: 'Pagamento',
    valor: (i) => (i.quitado ? dataHoraBR(i.data_pagamento) : '') },
  { key: 'desconto', label: 'Desconto do cupom', group: 'Pagamento',
    valor: (i) => (i.quitado && i.cupom_usado && i.desconto ? Number(i.desconto) : '') },
  { key: 'obs_pagamento', label: 'Observação do pagamento', group: 'Pagamento',
    valor: (i) => (i.quitado && i.observacao_pagamento) || '' },
  { key: 'cobranca', label: 'Cobrança (em andamento / agendado)', group: 'Cobrança',
    valor: (i) => {
      if (i.quitado || !i.cobranca) return '';
      if (i.cobranca.status === 'agendado') {
        return `Agendado para ${String(i.cobranca.agendado_para).slice(0, 10).split('-').reverse().join('/')}`;
      }
      return 'Em andamento';
    } },
  { key: 'grupo_whatsapp', label: 'Convite do grupo do WhatsApp', group: 'Cobrança',
    valor: (i) => {
      if (!i.quitado || i.tipo !== 'acampante') return '';
      return i.grupo?.em ? `Enviado ${dataHoraBR(i.grupo.em)} · ${i.grupo.por}` : 'Falta enviar';
    } },
];

// Marcadas ao abrir o exportar.
export const COLUNAS_PAGAMENTOS_PADRAO = [
  'situacao', 'nome', 'cpf', 'tipo', 'whatsapp', 'igreja', 'forma', 'pago_em', 'valor',
];

// Catalogo na ordem em que as colunas saem no arquivo. As do botao "Colunas"
// da tela vem de COLUMN_DEFINITIONS (mesmas chaves do valorDaColuna).
export const catalogoPagamentos = (valorDe) => {
  const daTela = COLUMN_DEFINITIONS.pagamentos.map((d) => ({
    key: d.key,
    label: d.label,
    group: d.group,
    valor: d.key === 'cpf'
      ? (i) => (i.cpf ? formatCPF(i.cpf) : '(sem CPF)')
      : (i) => valorDe(i, d.key),
  }));
  const pagamento = daTela.filter((c) => c.group === 'Pagamento');
  const resto = daTela.filter((c) => c.group !== 'Pagamento');
  const [situacao, dataHora, desconto, obs, ...cobranca] = EXTRAS;
  return [situacao, ...resto, ...pagamento, dataHora, desconto, obs, ...cobranca];
};

export const AGRUPAMENTOS = [
  ['nenhum', 'Lista única'],
  ['igreja', 'Por igreja'],
  ['forma', 'Por forma de pagamento'],
  ['tipo', 'Por tipo (acampante / equipante)'],
  ['situacao', 'Por situação (pagou / não pagou)'],
];

const chaveDoGrupo = (item, agrupar, valorDe) => {
  if (agrupar === 'situacao') return item.quitado ? 'Pagaram' : 'Não pagaram';
  return valorDe(item, agrupar) || 'Sem informação';
};

const resumoDe = (itens, valorDe) => {
  const soma = (lista) => lista.reduce((t, i) => t + (i.quitado && Number(i.valor_pago) > 0 ? Number(i.valor_pago) : 0), 0);
  const bloco = (titulo, chaveFn) => {
    const m = new Map();
    itens.forEach((i) => { const k = chaveFn(i); m.set(k, [...(m.get(k) || []), i]); });
    return [...m.entries()].sort((a, b) => ptBR(a[0], b[0])).map(([k, lista]) => ({
      Resumo: titulo, Item: k, Quantidade: lista.length, 'Valor recebido (R$)': soma(lista),
    }));
  };
  return [
    { Resumo: 'Geral', Item: 'Todos', Quantidade: itens.length, 'Valor recebido (R$)': soma(itens) },
    ...bloco('Situação', (i) => (i.quitado ? 'Pagaram' : 'Não pagaram')),
    ...bloco('Tipo', (i) => valorDe(i, 'tipo')),
    ...bloco('Forma de pagamento', (i) => valorDe(i, 'forma')),
  ];
};

/**
 * Monta {grupos:[{nome, linhas:[[texto...]]}], resumo} ja na ordem de saida.
 * Dentro de cada grupo, ordem alfabetica pelo nome.
 */
export const montarExportacao = ({ itens, colunas, agrupar, valorDe }) => {
  const ordenados = [...itens].sort((a, b) => ptBR(a.nome || '', b.nome || ''));
  const paraLinha = (i) => colunas.map((c) => c.valor(i));
  let grupos;
  if (agrupar === 'nenhum') {
    grupos = [{ nome: '', itens: ordenados }];
  } else {
    const m = new Map();
    ordenados.forEach((i) => {
      const k = chaveDoGrupo(i, agrupar, valorDe);
      m.set(k, [...(m.get(k) || []), i]);
    });
    grupos = [...m.entries()].sort((a, b) => ptBR(a[0], b[0])).map(([nome, lista]) => ({ nome, itens: lista }));
  }
  return {
    grupos: grupos.map((g) => ({ nome: g.nome, itens: g.itens, linhas: g.itens.map(paraLinha) })),
    resumo: resumoDe(ordenados, valorDe),
  };
};

const nomeDeAba = (nome, usados) => {
  const base = (String(nome).replace(/[\\/?*[\]:]/g, ' ').trim() || 'Pagamentos').slice(0, 28);
  let n = base; let k = 2;
  while (usados.has(n.toLowerCase())) { n = `${base.slice(0, 26)} ${k}`; k += 1; }
  usados.add(n.toLowerCase());
  return n;
};

const hoje = () => new Date().toISOString().split('T')[0];

export const exportarPagamentosExcel = (dados, colunas, comResumo) => {
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  const idxValor = colunas.findIndex((c) => c.key === 'valor');
  const idxDesc = colunas.findIndex((c) => c.key === 'desconto');
  dados.grupos.forEach((g) => {
    const aoa = [colunas.map((c) => c.label), ...g.linhas];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Valor pago em numero (para somar na planilha): "R$ 120,00" vira 120.
    g.itens.forEach((it, r) => {
      if (idxValor >= 0) {
        const cel = ws[XLSX.utils.encode_cell({ r: r + 1, c: idxValor })];
        if (cel && it.quitado && Number.isFinite(Number(it.valor_pago)) && it.valor_pago !== null) {
          cel.t = 'n'; cel.v = Number(it.valor_pago); cel.z = '"R$" #,##0.00';
        }
      }
      if (idxDesc >= 0) {
        const cel = ws[XLSX.utils.encode_cell({ r: r + 1, c: idxDesc })];
        if (cel && typeof cel.v === 'number') cel.z = '"R$" #,##0.00';
      }
    });
    ws['!cols'] = colunas.map((c, ci) => ({
      wch: Math.min(45, Math.max(c.label.length, ...g.linhas.slice(0, 200).map((l) => String(l[ci] ?? '').length), 10) + 2),
    }));
    XLSX.utils.book_append_sheet(wb, ws, nomeDeAba(g.nome || 'Pagamentos', usados));
  });
  if (comResumo) {
    const ws = XLSX.utils.json_to_sheet(dados.resumo);
    ws['!cols'] = [{ wch: 20 }, { wch: 34 }, { wch: 12 }, { wch: 20 }];
    dados.resumo.forEach((_, r) => { const c = ws[XLSX.utils.encode_cell({ r: r + 1, c: 3 })]; if (c) c.z = '"R$" #,##0.00'; });
    XLSX.utils.book_append_sheet(wb, ws, nomeDeAba('Resumo', usados));
  }
  XLSX.writeFile(wb, `Pagamentos_Metanoia_Radical_${hoje()}.xlsx`);
};

const VERDE = [0x9b, 0xbb, 0x59];
const VERDE_CLARO = [0xea, 0xf1, 0xdd];
const M = 28;

/** PDF em A4 paisagem: tabela com as colunas escolhidas, cabecalho repetido em cada pagina. */
export const exportarPagamentosPdf = async (dados, colunas, comResumo, tituloLista) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const fonte = await carregarFonte(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const largura = W - 2 * M;
  const limite = H - M - 10;
  const tam = colunas.length > 12 ? 6.5 : colunas.length > 8 ? 7.5 : 9;
  const LH = tam * 1.25;
  const PAD = 3;
  let y = M;

  const todasLinhas = dados.grupos.flatMap((g) => g.linhas);
  doc.setFont(fonte, 'normal');
  doc.setFontSize(tam);
  // Largura de cada coluna: a do maior texto (limitado), depois ajustada para caber na pagina.
  const natural = colunas.map((c, ci) => {
    doc.setFont(fonte, 'bold');
    let m = doc.getTextWidth(c.label) * 0.7;
    doc.setFont(fonte, 'normal');
    todasLinhas.slice(0, 400).forEach((l) => { m = Math.max(m, doc.getTextWidth(String(l[ci] ?? ''))); });
    return Math.min(Math.max(m, 28), 170) + 2 * PAD;
  });
  const soma = natural.reduce((t, n) => t + n, 0);
  const larguras = natural.map((n) => (n * largura) / soma);

  const novaPagina = () => { doc.addPage(); y = M; };
  const garantir = (h) => { if (y + h > limite) { novaPagina(); return true; } return false; };

  const faixa = (texto, tamanho, altura, cor = VERDE) => {
    garantir(altura + 40);
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

  const cabecalhoTabela = () => {
    doc.setFont(fonte, 'bold');
    doc.setFontSize(tam);
    const partes = colunas.map((c, ci) => doc.splitTextToSize(c.label, larguras[ci] - 2 * PAD));
    const h = Math.max(...partes.map((p) => p.length)) * LH + 2 * PAD;
    doc.setFillColor(...VERDE_CLARO);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.4);
    doc.rect(M, y, largura, h, 'FD');
    let x = M;
    partes.forEach((p, ci) => {
      doc.setTextColor(0, 0, 0);
      doc.text(p, x + PAD, y + PAD + tam, { lineHeightFactor: 1.25 });
      x += larguras[ci];
    });
    y += h;
    return h;
  };

  const desenharTabela = (linhas) => {
    garantir(40);
    cabecalhoTabela();
    linhas.forEach((l, r) => {
      doc.setFont(fonte, 'normal');
      doc.setFontSize(tam);
      const partes = l.map((v, ci) => doc.splitTextToSize(String(v ?? ''), larguras[ci] - 2 * PAD));
      const h = Math.max(...partes.map((p) => p.length)) * LH + 2 * PAD;
      if (garantir(h)) cabecalhoTabela();
      if (r % 2 === 1) { doc.setFillColor(246, 246, 246); doc.rect(M, y, largura, h, 'F'); }
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(M, y + h, M + largura, y + h);
      let x = M;
      partes.forEach((p, ci) => {
        doc.setTextColor(0, 0, 0);
        doc.setFont(fonte, 'normal');
        doc.setFontSize(tam);
        doc.text(p, x + PAD, y + PAD + tam, { lineHeightFactor: 1.25 });
        x += larguras[ci];
      });
      y += h;
    });
  };

  const total = todasLinhas.length;
  faixa('PAGAMENTOS — METANOIA RADICAL', 14, 22);
  doc.setFont(fonte, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`${tituloLista} · ${total} ${total === 1 ? 'pessoa' : 'pessoas'} · gerado em ${new Date().toLocaleDateString('pt-BR')}`, M, y + 13);
  y += 22;

  dados.grupos.forEach((g, gi) => {
    if (g.nome) {
      if (gi > 0) novaPagina();
      faixa(`${g.nome} (${g.linhas.length})`, 11, 18, VERDE_CLARO);
      y += 4;
    }
    desenharTabela(g.linhas);
    y += 10;
  });

  if (comResumo) {
    novaPagina();
    faixa('RESUMO', 12, 20);
    y += 6;
    const cab = ['Resumo', 'Item', 'Quantidade', 'Valor recebido'];
    const lw = [120, 260, 90, 120];
    const desenharResumo = () => {
      doc.setFont(fonte, 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.setFillColor(...VERDE_CLARO); doc.rect(M, y, lw.reduce((a, b) => a + b, 0), 16, 'F');
      let x = M; cab.forEach((t, i) => { doc.text(t, x + 4, y + 11); x += lw[i]; });
      y += 16;
    };
    desenharResumo();
    dados.resumo.forEach((r) => {
      if (garantir(15)) desenharResumo();
      doc.setFont(fonte, 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      const vals = [r.Resumo, r.Item, String(r.Quantidade),
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r['Valor recebido (R$)'])];
      let x = M; vals.forEach((t, i) => { doc.text(String(t), x + 4, y + 11, { maxWidth: lw[i] - 8 }); x += lw[i]; });
      y += 15;
    });
  }

  // numeracao das paginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    doc.setFont(fonte, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`${p} / ${paginas}`, W - M, H - 12, { align: 'right' });
  }

  await entregarArquivo(doc.output('blob'), `Pagamentos_Metanoia_Radical_${hoje()}.pdf`);
};
