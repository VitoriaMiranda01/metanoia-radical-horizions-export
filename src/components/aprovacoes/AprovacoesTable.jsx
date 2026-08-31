import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Eye, CheckCircle, XCircle, Clock, Search, Filter, X } from 'lucide-react';
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
import InscricaoCard from '@/components/aprovacoes/InscricaoCard';
import { 
  getVisibleColumnsFromStorage, 
  saveVisibleColumnsToStorage,
  COLUMN_DEFINITIONS,
  formatEnderecoCompleto,
  formatAreaTrabalho
} from '@/utils/columnVisibility';

export const getStatusBadge = (status) => {
  const variants = {
    pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    aprovado: 'bg-green-500/20 text-green-400 border-green-500/50',
    rejeitado: 'bg-red-500/20 text-red-400 border-red-500/50',
  };
  const labels = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado'
  };
  
  const className = `border ${variants[status?.toLowerCase()] || 'bg-slate-500/20 text-slate-400 border-slate-500/50'}`;
  return <Badge className={className} variant="outline">{labels[status?.toLowerCase()] || status}</Badge>;
};

const formatarData = (dataString) => {
  if (!dataString) return '';
  return new Date(dataString).toLocaleDateString('pt-BR');
};

const getColumnValue = (item, key) => {
  if (key === 'endereco_completo') return formatEnderecoCompleto(item);
  if (key === 'area_trabalho') return formatAreaTrabalho(item);
  if (typeof item[key] === 'boolean') return item[key] ? 'Sim' : 'Não';
  return String(item[key] || '');
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

const AprovacoesTable = ({ 
  dados, 
  titulo, 
  onSelect, 
  onAprovar, 
  onRejeitar, 
  showActions = false, 
  onCancelar, 
  showCancelAction = false, 
  searchTerm, 
  onSearchChange
}) => {
  const [filters, setFilters] = useState({});
  const [visibleColumns, setVisibleColumns] = useState([]);
  
  const tableType = 'equipantes'; 

  // Load columns preference
  useEffect(() => {
    const loadedColumns = getVisibleColumnsFromStorage(tableType);
    setVisibleColumns(loadedColumns);
  }, []);

  const handleSaveColumns = (newColumns) => {
    setVisibleColumns(newColumns);
    saveVisibleColumnsToStorage(tableType, newColumns);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.values(filters).some(vals => vals && vals.length > 0);

  const filteredData = useMemo(() => {
    let data = dados;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(item => 
        (item.nome && item.nome.toLowerCase().includes(term)) ||
        (item.email && item.email.toLowerCase().includes(term)) ||
        (item.cidade && item.cidade.toLowerCase().includes(term)) ||
        (item.estado && item.estado.toLowerCase().includes(term)) ||
        (item.cpf && item.cpf.includes(term))
      );
    }

    return data.filter(item => {
      return Object.keys(filters).every(key => {
        const selectedValues = filters[key];
        if (!selectedValues || selectedValues.length === 0) return true;

        const itemValue = getColumnValue(item, key);
        return selectedValues.includes(itemValue);
      });
    });
  }, [dados, filters, searchTerm]);
  
  const getColDef = (key) => COLUMN_DEFINITIONS[tableType].find(c => c.key === key);

  return (
    <Card className="glass-effect border-white/20">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
               <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-white" />
                <CardTitle className="text-white">{titulo}</CardTitle>
              </div>
              <CardDescription className="text-blue-200 mt-1">
                {filteredData.length} registros encontrados
              </CardDescription>
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
                    type={tableType}
                    currentColumns={visibleColumns}
                    onApply={handleSaveColumns}
                  />
                </div>
            </div>
          </div>
          {/* Global Search Input controlled by parent */}
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
        {filteredData.length === 0 && dados.length === 0 ? (
          <div className="text-center py-8 text-white/70">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma inscrição encontrada</p>
          </div>
        ) : (
          <>
            {/* Mobile View - Cards (< md) */}
            <div className="block md:hidden flex flex-col gap-4">
              {filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-white/50 border border-white/10 rounded-lg bg-black/20">
                  <Filter className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-center">Nenhum resultado encontrado para os filtros aplicados.</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearAllFilters} className="text-blue-400 mt-2 h-11">
                      Limpar todos os filtros
                    </Button>
                  )}
                </div>
              ) : (
                filteredData.map((inscricao) => (
                  <InscricaoCard 
                    key={inscricao.id}
                    inscricao={inscricao}
                    statusBadge={getStatusBadge(inscricao.status)}
                    onSelect={onSelect}
                    onAprovar={onAprovar}
                    onRejeitar={onRejeitar}
                    showActions={showActions}
                    onCancelar={onCancelar}
                    showCancelAction={showCancelAction}
                  />
                ))
              )}
            </div>

            {/* Desktop View - Table (md+) */}
            <div className="hidden md:block overflow-x-auto relative rounded-md border border-white/10 max-h-[600px]">
              <Table>
                <TableHeader className="bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50 sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent border-white/10">
                    <TableHead className="min-w-[200px] h-12 sticky left-0 z-20 bg-zinc-900 border-r border-white/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                       <ColumnHeader 
                        title="Nome" 
                        filterKey="nome" 
                        filters={filters} 
                        handleFilterChange={handleFilterChange} 
                        data={dados} 
                      />
                    </TableHead>
                    
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
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + 2} className="text-center text-white/50 py-8">
                         <div className="flex flex-col items-center justify-center">
                          <Filter className="w-12 h-12 mb-3 opacity-20" />
                          <p>Nenhum resultado encontrado para os filtros aplicados.</p>
                          {hasActiveFilters && (
                            <Button variant="link" onClick={clearAllFilters} className="text-blue-400 mt-2">
                              Limpar todos os filtros
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((inscricao) => (
                      <TableRow key={inscricao.id} className="hover:bg-white/5 transition-colors border-white/10 group">
                        <TableCell className="text-white font-medium sticky left-0 z-10 bg-zinc-900 group-hover:bg-zinc-900 border-r border-white/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                            {inscricao.nome}
                        </TableCell>
                        
                        {visibleColumns.map(colKey => {
                          if (colKey === 'nome') return null;
                          return (
                            <TableCell key={colKey} className="text-white/80 whitespace-nowrap">
                              {colKey === 'status' ? getStatusBadge(inscricao.status) : getColumnValue(inscricao, colKey)}
                            </TableCell>
                          );
                        })}

                        <TableCell className="sticky right-0 z-10 bg-zinc-900 group-hover:bg-zinc-900 border-l border-white/10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => onSelect(inscricao)} className="hover:bg-blue-500/20 text-blue-300 transition-colors">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {showActions && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => onAprovar(inscricao.id)} className="hover:bg-green-500/20 text-green-300 transition-colors">
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => onRejeitar(inscricao.id)} className="hover:bg-red-500/20 text-red-300 transition-colors">
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {showCancelAction && (
                              <Button variant="ghost" size="sm" onClick={() => onCancelar(inscricao.id)} className="hover:bg-red-500/20 text-red-300 transition-colors" aria-label="Cancelar aprovação" title="Cancelar aprovação">
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AprovacoesTable;