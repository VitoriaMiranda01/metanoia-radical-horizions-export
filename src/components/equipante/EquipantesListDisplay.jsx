import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, User, Calendar, Church } from 'lucide-react';
import { format } from 'date-fns';
import ColumnVisibilityDropdown from '@/components/gerenciar/ColumnVisibilityDropdown';
import { 
  getVisibleColumnsFromStorage, 
  saveVisibleColumnsToStorage,
  COLUMN_DEFINITIONS
} from '@/lib/columnVisibilityHelpers';

const EquipantesListDisplay = ({ equipantes }) => {
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadedColumns = getVisibleColumnsFromStorage('equipantes');
    setVisibleColumns(loadedColumns);
  }, []);

  const handleSaveColumns = (newColumns) => {
    setVisibleColumns(newColumns);
    saveVisibleColumnsToStorage('equipantes', newColumns);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'aprovado': return 'success';
      case 'pendente': return 'warning';
      case 'rejeitado': return 'destructive';
      default: return 'secondary';
    }
  };

  // CRITICAL: Filter to ensure ONLY tipo='equipante' records are displayed
  // This is a safety check - the data should already be filtered at query level
  const equipantesOnly = (equipantes || []).filter(item => item.tipo === 'equipante');

  const filteredEquipantes = equipantesOnly.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const searchFields = [
      item.nome, item.email, item.cpf, item.whatsapp, 
      item.cidade, item.igreja, item.area_trabalho_opcao1
    ];
    return searchFields.some(field => (field || '').toLowerCase().includes(searchLower));
  });

  const getColumnContent = (equipante, key) => {
     // Specific styling for common fields
     if (key === 'email') return (
        <div className="flex items-center gap-2" title="Email">
            <Mail className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate" title={equipante.email}>{equipante.email || 'Email não informado'}</span>
        </div>
     );
     if (key === 'whatsapp' || key === 'telefone') return (
        <div className="flex items-center gap-2" title="Telefone">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <span>{equipante.whatsapp || equipante.telefone_residencial || 'Telefone não informado'}</span>
        </div>
     );
     if (key === 'cidade') return (
        <div className="flex items-center gap-2" title="Cidade">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>
              {equipante.cidade ? `${equipante.cidade}, ${equipante.estado}` : 'Localização não informada'}
            </span>
        </div>
     );
     if (key === 'igreja') return (
        <div className="flex items-center gap-2" title="Igreja">
            <Church className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate" title={equipante.igreja}>{equipante.igreja || '-'}</span>
        </div>
     );

     // Generic fallback
     const def = COLUMN_DEFINITIONS.equipantes.find(d => d.key === key);
     const label = def ? def.label : key;
     let val = equipante[key];
     
     if (typeof val === 'boolean') val = val ? 'Sim' : 'Não';
     if (!val) val = '-';
     if (key.includes('data') || key === 'created_at') {
         val = val !== '-' ? new Date(val).toLocaleDateString('pt-BR') : '-';
     }

     return (
       <div className="flex flex-col text-xs mt-2 border-l-2 border-white/10 pl-2">
         <span className="text-gray-500 uppercase text-[10px]">{label}</span>
         <span className="text-gray-200">{val}</span>
       </div>
     );
  };

  if (!equipantes || equipantes.length === 0 || equipantesOnly.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10 mt-8">
        <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
          <User className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">Nenhum equipante encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              type="text"
              placeholder="Buscar por nome, email, CPF, cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <ColumnVisibilityDropdown 
            type="equipantes"
            currentColumns={visibleColumns}
            onApply={handleSaveColumns}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEquipantes.length === 0 ? (
             <div className="col-span-full text-center py-12 text-gray-400">
                <p className="text-lg">Nenhum equipante corresponde à busca.</p>
             </div>
        ) : (
            filteredEquipantes.map((equipante, index) => (
            <motion.div
                key={equipante.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="h-full"
            >
                <Card className="h-full bg-black/40 border-white/10 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 flex flex-col">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                    <div>
                        <CardTitle className="text-xl font-semibold text-white mb-1 truncate max-w-[200px]" title={equipante.nome}>
                        {equipante.nome || 'Sem Nome'}
                        </CardTitle>
                        <CardDescription className="text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {equipante.created_at ? format(new Date(equipante.created_at), 'dd/MM/yyyy') : 'Data N/A'}
                        </CardDescription>
                    </div>
                    <Badge variant={getStatusColor(equipante.status)}>
                        {equipante.status || 'Pendente'}
                    </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-gray-300 flex-grow pt-2">
                    {visibleColumns.map(colKey => {
                        if (['status', 'created_at', 'nome'].includes(colKey)) return null;
                        return (
                            <div key={colKey}>
                            {getColumnContent(equipante, colKey)}
                            </div>
                        );
                    })}
                </CardContent>
                <CardFooter className="pt-2 pb-6 mt-auto">
                    <div className="w-full text-xs text-gray-500 border-t border-white/10 pt-4 mt-2">
                    ID: {equipante.id?.toString().slice(0, 8)}...
                    </div>
                </CardFooter>
                </Card>
            </motion.div>
            ))
        )}
      </div>
    </>
  );
};

export default EquipantesListDisplay;