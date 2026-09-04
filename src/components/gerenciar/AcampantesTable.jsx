import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Trash2, Search, RefreshCw, UserCheck, Download, Filter, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { exportAcampantesToExcel } from '@/utils/excelExport';
import { useToast } from '@/components/ui/use-toast';
import { cn } from "@/lib/utils";
import ColumnVisibilityDropdown from '@/components/gerenciar/ColumnVisibilityDropdown';
import { 
  getVisibleColumnsFromStorage, 
  saveVisibleColumnsToStorage,
  COLUMN_DEFINITIONS,
  formatEnderecoCompleto
} from '@/utils/columnVisibility';

const formatarData = (dataString) => {
  if (!dataString) return '';
  return new Date(dataString).toLocaleDateString('pt-BR');
};

const getColumnValue = (item, filterKey) => {
  if (filterKey === 'endereco_completo') {
    return formatEnderecoCompleto(item);
  }
  if (filterKey === 'data_pagamento') {
    return formatarData(item[filterKey]);
  }
  if (typeof item[filterKey] === 'boolean') {
    return item[filterKey] ? 'Sim' : 'Não';
  }
  return String(item[filterKey] || '');
};

const ColumnHeader = ({ title, filterKey, filters, handleFilterChange, data }) => {
  const selectedValues = filters[filterKey] || [];
  const isActive = selectedValues.length > 0;

  const uniqueValues = useMemo(() => {
    const values = new Set();
    data.forEach(item => {
      const val = getColumnValue(item, filterKey);
      if (val) values.add(val);
    });
    return Array.from(values).sort();
  }, [data, filterKey]);

  const toggleValue = (value) => {
    const current = [...selectedValues];
    const index = current.indexOf(value);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }
    handleFilterChange(filterKey, current);
  };

  const clearFilter = () => {
    handleFilterChange(filterKey, []);
  };

  return (
    <div className="flex items-center h-full">
      <span className="text-white font-medium whitespace-nowrap text-xs md:text-sm">{title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-6 w-6 md:h-8 md:w-8 p-0 ml-1 md:ml-2 relative transition-colors", 
              isActive 
                ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 opacity-100" 
                : "text-slate-400 hover:text-white hover:bg-white/10 opacity-100"
            )}
          >
            <Filter className="h-3 w-3 md:h-4 md:w-4" />
            {isActive && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 md:h-3 md:w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] md:text-[9px] font-bold text-white ring-1 md:ring-2 ring-slate-900">
                {selectedValues.length}
              </span>
            )}
            <span className="sr-only">Filtrar {title}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-black border-white/20 max-h-80 overflow-y-auto z-50 p-1 shadow-xl">
          <DropdownMenuLabel className="flex justify-between items-center text-white px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filtrar por {title}</span>
            {isActive && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.preventDefault();
                  clearFilter();
                }} 
                className="h-5 text-[10px] text-red-300 hover:text-red-200 hover:bg-black/20 px-2 rounded-full"
              >
                Limpar
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10 my-1" />
          {uniqueValues.length === 0 ? (
            <div className="p-4 text-xs text-white/40 text-center italic">Sem opções disponíveis</div>
          ) : (
            <div className="space-y-0.5">
              {uniqueValues.map((value) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={selectedValues.includes(value)}
                  onCheckedChange={() => toggleValue(value)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-white/90 text-sm focus:text-white focus:bg-white/10 rounded-sm cursor-pointer data-[state=checked]:bg-blue-500/20 data-[state=checked]:text-blue-200 pl-8"
                >
                  {value}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const AcampantesTable = ({ 
  data, 
  loading, 
  onViewDetails, 
  onDelete 
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [filters, setFilters] = useState({});

  useEffect(() => {
    // Coluna "status" removida das opcoes de acampantes em 2026-09-01 (ver
    // COLUMN_DEFINITIONS.acampantes em columnVisibility.js) -- filtra aqui
    // tambem pra usuarios que tinham essa coluna salva no localStorage antes
    // dessa mudanca, pra ela realmente sumir da tabela.
    const loadedColumns = getVisibleColumnsFromStorage('acampantes').filter(c => c !== 'status');
    setVisibleColumns(loadedColumns);
  }, []);

  const handleSaveColumns = (newColumns) => {
    setVisibleColumns(newColumns);
    saveVisibleColumnsToStorage('acampantes', newColumns);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(vals => vals && vals.length > 0);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Global Search
      const searchLower = searchTerm.toLowerCase();
      
      const searchFields = [
        item.nome, item.cpf, item.email, item.whatsapp, 
        item.cidade, item.estado, item.igreja, 
        item.admin_responsavel, item.quem_indicou_nome
      ];

      const matchesSearch = searchFields.some(field => 
        (field || '').toLowerCase().includes(searchLower)
      );
      
      if (!matchesSearch) return false;

      // 2. Column Specific Filters
      return Object.keys(filters).every(key => {
        const selectedValues = filters[key];
        if (!selectedValues || selectedValues.length === 0) return true;

        const itemValue = getColumnValue(item, key);
        return selectedValues.includes(itemValue);
      });
    });
  }, [data, searchTerm, filters]);

  const handleExport = () => {
    if (filteredData.length === 0) {
      toast({
        title: "Nada para exportar",
        description: "Não há dados visíveis para exportar.",
        variant: "warning"
      });
      return;
    }
    
    const result = exportAcampantesToExcel(filteredData);
    if (result.success) {
      toast({
        title: "Sucesso",
        description: "Acampantes exportados com sucesso!"
      });
    } else {
      toast({
        title: "Erro",
        description: "Falha ao exportar arquivo.",
        variant: "destructive"
      });
    }
  };

  const getColDef = (key) => COLUMN_DEFINITIONS.acampantes.find(c => c.key === key);

  const renderCellContent = (item, key) => {
    if (key === 'endereco_completo') return formatEnderecoCompleto(item) || '-';
    if (typeof item[key] === 'boolean') return item[key] ? 'Sim' : 'Não';
    return item[key] || '-';
  };

  return (
    <Card className="bg-black/60 glass-effect border-white/10">
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <CardTitle className="text-white flex items-center space-x-2 text-lg md:text-xl">
              <UserCheck className="w-4 h-4 md:w-5 md:h-5" />
              <span>Acampantes</span>
            </CardTitle>
            <CardDescription className="text-blue-200 text-xs md:text-sm">
              Gerencie os acampantes registrados
            </CardDescription>
          </div>
          <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-1 md:gap-2 w-full md:w-auto">
              {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters} 
                    className="text-red-400 hover:text-red-300 hover:bg-black/10 border border-red-500/20 text-xs md:text-sm h-8 md:h-9"
                  >
                    <X className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                    Limpar Filtros
                  </Button>
              )}
              {/* Responsive: Hidden on mobile, shown on desktop */}
              <div className="hidden md:contents">
                <ColumnVisibilityDropdown 
                  type="acampantes"
                  currentColumns={visibleColumns}
                  onApply={handleSaveColumns}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExport}
                  className="bg-white/5 text-white hover:bg-white/10 hover:text-white border-white/20 text-xs md:text-sm h-8 md:h-9"
                >
                  <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Exportar
                </Button>
              </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 mt-2 md:mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 md:w-4 md:h-4 text-white/50" />
            <Input
              type="text"
              placeholder="Buscar por CPF, Nome, Igreja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 md:pl-10 h-9 md:h-10 text-xs md:text-sm bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-2 md:p-6">
        {loading && data.length === 0 ? (
            <div className="flex justify-center items-center py-8 md:py-12">
              <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-blue-400 animate-spin" />
            </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8 md:py-12 text-white/50">
            <div className="flex flex-col items-center justify-center">
              <Filter className="w-8 h-8 md:w-12 md:h-12 mb-2 md:mb-3 opacity-20" />
              <p className="text-xs md:text-base">Nenhum acampante encontrado para os filtros aplicados.</p>
              <Button variant="link" onClick={clearAllFilters} className="text-blue-400 mt-1 md:mt-2 text-xs md:text-sm">
                Limpar todos os filtros
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile View (Cards) */}
            <div className="md:hidden flex flex-col gap-4">
              {filteredData.map((item) => (
                <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden flex flex-col">
                  <div className="p-4 flex-1">
                    <h3 className="font-bold text-white text-lg leading-tight break-words mb-4">
                      {item.nome}
                    </h3>
                    
                    <div className="space-y-2">
                      {visibleColumns.filter(col => col !== 'nome').map(colKey => {
                        const def = getColDef(colKey);
                        return (
                          <div key={colKey} className="flex justify-between items-center gap-4 text-sm">
                            <span className="text-gray-400 font-medium shrink-0">{def ? def.label : colKey}:</span>
                            <span className="text-gray-200 truncate">{renderCellContent(item, colKey)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="bg-black/20 p-3 flex gap-2 border-t border-white/10">
                    <Button 
                      variant="outline" 
                      onClick={() => onViewDetails(item)}
                      className="flex-1 h-11 bg-transparent border-white/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizar
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => onDelete(item)}
                      className="flex-1 h-11 bg-transparent border-white/20 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto relative scroll-smooth">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="hover:bg-transparent border-white/10">
                        <TableHead className="text-white md:sticky md:left-0 md:z-20 min-w-[140px] md:min-w-[200px] md:bg-neutral-900 p-2 md:p-4">
                      <ColumnHeader 
                        title="Nome" 
                        filterKey="nome" 
                        filters={filters} 
                        handleFilterChange={handleFilterChange} 
                        data={data} 
                      />
                    </TableHead>
                    
                    {visibleColumns.map(colKey => {
                      if (colKey === 'nome') return null;
                      const def = getColDef(colKey);
                      return (
                        <TableHead key={colKey} className="text-white whitespace-nowrap min-w-[120px] md:min-w-[150px] p-2 md:p-4">
                          <ColumnHeader 
                            title={def ? def.label : colKey} 
                            filterKey={colKey} 
                            filters={filters} 
                            handleFilterChange={handleFilterChange} 
                            data={data} 
                          />
                        </TableHead>
                      );
                    })}
                    
                        <TableHead className="text-right text-white sticky right-0 z-20 bg-neutral-900 p-2 md:p-4 text-xs md:text-sm">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-white/5 border-white/10 transition-colors group">
                      <TableCell className="font-medium text-white md:sticky md:left-0 md:z-10 md:bg-black md:group-hover:bg-neutral-900 p-2 md:p-4 text-xs md:text-sm">
                        {item.nome}
                      </TableCell>
                      
                      {visibleColumns.map(colKey => {
                        if (colKey === 'nome') return null;
                        return (
                          <TableCell key={colKey} className="text-gray-300 whitespace-nowrap p-2 md:p-4 text-xs md:text-sm">
                            {renderCellContent(item, colKey)}
                          </TableCell>
                        );
                      })}
                      
                      <TableCell className="text-right sticky right-0 z-10 bg-black group-hover:bg-neutral-900 p-2 md:p-4">
                        <div className="flex justify-end gap-1 md:gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onViewDetails(item)}
                            className="hover:bg-blue-500/20 text-blue-300 transition-colors h-7 w-7 md:h-8 md:w-8 p-0"
                          >
                            <Eye className="w-3 h-3 md:w-4 md:h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onDelete(item.id)}
                            className="hover:bg-red-500/20 text-red-300 transition-colors h-7 w-7 md:h-8 md:w-8 p-0"
                          >
                            <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AcampantesTable;