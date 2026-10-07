import * as XLSX from 'xlsx';
import { formatCPF } from '@/utils/formatters';
import { formatarTelefone, digitosTelefone } from '@/utils/telefone';
import { nomeDaIgreja } from '@/constants/igrejas';

/**
 * Exportacao da tela de Aprovacao de Equipantes, por igreja (Patrick,
 * 07/10/2026): a organizacao baixa a lista de quem esta pendente numa igreja
 * e manda para ela cobrar as aprovacoes.
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

const nomeDoArquivo = (prefixo, igreja) => {
  const igrejaLimpa = norm(igreja).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  const hoje = new Date().toISOString().split('T')[0];
  return `${prefixo}_${igrejaLimpa || 'igreja'}_${hoje}`;
};

const gerarExcel = ({ igreja, linhas, situacao }) => {
  const prefixo = ({
    pendente: 'Equipantes_pendentes',
    aprovado: 'Equipantes_aprovados',
    rejeitado: 'Equipantes_rejeitados',
  })[situacao] || 'Equipantes';

  const dados = [...linhas]
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
    .map(linhaDaPlanilha);

  const ws = XLSX.utils.json_to_sheet(dados);
  ws['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 18 }, { wch: 45 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
  ws['!autofilter'] = { ref: `A1:G${dados.length + 1}` };

  const wb = XLSX.utils.book_new();
  // Nome de aba: ate 31 caracteres e sem \ / ? * [ ] :
  XLSX.utils.book_append_sheet(wb, ws, (SITUACAO[situacao] || 'Equipantes').replace(/[\\/?*[\]:]/g, ''));
  XLSX.writeFile(wb, `${nomeDoArquivo(prefixo, igreja)}.xlsx`);
};

export const FORMATOS = {
  excel: { rotulo: 'Excel (.xlsx)', gerar: gerarExcel },
};

/**
 * Gera o arquivo da igreja escolhida. `dados` e a lista inteira da aba aberta
 * (sem os filtros da tabela: o que vale aqui e a igreja escolhida na janela).
 * Devolve quantas linhas foram para o arquivo.
 */
export const exportarAprovacoesDaIgreja = ({ dados, igreja, formato = 'excel', situacao }) => {
  const saida = FORMATOS[formato];
  if (!saida) throw new Error('Formato de saída não disponível.');

  const linhas = (dados || []).filter((item) => igrejaDaLinha(item) === igreja);
  if (linhas.length === 0) throw new Error('Não há inscrições dessa igreja para exportar.');

  saida.gerar({ igreja, linhas, situacao });
  return linhas.length;
};
