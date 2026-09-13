import * as XLSX from 'xlsx';
import { formatCPF } from '@/utils/formatters';

// Helper to set column widths and styling
const configureWorksheet = (ws) => {
  ws['!cols'] = [
    { wch: 40 }, // Nome
    { wch: 18 }, // CPF
    { wch: 35 }, // Igreja
    { wch: 25 }, // Atuação / Área
    { wch: 25 }, // Atuação (na aba Geral, que tem Área antes)
    { wch: 12 }, // Cor do grupo
  ];
  return ws;
};

// A planilha oficial das edicoes 33/35/36 tem NOME | IGREJA | ATUACAO -- a
// atuacao (a funcao da pessoa dentro da area: Líder, Fila / Confronto,
// Traficante...) e o que faltava aqui. Ver
// database/migrations/schema-update-20260912e-atuacoes-e-areas-da-diretoria.sql.

// Export equipantes for a specific area
export const exportEquipantesByArea = (areaName, equipantes) => {
  if (!equipantes || equipantes.length === 0) {
    throw new Error('Nenhum equipante para exportar.');
  }

  const data = equipantes.map(eq => ({
    'Nome': eq.nome || '-',
    'CPF': formatCPF(eq.cpf || ''),
    'Igreja': eq.igreja || '-',
    'Atuação': eq.atuacao || '-',
    'Cor': eq.cor || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  configureWorksheet(ws);

  const wb = XLSX.utils.book_new();
  
  // Sheet names cannot exceed 31 characters and shouldn't have invalid chars
  const safeSheetName = areaName.substring(0, 31).replace(/[\\/?*\[\]]/g, '');
  
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Escala');
  
  const safeFileName = `Escala_${areaName.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, safeFileName);
  
  return true;
};

// Export all equipantes grouped by area (multiple sheets)
export const exportAllEquipantes = (allocations) => {
  if (!allocations || allocations.length === 0) {
    throw new Error('Nenhuma alocação para exportar.');
  }

  const wb = XLSX.utils.book_new();

  // Group by area
  const grouped = allocations.reduce((acc, curr) => {
    const area = curr.allocatedArea || 'Sem Área';
    if (!acc[area]) acc[area] = [];
    acc[area].push(curr);
    return acc;
  }, {});

  // Create a sheet for each area
  Object.keys(grouped).forEach(areaName => {
    const data = grouped[areaName].map(eq => ({
      'Nome': eq.nome || '-',
      'CPF': formatCPF(eq.cpf || ''),
      'Igreja': eq.igreja || '-',
      'Atuação': eq.atuacao || '-',
      'Cor': eq.cor || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    configureWorksheet(ws);

    const safeSheetName = areaName.substring(0, 31).replace(/[\\/?*\[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Sheet');
  });

  // Also create a "Geral" sheet with everyone
  const allData = allocations.map(eq => ({
    'Área': eq.allocatedArea || 'Sem Área',
    'Nome': eq.nome || '-',
    'CPF': formatCPF(eq.cpf || ''),
    'Igreja': eq.igreja || '-',
    'Atuação': eq.atuacao || '-',
    'Cor': eq.cor || '-'
  }));
  
  const wsAll = XLSX.utils.json_to_sheet(allData);
  configureWorksheet(wsAll);
  XLSX.utils.book_append_sheet(wb, wsAll, 'Geral');

  XLSX.writeFile(wb, 'Escala_Geral.xlsx');
  
  return true;
};


// Escreve linhas ja formatadas (uma chave por coluna, ja no texto exibido)
// como um .xlsx de uma aba so. Usado tanto para acampantes quanto para
// equipantes -- ver exportAcampantesToExcel/exportEquipantesToExcel abaixo,
// chamadas pelo handleExport de AcampantesTable.jsx/InscricoesTable.jsx com
// as linhas ja montadas a partir de filteredData + visibleColumns (as
// colunas marcadas em "Colunas" e os registros ja filtrados na tela).
const exportRowsToExcel = (rows, { sheetName, fileNamePrefix }) => {
  try {
    if (!rows || rows.length === 0) {
      throw new Error('Nada para exportar.');
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-adjust column widths
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    return { success: true };
  } catch (error) {
    console.error('Erro ao exportar:', error);
    return { success: false, error: error.message };
  }
};

export const exportAcampantesToExcel = (rows) =>
  exportRowsToExcel(rows, { sheetName: 'Acampantes', fileNamePrefix: 'acampantes' });

export const exportEquipantesToExcel = (rows) =>
  exportRowsToExcel(rows, { sheetName: 'Equipantes', fileNamePrefix: 'equipantes_metanoia_radical' });

/**
 * A planilha do PORTÃO: todo mundo, com PAGOU ou NÃO PAGOU bem na cara.
 *
 * No dia do evento a conferência é feita na entrada, nome por nome. Por isso
 * esta lista traz TODOS -- não só quem pagou -- e a situação numa coluna só,
 * em maiúsculas, para dar para bater o olho e seguir a fila.
 *
 * Vem ordenada por nome. Duas abas: a geral e uma só com quem ainda não
 * pagou, que é a lista curta que interessa a quem está no portão.
 */
export const exportRelacaoPagamentos = (linhas) => {
  if (!linhas || linhas.length === 0) {
    throw new Error('Nenhuma inscrição para exportar.');
  }

  const paraLinha = (item) => ({
    'Situação': item.quitado ? 'PAGOU' : 'NÃO PAGOU',
    'Nome': item.nome || '-',
    'CPF': item.cpf ? formatCPF(item.cpf) : '(sem CPF)',
    'Tipo': item.tipo === 'acampante' ? 'Acampante' : 'Equipante',
    'Igreja': item.igreja || '-',
    'Forma de pagamento': ({
      pix: 'PIX',
      manual: 'Cartão / Dinheiro',
      isento: 'Isento',
    })[item.metodo_pagamento] || '-',
    'Data do pagamento': item.data_pagamento
      ? new Date(item.data_pagamento).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '-',
  });

  const larguras = [
    { wch: 12 }, // Situação
    { wch: 40 }, // Nome
    { wch: 18 }, // CPF
    { wch: 12 }, // Tipo
    { wch: 38 }, // Igreja
    { wch: 20 }, // Forma
    { wch: 18 }, // Data
  ];

  const wb = XLSX.utils.book_new();

  const wsTodos = XLSX.utils.json_to_sheet(linhas.map(paraLinha));
  wsTodos['!cols'] = larguras;
  XLSX.utils.book_append_sheet(wb, wsTodos, 'Conferência no portão');

  const faltando = linhas.filter((i) => !i.quitado);
  if (faltando.length > 0) {
    const wsFaltando = XLSX.utils.json_to_sheet(faltando.map(paraLinha));
    wsFaltando['!cols'] = larguras;
    XLSX.utils.book_append_sheet(wb, wsFaltando, 'Ainda não pagaram');
  }

  const hoje = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Pagamentos_Metanoia_Radical_${hoje}.xlsx`);

  return { total: linhas.length, pagaram: linhas.length - faltando.length };
};
