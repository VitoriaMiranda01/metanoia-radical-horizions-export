
import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Search, CheckCircle, AlertCircle, RefreshCw, Banknote, X } from 'lucide-react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useEdition } from '@/contexts/EditionContext';

const PagamentosPendentes = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [processingId, setProcessingId] = useState(null);

  // Inline Confirmation State
  const [confirmingId, setConfirmingId] = useState(null);
  const {
    toast
  } = useToast();
  const {
    selectedEdition
  } = useEdition();

  const fetchData = async () => {
    if (!selectedEdition) {
      console.log('[Pagamentos Pendentes] Nenhuma edição selecionada ainda.');
      return;
    }
    setLoading(true);
    setError(null);
    console.log(`[Pagamentos Pendentes] Buscando dados para a edição: ${selectedEdition}`);
    try {
      // 1. Fetch Acampantes for the selected edition with manual payment method
      const {
        data: acampantesData,
        error: acampantesError
      } = await supabase.from('acampantes').select('id, nome, nome_completo, cpf, created_at, status_pagamento, forma_pagamento, metodo_pagamento, status, telefone, cidade, igreja').eq('numero_edicao', selectedEdition).eq('metodo_pagamento', 'manual');
      if (acampantesError) {
        console.error('[Pagamentos Pendentes] Erro Supabase (acampantes):', acampantesError);
        throw acampantesError;
      }

      // 2. Fetch Equipantes for the selected edition with manual payment method
      const {
        data: equipantesData,
        error: equipantesError
      } = await supabase.from('equipantes').select('id, nome, full_name, nome_completo, cpf, created_at, status_pagamento, forma_pagamento, metodo_pagamento, status, telefone, whatsapp, cidade, igreja, nome_igreja').eq('numero_edicao', selectedEdition).eq('metodo_pagamento', 'manual');
      if (equipantesError) {
        console.error('[Pagamentos Pendentes] Erro Supabase (equipantes):', equipantesError);
        throw equipantesError;
      }

      // 3. Normalize and combine data
      const mappedAcampantes = (acampantesData || []).map(item => ({
        id: item.id,
        nome: item.nome_completo || item.nome || 'Sem Nome',
        cpf: item.cpf || 'Não informado',
        telefone: item.telefone || 'Não informado',
        cidade: item.cidade || 'Não informada',
        igreja: item.igreja || 'Não informada',
        tipo: 'acampante',
        data_inscricao: item.created_at,
        status_pagamento: (item.status_pagamento || 'pendente').toLowerCase(),
        metodo: (item.metodo_pagamento || item.forma_pagamento || '').toLowerCase()
      }));
      const mappedEquipantes = (equipantesData || []).map(item => ({
        id: item.id,
        nome: item.full_name || item.nome_completo || item.nome || 'Sem Nome',
        cpf: item.cpf || 'Não informado',
        telefone: item.telefone || item.whatsapp || 'Não informado',
        cidade: item.cidade || 'Não informada',
        igreja: item.igreja || item.nome_igreja || 'Não informada',
        tipo: 'equipante',
        data_inscricao: item.created_at,
        status_pagamento: (item.status_pagamento || 'pendente').toLowerCase(),
        metodo: (item.metodo_pagamento || item.forma_pagamento || '').toLowerCase()
      }));
      const allData = [...mappedAcampantes, ...mappedEquipantes];

      // 4. Sort by date (newest first)
      allData.sort((a, b) => new Date(b.data_inscricao) - new Date(a.data_inscricao));
      setData(allData);
    } catch (err) {
      console.error('[Pagamentos Pendentes] Erro ao buscar dados:', err);
      setError('Falha ao carregar inscrições. Verifique sua conexão.');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as inscrições com pagamento manual.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedEdition]);

  const confirmDarBaixa = async (id, tipo) => {
    setProcessingId(id);
    try {
      const table = tipo === 'acampante' ? 'acampantes' : 'equipantes';
      const {
        error
      } = await supabase.from(table).update({
        status_pagamento: 'confirmado',
        data_pagamento: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      toast({
        title: 'Sucesso',
        description: 'Pagamento confirmado com sucesso!',
        className: 'bg-emerald-600 text-white border-none'
      });
      setData(prev => prev.map(item => item.id === id ? {
        ...item,
        status_pagamento: 'confirmado'
      } : item));
      setConfirmingId(null);
    } catch (err) {
      console.error('Error updating payment:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao confirmar pagamento.',
        variant: 'destructive'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.nome.toLowerCase().includes(filterText.toLowerCase()) || item.cpf.includes(filterText);
      const matchesTab = activeTab === 'all' || item.tipo === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [data, filterText, activeTab]);

  return <Layout>
      <Helmet>
        <title>Pagamentos Pendentes - Metanoia Radical</title>
      </Helmet>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <motion.div initial={{
        opacity: 0,
        y: -20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Banknote className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Pagamentos Manuais</h1>
          </div>
          <p className="text-gray-400">
            Gerencie e confirme os pagamentos manuais {selectedEdition ? `na Edição ${selectedEdition}` : ''}.
          </p>
        </motion.div>

        {error ? <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar dados</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent h-11">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div> : <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="bg-black/60 glass-effect rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-white/10 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto flex">
                  <TabsTrigger value="all" className="flex-1 md:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">Todos ({data.length})</TabsTrigger>
                  <TabsTrigger value="acampante" className="flex-1 md:flex-none data-[state=active]:bg-green-600/20 data-[state=active]:text-green-400 text-gray-400">Acampantes</TabsTrigger>
                  <TabsTrigger value="equipante" className="flex-1 md:flex-none data-[state=active]:bg-red-600/20 data-[state=active]:text-red-400 text-gray-400">Equipantes</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Buscar por nome ou CPF..." value={filterText} onChange={e => setFilterText(e.target.value)} className="pl-9 h-11 bg-white/5 border-white/10 text-white w-full placeholder:text-gray-500 focus-visible:ring-blue-500" />
              </div>
            </div>

            {/* Mobile View - Cards (visible only < md) */}
            <div className="md:hidden flex flex-col gap-4 p-4">
              {loading ? <div className="text-center text-gray-400 py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Buscando pagamentos da edição {selectedEdition}...
                </div> : filteredData.length === 0 ? <div className="text-center text-gray-400 py-8">
                  Nenhuma inscrição com pagamento manual encontrada.
                </div> : filteredData.map(item => <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col gap-4 relative overflow-hidden">
                    {/* decorative accent line */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${item.tipo === 'acampante' ? 'bg-green-500' : 'bg-red-500'}`} />
                    
                    <div className="flex justify-between items-start gap-2 pl-2">
                      <h3 className="font-semibold text-white text-lg leading-tight break-words pr-2">
                        {item.nome}
                      </h3>
                      <Badge variant="outline" className={`capitalize shrink-0 border-none ${item.tipo === 'acampante' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {item.tipo}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1.5 text-sm text-gray-400 pl-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-500">CPF:</span>
                        <span className="text-gray-300">{item.cpf}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10 mt-2">
                      {item.status_pagamento === 'confirmado' || item.status_pagamento === 'pago' ? <Button disabled className="w-full h-11 bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Confirmado
                        </Button> : confirmingId === item.id ? <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                          <span className="text-sm text-gray-300 text-center font-medium">Tem certeza que deseja confirmar?</span>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setConfirmingId(null)} disabled={processingId === item.id} className="flex-1 h-11 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5">
                              Cancelar
                            </Button>
                            <Button onClick={() => confirmDarBaixa(item.id, item.tipo)} disabled={processingId === item.id} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white">
                              {processingId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                            </Button>
                          </div>
                        </div> : <Button onClick={() => setConfirmingId(item.id)} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">Dar Baixa</Button>}
                    </div>
                  </div>)}
            </div>

            {/* Desktop View - Table (hidden < md) */}
            <div className="hidden md:block p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-300">CPF</TableHead>
                    <TableHead className="text-gray-300">Nome do Participante</TableHead>
                    <TableHead className="text-gray-300">Tipo</TableHead>
                    <TableHead className="text-gray-300">Data Inscrição</TableHead>
                    <TableHead className="text-right text-gray-300">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Buscando pagamentos da edição {selectedEdition}...
                      </TableCell>
                    </TableRow> : filteredData.length === 0 ? <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                        Nenhuma inscrição com pagamento manual encontrada para os filtros atuais.
                      </TableCell>
                    </TableRow> : filteredData.map(item => <TableRow key={item.id} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="text-gray-400">
                          {item.cpf}
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {item.nome}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize border-none ${item.tipo === 'acampante' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {new Date(item.data_inscricao).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status_pagamento === 'confirmado' || item.status_pagamento === 'pago' ? <Button size="sm" disabled className="bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed hover:bg-white/5">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Confirmado
                            </Button> : confirmingId === item.id ? <div className="flex items-center justify-end gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                              <span className="text-sm text-gray-400 mr-2 font-medium">Confirmar?</span>
                              <Button size="sm" variant="outline" onClick={() => setConfirmingId(null)} disabled={processingId === item.id} className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={() => confirmDarBaixa(item.id, item.tipo)} disabled={processingId === item.id} className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                                {processingId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'OK'}
                              </Button>
                            </div> : <Button size="sm" onClick={() => setConfirmingId(item.id)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">
                              Dar Baixa
                            </Button>}
                        </TableCell>
                      </TableRow>)}
                </TableBody>
              </Table>
            </div>
          </motion.div>}
      </div>
    </Layout>;
};

export default PagamentosPendentes;
