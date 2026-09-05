import React, { useState, useEffect } from 'react';
import { getEquipantesByWorkflowStage, updateWorkflowStage } from '@/services/equipantesService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';

const EquipanteWorkflowAdmin = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const data = await getEquipantesByWorkflowStage();
      setWorkflows(data || []);
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao carregar workflows', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleUpdateStatus = async (id, field, value) => {
    try {
      await updateWorkflowStage(id, { [field]: value });
      toast({ title: 'Sucesso', description: 'Status atualizado com sucesso' });
      fetchWorkflows();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao atualizar status', variant: 'destructive' });
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(workflows.map(w => ({
      Nome: w.nome,
      CPF: w.cpf,
      'Grupo (Idade)': (Number(w.idade) < 18) ? 'Menor' : 'Adulto',
      'Autorização Pais': w.parental_auth_file_url ? 'Enviado' : 'Pendente',
      'Status Aprovação': w.status,
      Pagamento: w.status_pagamento,
      Escala: w.scale_status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Workflows");
    XLSX.writeFile(wb, "equipantes_workflows.xlsx");
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Workflows dos Equipantes</h2>
        <Button onClick={exportToExcel} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      <div className="rounded-md border border-white/10 bg-black/40 overflow-x-auto">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow>
              <TableHead className="text-gray-300 md:sticky md:left-0 md:bg-slate-900 md:z-10 md:shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Equipante</TableHead>
              <TableHead className="text-gray-300">Faixa Etária</TableHead>
              <TableHead className="text-gray-300">Autorização Pais</TableHead>
              <TableHead className="text-gray-300">Status Aprovação</TableHead>
              <TableHead className="text-gray-300">Pagamento</TableHead>
              <TableHead className="text-gray-300">Escala</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((w) => {
              const isMinor = Number(w.idade) < 18;
              return (
              <TableRow key={w.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="font-medium text-white md:sticky md:left-0 md:bg-slate-900 md:z-10 md:shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                  {w.nome}
                  <div className="text-xs text-gray-500">{w.cpf}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={isMinor ? 'border-orange-500 text-orange-400' : 'border-blue-500 text-blue-400'}>
                    {isMinor ? 'Menor' : 'Adulto'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isMinor ? (
                    w.parental_auth_file_url ? (
                      <a href={w.parental_auth_file_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-400 hover:underline">
                        <FileText className="w-4 h-4 mr-1" /> Ver Arquivo
                      </a>
                    ) : (
                      <Badge className="workflow-badge-pendente">Pendente</Badge>
                    )
                  ) : (
                    <span className="text-gray-500 text-sm">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={
                    w.status === 'aprovado' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                    w.status === 'rejeitado' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                  }>
                    {w.status === 'aprovado' ? 'Aprovado' : w.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={`workflow-badge-${(w.status_pagamento === 'pago' || w.status_pagamento === 'confirmado') ? 'ok' : 'pendente'}`}>
                    {w.status_pagamento || 'pendente'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select 
                    value={w.scale_status || 'pendente'} 
                    onValueChange={(val) => handleUpdateStatus(w.id, 'scale_status', val)}
                  >
                    <SelectTrigger className="h-8 w-[130px] bg-transparent border-white/20 text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="ok">Escalado</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            )})}
            {workflows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">Nenhum workflow encontrado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EquipanteWorkflowAdmin;