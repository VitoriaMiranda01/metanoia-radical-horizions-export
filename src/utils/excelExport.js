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


// Exporta acampantes para Excel
export const exportAcampantesToExcel = (acampantes) => {
  try {
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    };

    const formatBool = (val) => val ? 'Sim' : 'Não';
    
    const formatCPF = (cpf) => {
      if (!cpf) return '';
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    };

    const dataToExport = acampantes.map(a => ({
      'ID': a.id,
      'Nome': a.nome_completo || a.nome,
      'CPF': formatCPF(a.cpf),
      'WhatsApp': a.whatsapp,
      'Data Nascimento': formatDate(a.data_nascimento),
      'Gênero': a.genero,
      'Estado Civil': a.estado_civil,
      'Profissão': a.profissao,
      'Tamanho Camisa': a.tamanho_camisa,
      'Problema de Saúde': formatBool(a.tem_problema_saude),
      'Usa Medicamento': formatBool(a.usa_medicamento),
      'Status': a.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Auto-adjust column widths
    const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({
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
