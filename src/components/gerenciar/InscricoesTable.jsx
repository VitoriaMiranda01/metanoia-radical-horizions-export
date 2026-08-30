import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Eye, Trash2, Download, Search, Filter, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import ColumnVisibilityDropdown from '@/components/gerenciar/ColumnVisibilityDropdown';
import { 
  getVisibleColumnsFromStorage, 
  saveVisibleColumnsToStorage,
  COLUMN_DEFINITIONS,
  formatEnderecoCompleto,
  formatAreaTrabalho
} from '@/utils/columnVisibility';

const getStatusBadge = (status) => {
  const variants = {
    pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    aprovado: 'bg-green-500/20 text-green-400 border-green-500/50',
    rejeitado: 'bg-red-500/20 text-red-400 border-red-500/50',
  };
  const labels = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
  };
  
  const className = `border ${variants[status] || variants.pendente}`;
  return <Badge className={className} variant="outline">{labels[status] || status}</Badge>;
};

const formatarData = (dataString) => {
  if (!dataString) return '';
  return new Date(dataString).toLocaleDateString('pt-BR');
};

const getColumnValue = (item, filterKey) => {
  if (filterKey === 'endereco_completo') {
    return formatEnderecoCompleto(item);
  }
  if (filterKey === 'area_trabalho') {
    return formatAreaTrabalho(item);
  }
  if (filterKey === 'created_at') {
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
      <span className="text-white font-medium whitespace-nowrap">{title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-8 w-8 p-0 ml-2 relative transition-colors", 
              isActive 
                ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 opacity-100" 
                : "text-slate-400 hover:text-white hover:bg-white/10 opacity-100"
            )}
          >
            <Filter className="h-4 w-4" />
            {isActive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white ring-2 ring-slate-900">
                {selectedValues.length}
              </span>
            )}
            <span className="sr-only">Filtrar {title}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-zinc-900 border-white/20 max-h-80 overflow-y-auto z-50 p-1 shadow-xl">
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
                className="h-5 text-[10px] text-red-300 hover:text-red-200 hover:bg-red-500/20 px-2 rounded-full"
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

const InscricoesTable = ({ dados, tipo = 'equipantes', onSelect, onExcluir, onExportar, searchTerm, onSearchChange }) => {
  const [filters, setFilters] = useState({});
  const [visibleColumns, setVisibleColumns] = useState([]);
  
  const safeTipo = tipo === 'acampantes' ? 'acampantes' : 'equipantes';

  useEffect(() => {
    const loadedColumns = getVisibleColumnsFromStorage(safeTipo);
    setVisibleColumns(loadedColumns);
  }, [safeTipo]);

  const handleSaveColumns = (newColumns) => {
    setVisibleColumns(newColumns);
    saveVisibleColumnsToStorage(safeTipo, newColumns);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(vals => vals && vals.length > 0);

  const filteredData = useMemo(() => {
    return dados.filter(item => {
      // Global Search
      const searchLower = searchTerm.toLowerCase();
      const searchFields = [
        item.nome,
        item.cpf,
        item.email,
        item.whatsapp,
        item.telefone,
        item.cidade,
        item.igreja,
        item.status,
        item.grupo_trailha,
        item.responsavel_nome
      ];
      
      const matchesSearch = searchFields.some(field => 
        (field || '').toLowerCase().includes(searchLower)
      );

      if (!matchesSearch) return false;

      // Column Filters
      return Object.keys(filters).every(key => {
        const selectedValues = filters[key];
        if (!selectedValues || selectedValues.length === 0) return true;

        const itemValue = getColumnValue(item, key);
        return selectedValues.includes(itemValue);
      });
    });
  }, [dados, filters, searchTerm]);
  
  const getColDef = (key) => {
    const defs = COLUMN_DEFINITIONS[safeTipo] || [];
    return defs.find(c => c.key === key);
  };

  const renderCellContent = (item, key) => {
    if (key === 'status') return getStatusBadge(item.status);
    if (key === 'endereco_completo') return formatEnderecoCompleto(item) || '-';
    if (key === 'area_trabalho') return formatAreaTrabalho(item) || '-';
    if (key === 'created_at') return formatarData(item[key]);
    if (typeof item[key] === 'boolean') return item[key] ? 'Sim' : 'Não';
    return item[key] || '-';
  };

  return (
    <Card className="glass-effect border-white/20">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span className="capitalize">{safeTipo}</span>
              </CardTitle>
              <CardDescription className="text-blue-200">{dados.length} registros</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters} 
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Limpar Filtros
                  </Button>
                )}
                <div className="hidden md:block">
                  <ColumnVisibilityDropdown 
                    type={safeTipo}
                    currentColumns={visibleColumns}
                    onApply={handleSaveColumns}
                  />
                </div>
                <Button onClick={() => onExportar(tipo)} variant="outline" size="sm" className="bg-white/5 text-white hover:bg-white/10 border-white/20">
                  <Download className="w-4 h-4 mr-2" />Exportar
                </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              type="text"
              placeholder="Buscar por CPF, Nome, Igreja..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-blue-500 h-11"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="text-center py-12 text-white/70">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum registro encontrado</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-white/50 flex flex-col items-center justify-center border border-white/10 rounded-lg bg-black/20">
            <Filter className="w-12 h-12 mb-3 opacity-20" />
            <p>Nenhum resultado encontrado para os filtros aplicados.</p>
            {hasActiveFilters && (
              <Button variant="link" onClick={clearAllFilters} className="text-blue-400 mt-2 h-11">
                Limpar todos os filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View - Cards (< md) */}
            <div className="flex md:hidden flex-col gap-4">
              {filteredData.map((item) => (
                <div key={item.id} className="bg-white/5 border border-white/10 shadow-sm rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden transition-all hover:bg-white/10">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-semibold text-white text-lg leading-tight break-words">
                      {item.nome}
                    </h3>
                    <div className="shrink-0 mt-0.5">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 text-sm text-gray-300">
                    {item.email && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium text-gray-500 shrink-0">Email:</span>
                        <span className="text-gray-200 truncate text-right">{item.email}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-gray-500 shrink-0">Telefone:</span>
                      <span className="text-gray-200 text-right">{item.telefone || item.whatsapp || 'Não informado'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-gray-500 shrink-0">Cidade:</span>
                      <span className="text-gray-200 text-right truncate">{item.cidade || 'Não informada'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex gap-3 mt-auto">
                    <Button
                      variant="outline"
                      onClick={() => onSelect(item)}
                      className="flex-1 min-h-[44px] bg-transparent border-white/10 text-blue-300 hover:text-white hover:bg-blue-500/20 transition-colors shadow-sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onExcluir(item)}
                      className="flex-1 min-h-[44px] bg-transparent border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View - Table (md+) */}
            <div className="hidden md:block overflow-x-auto relative rounded-md border border-white/10">
              <Table>
                <TableHeader className="bg-zinc-900-900/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-900-900/50">
                  <TableRow className="hover:bg-transparent border-white/10">
                    {/* Fixed Name Column */}
                    <TableHead className="min-w-[200px] h-12 sticky left-0 z-20 bg-zinc-900 border-r border-white/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                      <ColumnHeader 
                        title="Nome" 
                        filterKey="nome" 
                        filters={filters} 
                        handleFilterChange={handleFilterChange} 
                        data={dados} 
                      />
                    </TableHead>

                    {/* Dynamic Columns */}
                    {visibleColumns.map(colKey => {
                      if (colKey === 'nome') return null;
                      const def = getColDef(colKey);
                      return (
                        <TableHead key={colKey} className="min-w-[150px] h-12 bg-zinc-900">
                            <ColumnHeader 
                              title={def ? def.label : colKey} 
                              filterKey={colKey} 
                              filters={filters} 
                              handleFilterChange={handleFilterChange} 
                              data={dados} 
                            />
                        </TableHead>
                      );
                    })}

                        <TableHead className="text-white text-right h-12 sticky right-0 z-20 bg-zinc-900 border-l border-white/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-white/5 transition-colors border-white/10 group">
                      <TableCell className="text-white font-medium sticky left-0 z-10 bg-zinc-900 group-hover:bg-zinc-900-900 border-r border-white/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                          {item.nome}
                      </TableCell>

                      {visibleColumns.map(colKey => {
                        if (colKey === 'nome') return null;
                        return (
                          <TableCell key={colKey} className="text-white/80 whitespace-nowrap">
                            {renderCellContent(item, colKey)}
                          </TableCell>
                        );
                      })}
                      
                      <TableCell className="sticky right-0 z-10 bg-zinc-900 group-hover:bg-zinc-900-900 border-l border-white/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => onSelect(item)} className="hover:bg-blue-500/20 text-blue-300 transition-colors">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onExcluir(item.id)} className="hover:bg-red-500/20 text-red-300 transition-colors">
                            <Trash2 className="w-4 h-4" />
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

export default InscricoesTable;