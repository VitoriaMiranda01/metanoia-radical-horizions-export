import * as XLSX from 'xlsx';
import { formatCPF } from '@/utils/formatters';

// Helper to set column widths and styling
const configureWorksheet = (ws) => {
  ws['!cols'] = [
    { wch: 40 }, // Nome
    { wch: 18 }, // CPF
    { wch: 35 }, // Igreja
    { wch: 25 }, // Área (optional)
  ];
  return ws;
};

// Export equipantes for a specific area
export const exportEquipantesByArea = (areaName, equipantes) => {
  if (!equipantes || equipantes.length === 0) {
    throw new Error('Nenhum equipante para exportar.');
  }

  const data = equipantes.map(eq => ({
    'Nome': eq.nome || '-',
    'CPF': formatCPF(eq.cpf || ''),
    'Igreja': eq.igreja || '-'
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
      'Igreja': eq.igreja || '-'
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
    'Igreja': eq.igreja || '-'
  }));
  
  const wsAll = XLSX.utils.json_to_sheet(allData);
  configureWorksheet(wsAll);
  XLSX.utils.book_append_sheet(wb, wsAll, 'Geral');

  XLSX.writeFile(wb, 'Escala_Geral.xlsx');
  
  return true;
};


// Exporta acampantes para Excel. Recebe linhas ja formatadas -- uma chave
// por coluna marcada em "Colunas" (na mesma ordem exibida na tabela), mais
// os registros ja filtrados pela busca/filtros da tela. Ver handleExport em
// AcampantesTable.jsx, que monta essas linhas a partir de filteredData +
// visibleColumns -- assim a exportacao reflete exatamente o que esta
// selecionado e visivel no momento do clique, em vez de uma lista fixa de
// colunas independente do que o usuario escolheu ver.
export const exportAcampantesToExcel = (rows) => {
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

    XLSX.utils.book_append_sheet(wb, ws, "Acampantes");

    const fileName = `acampantes_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao exportar:', error);
    return { success: false, error: error.message };
  }
};
