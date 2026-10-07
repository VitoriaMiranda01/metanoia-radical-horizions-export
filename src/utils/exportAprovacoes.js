import * as XLSX from 'xlsx';
import { formatCPF } from '@/utils/formatters';
import { formatarTelefone, digitosTelefone } from '@/utils/telefone';
import { nomeDaIgreja } from '@/constants/igrejas';

/**
 * Exportacao da tela de Aprovacao de Equipantes, por igreja (Patrick,
 * 07/10/2026): a organizacao baixa a lista de quem esta pendente numa igreja
 * e manda para ela cobrar as aprovacoes.
 *
 * Pode ir mais de uma igreja (ou todas): o arquivo traz a aba "Todas" e uma aba
 * por igreja, para a organizacao separar o que mandar a cada uma.
 *
 * Os formatos de saida ficam todos em FORMATOS. Hoje so existe a planilha;
 * para acrescentar o PDF basta incluir aqui um item com `gerar` -- a janela
 * (ExportarAprovacoesDialog) lista o que estiver neste objeto.
 */

export const SEM_IGREJA = '(sem igreja informada)';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** A igreja como aparece na lista; quem nao informou cai em SEM_IGREJA. */
export const igrejaDaLinha = (item) => nomeDaIgreja(item)?.trim() || SEM_IGREJA;

/** [{ igreja, quantidade }] em ordem alfabetica (o numero na frente ordena como na lista oficial). */
export const igrejasComInscritos = (dados) => {
  const contagem = new Map();
  (dados || []).forEach((item) => {
    const igreja = igrejaDaLinha(item);
    contagem.set(igreja, (contagem.get(igreja) || 0) + 1);
  });
  return [...contagem.entries()]
    .map(([igreja, quantidade]) => ({ igreja, quantidade }))
    .sort((a, b) => a.igreja.localeCompare(b.igreja, 'pt-BR', { numeric: true }));
};

const dataBR = (valor) => (valor ? new Date(valor).toLocaleDateString('pt-BR') : '-');

// Numero de 10/11 digitos vira (24) 99999-9999; qualquer outro (estrangeiro)
// vai como foi gravado, para nao cortar digito.
const telefoneLegivel = (valor) => {
  if (!valor) return '-';
  const digitos = digitosTelefone(valor);
  return digitos.length === 10 || digitos.length === 11 ? formatarTelefone(digitos) : String(valor);
};

const SITUACAO = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };

const linhaDaPlanilha = (item) => ({
  'Nome': item.nome || '-',
  'CPF': item.cpf ? formatCPF(item.cpf) : '(sem CPF)',
  'WhatsApp': telefoneLegivel(item.whatsapp),
  'Igreja': igrejaDaLinha(item),
  'Pastor': item.pastor_nome || '-',
  'Inscrito em': dataBR(item.created_at),
  'Situação': SITUACAO[item.status] || item.status || '-',
});

const nomeDoArquivo = (prefixo, igrejas, todas) => {
  const hoje = new Date().toISOString().split('T')[0];
  if (todas) return `${prefixo}_todas_as_igrejas_${hoje}`;
  if (igrejas.length > 1) return `${prefixo}_${igrejas.length}_igrejas_${hoje}`;
  const limpa = norm(igrejas[0]).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  return `${prefixo}_${limpa || 'igreja'}_${hoje}`;
};

// Nome de aba: ate 31 caracteres, sem \ / ? * [ ] :, e unico no arquivo.
const nomeDeAba = (texto, usados) => {
  const base = texto.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31) || 'Igreja';
  let nome = base;
  for (let n = 2; usados.has(nome.toLowerCase()); n += 1) {
    nome = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
  }
  usados.add(nome.toLowerCase());
  return nome;
};

const planilhaDe = (linhas) => {
  const dados = [...linhas]
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
    .map(linhaDaPlanilha);
  const ws = XLSX.utils.json_to_sheet(dados);
  ws['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 18 }, { wch: 45 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
  ws['!autofilter'] = { ref: `A1:G${dados.length + 1}` };
  return ws;
};

const gerarExcel = ({ igrejas, linhas, situacao, todas }) => {
  const prefixo = ({
    pendente: 'Equipantes_pendentes',
    aprovado: 'Equipantes_aprovados',
    rejeitado: 'Equipantes_rejeitados',
  })[situacao] || 'Equipantes';

  const wb = XLSX.utils.book_new();
  const usados = new Set();

  if (igrejas.length === 1) {
    XLSX.utils.book_append_sheet(wb, planilhaDe(linhas), nomeDeAba(SITUACAO[situacao] || 'Equipantes', usados));
  } else {
    XLSX.utils.book_append_sheet(wb, planilhaDe(linhas), nomeDeAba('Todas', usados));
    igrejas.forEach((igreja) => {
      const dela = linhas.filter((item) => igrejaDaLinha(item) === igreja);
      XLSX.utils.book_append_sheet(wb, planilhaDe(dela), nomeDeAba(igreja, usados));
    });
  }

  XLSX.writeFile(wb, `${nomeDoArquivo(prefixo, igrejas, todas)}.xlsx`);
};

export const FORMATOS = {
  excel: { rotulo: 'Excel (.xlsx)', gerar: gerarExcel },
};

/**
 * Gera o arquivo das igrejas escolhidas. `dados` e a lista inteira da aba
 * aberta (sem os filtros da tabela: o que vale aqui e a escolha da janela).
 * `todas`: a pessoa marcou "todas as igrejas". Devolve quantas linhas foram.
 */
export const exportarAprovacoes = ({ dados, igrejas, todas = false, formato = 'excel', situacao }) => {
  const saida = FORMATOS[formato];
  if (!saida) throw new Error('Formato de saída não disponível.');

  const escolhidas = new Set(igrejas || []);
  const linhas = (dados || []).filter((item) => escolhidas.has(igrejaDaLinha(item)));
  if (linhas.length === 0) throw new Error('Não há inscrições para exportar nas igrejas escolhidas.');

  // Na ordem da lista, so as que tem gente.
  const ordem = igrejasComInscritos(linhas).map((i) => i.igreja);
  saida.gerar({ igrejas: ordem, linhas, situacao, todas });
  return { linhas: linhas.length, igrejas: ordem.length };
};
