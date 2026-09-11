import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Search, CheckCircle, AlertCircle, AlertTriangle, RefreshCw, Banknote, Gift } from 'lucide-react';
import Layout from '@/components/Layout';
import {
  fetchInscricoesNaoQuitadas,
  fetchPixTravados,
  confirmarPagamentoManual,
  isentarInscricao
} from '@/services/paymentService';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Paginacao, { usePaginacao } from '@/components/common/Paginacao';

const formatarValor = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
};

const PagamentosPendentesPage = () => {
  const [pendentes, setPendentes] = useState([]);
  const [travados, setTravados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [aba, setAba] = useState('pendentes');
  const [tipoFiltro, setTipoFiltro] = useState('all');
  const [processingId, setProcessingId] = useState(null);
  const [acaoPendente, setAcaoPendente] = useState(null); // { id, tipo, acao }
  const { toast } = useToast();

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [naoQuitadas, pixTravados] = await Promise.all([
        fetchInscricoesNaoQuitadas(),
        fetchPixTravados()
      ]);
      setPendentes(naoQuitadas);
      setTravados(pixTravados);
    } catch (err) {
      console.error('[Pagamentos] Erro ao carregar:', err);
      setError('Falha ao carregar os pagamentos. Verifique sua conexão.');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pagamentos.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const executarAcao = async (id, tipo, acao) => {
    setProcessingId(id);
    try {
      const { error: err } = acao === 'isentar'
        ? await isentarInscricao(tipo, id)
        : await confirmarPagamentoManual(tipo, id);

      if (err) throw err;

      toast({
        title: acao === 'isentar' ? 'Isenção registrada' : 'Pagamento liberado',
        description: acao === 'isentar'
          ? 'A inscrição foi marcada como isenta da taxa.'
          : 'A inscrição foi liberada com sucesso.',
        className: 'bg-emerald-600 text-white border-none'
      });

      setAcaoPendente(null);
      // Recarrega para que a pessoa saia das duas listas de uma vez.
      await carregar();
    } catch (err) {
      console.error('[Pagamentos] Erro ao liberar:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível concluir a operação.',
        variant: 'destructive'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const linhas = useMemo(() => {
    const base = aba === 'travados' ? travados : pendentes;
    const busca = filterText.trim().toLowerCase();

    return base.filter((item) => {
      const nome = String(item.nome || '').toLowerCase();
      const cpf = String(item.cpf || '');
      const casaBusca = !busca || nome.includes(busca) || cpf.includes(busca);
      const casaTipo = tipoFiltro === 'all' || item.tipo === tipoFiltro;
      return casaBusca && casaTipo;
    });
  }, [aba, travados, pendentes, filterText, tipoFiltro]);

  // Pagina a lista já filtrada. No dia do evento essa tela pode ter centenas
  // de pendentes — desenhar tudo de uma vez trava celular mais simples.
  const paginacao = usePaginacao(linhas);

  const Acoes = ({ item }) => {
    const emConfirmacao = acaoPendente?.id === item.id;
    const ocupado = processingId === item.id;
    const idInscricao = aba === 'travados' ? item.inscricao_id : item.id;

    if (!idInscricao) {
      return <span className="text-sm text-gray-500">Inscrição não localizada</span>;
    }

    if (emConfirmacao) {
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-gray-400 mr-1 font-medium">
            {acaoPendente.acao === 'isentar' ? 'Isentar da taxa?' : 'Liberar?'}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAcaoPendente(null)}
            disabled={ocupado}
            className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => executarAcao(idInscricao, item.tipo, acaoPendente.acao)}
            disabled={ocupado}
            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {ocupado ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'OK'}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAcaoPendente({ id: item.id, tipo: item.tipo, acao: 'isentar' })}
          className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10"
        >
          <Gift className="w-4 h-4 mr-1.5" />
          Isentar
        </Button>
        <Button
          size="sm"
          onClick={() => setAcaoPendente({ id: item.id, tipo: item.tipo, acao: 'liberar' })}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
        >
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Liberar
        </Button>
      </div>
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>Pagamentos - Metanoia Radical</title>
      </Helmet>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Banknote className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Pagamentos</h1>
          </div>
          <p className="text-gray-400">
            Libere quem pagou e registre isenções. Ninguém deve ficar pendente.
          </p>
        </motion.div>

        {travados.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-semibold">
                {travados.length} {travados.length === 1 ? 'cobrança precisa' : 'cobranças precisam'} de atenção
              </p>
              <p className="text-gray-300 mt-0.5">
                São PIX em que o dinheiro entrou (ou pode ter entrado) e a inscrição não liberou sozinha.
                Confira na aba <strong>Precisam de atenção</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {error ? (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar dados</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <Button onClick={carregar} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent h-11">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 glass-effect rounded-xl border border-white/10 overflow-hidden flex flex-col"
          >
            <div className="p-4 md:p-6 border-b border-white/10 flex flex-col gap-4">
              <Tabs value={aba} onValueChange={setAba}>
                <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto flex">
                  <TabsTrigger
                    value="pendentes"
                    className="flex-1 md:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400"
                  >
                    Pendentes ({pendentes.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="travados"
                    className="flex-1 md:flex-none data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-gray-400"
                  >
                    Precisam de atenção ({travados.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <Tabs value={tipoFiltro} onValueChange={setTipoFiltro} className="w-full md:w-auto">
                  <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto flex">
                    <TabsTrigger value="all" className="flex-1 md:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">Todos</TabsTrigger>
                    <TabsTrigger value="acampante" className="flex-1 md:flex-none data-[state=active]:bg-green-600/20 data-[state=active]:text-green-400 text-gray-400">Acampantes</TabsTrigger>
                    <TabsTrigger value="equipante" className="flex-1 md:flex-none data-[state=active]:bg-red-600/20 data-[state=active]:text-red-400 text-gray-400">Equipantes</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por CPF, Nome..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="pl-9 h-11 bg-white/5 border-white/10 text-white w-full placeholder:text-gray-500 focus-visible:ring-blue-500"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={carregar}
                    disabled={loading}
                    className="h-11 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5 shrink-0"
                    aria-label="Atualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-300">Nome</TableHead>
                    <TableHead className="text-gray-300">CPF</TableHead>
                    <TableHead className="text-gray-300">Tipo</TableHead>
                    <TableHead className="text-gray-300">
                      {aba === 'travados' ? 'Motivo' : 'Forma de pagamento'}
                    </TableHead>
                    <TableHead className="text-right text-gray-300">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Buscando pagamentos...
                      </TableCell>
                    </TableRow>
                  ) : linhas.length === 0 ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                        {aba === 'travados'
                          ? 'Nenhuma cobrança travada. Tudo certo por aqui.'
                          : 'Nenhuma inscrição pendente para os filtros atuais.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginacao.itensDaPagina.map((item) => (
                      <TableRow key={item.id} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium text-white">{item.nome}</TableCell>
                        <TableCell className="text-gray-400">{item.cpf}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize border-none ${item.tipo === 'acampante' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                          >
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {aba === 'travados' ? (
                            <div className="flex flex-col">
                              <span className={item.status === 'divergente' ? 'text-amber-400 font-medium' : 'text-gray-300'}>
                                {item.motivo}
                              </span>
                              <span className="text-gray-500 text-xs mt-0.5">
                                Cobrado: {formatarValor(item.valor)}
                              </span>
                            </div>
                          ) : (
                            <span className="capitalize text-gray-400">
                              {item.metodo_pagamento || 'não informado'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Acoes item={item} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Paginacao {...paginacao} />
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default PagamentosPendentesPage;
