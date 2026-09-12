import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  KeyRound, Search, RefreshCw, AlertCircle, AlertTriangle, CheckCircle,
  Lock, Unlock, Copy, Check, MessageSquare, X
} from 'lucide-react';
import Layout from '@/components/Layout';
import {
  listarContasParceiros,
  liberarPrimeiroAcesso,
  redefinirSenhaParceiro,
  descartarSolicitacaoSenha
} from '@/services/senhasParceirosService';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Paginacao, { usePaginacao } from '@/components/common/Paginacao';

// A MENSAGEM PRONTA (com a senha de primeiro acesso) vem montada do servidor,
// no campo "mensagem_pronta" de listar_contas_parceiros.
//
// Ela nao e montada aqui de proposito: a senha de primeiro acesso e uma
// formula, e montar a mensagem no navegador obrigaria essa formula a viajar
// dentro do JavaScript do site -- que qualquer visitante baixa. Seria repetir
// o erro que estamos consertando (a senha antiga vazou por estar escrita em
// arquivo publico). No servidor, so organizador enxerga.
const formatarData = (valor) => {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// Um botao que copia e confirma na propria etiqueta. No dia a dia o
// organizador copia varias mensagens seguidas -- sem esse retorno visual,
// e facil mandar a mensagem da igreja errada achando que copiou.
const BotaoCopiar = ({ texto, rotulo, icone: Icone = Copy, className = '' }) => {
  const [copiado, setCopiado] = useState(false);
  const { toast } = useToast();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // navigator.clipboard falha em conexao sem HTTPS e em alguns
      // navegadores antigos. Melhor dizer do que fingir que copiou.
      toast({
        title: 'Não consegui copiar',
        description: 'Selecione o texto e copie manualmente.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={copiar}
      className={`h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10 ${className}`}>
      {copiado
        ? <><Check className="w-4 h-4 mr-1.5 text-emerald-400" />Copiado</>
        : <><Icone className="w-4 h-4 mr-1.5" />{rotulo}</>}
    </Button>
  );
};

const SenhasParceirosPage = () => {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('todas');
  const [ocupado, setOcupado] = useState(null);          // codigo em processamento
  const [confirmandoNova, setConfirmandoNova] = useState(null); // codigo aguardando confirmacao
  const [senhaGerada, setSenhaGerada] = useState(null);   // { codigo, nome, senha }
  const { toast } = useToast();

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const dados = await listarContasParceiros();
      setContas(dados || []);
    } catch (err) {
      console.error('SenhasParceirosPage - carregar', err);
      setError('Não foi possível carregar as contas. Verifique sua conexão e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const totais = useMemo(() => ({
    total: contas.length,
    liberadas: contas.filter((c) => c.acesso_liberado).length,
    comSenhaPropria: contas.filter((c) => c.senha_definida).length,
    pedidos: contas.filter((c) => c.pedido_aberto_em).length,
  }), [contas]);

  const linhas = useMemo(() => {
    const texto = busca.trim().toLowerCase();
    return contas.filter((c) => {
      const casaBusca = !texto
        || String(c.nome || '').toLowerCase().includes(texto)
        || String(c.codigo || '').includes(texto);
      if (!casaBusca) return false;
      if (aba === 'pedidos') return !!c.pedido_aberto_em;
      if (aba === 'aguardando') return !c.acesso_liberado;
      if (aba === 'liberadas') return c.acesso_liberado && !c.senha_definida;
      if (aba === 'prontas') return c.senha_definida;
      return true;
    });
  }, [contas, busca, aba]);

  const paginacao = usePaginacao(linhas);

  const executar = async (codigo, acao) => {
    setOcupado(codigo);
    try {
      const resposta = await acao();
      if (resposta && resposta.ok === false) {
        toast({ title: 'Não deu certo', description: resposta.erro, variant: 'destructive' });
        return null;
      }
      await carregar();
      return resposta;
    } catch (err) {
      console.error('SenhasParceirosPage - ação', err);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível concluir. Tente de novo.',
        variant: 'destructive'
      });
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const alternarLiberacao = (conta) =>
    executar(conta.codigo, () => liberarPrimeiroAcesso(conta.codigo, !conta.acesso_liberado));

  const gerarNovaSenha = async (conta) => {
    setConfirmandoNova(null);
    const resposta = await executar(conta.codigo, () => redefinirSenhaParceiro(conta.codigo));
    if (resposta?.ok && resposta.senha) {
      setSenhaGerada({
        codigo: conta.codigo,
        nome: resposta.nome || conta.nome,
        senha: resposta.senha,
        mensagem: resposta.mensagem,
      });
    }
  };

  const descartarPedido = (conta) =>
    executar(conta.codigo, () => descartarSolicitacaoSenha(conta.codigo));

  const Situacao = ({ conta }) => {
    if (!conta.acesso_liberado) {
      return <Badge className="bg-gray-500/15 text-gray-300 border-gray-500/30 hover:bg-gray-500/15">Aguardando liberação</Badge>;
    }
    if (!conta.senha_definida) {
      return <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">Senha temporária</Badge>;
    }
    return <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15">Senha própria</Badge>;
  };

  const Acoes = ({ conta }) => {
    const processando = ocupado === conta.codigo;

    if (confirmandoNova === conta.codigo) {
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-gray-400 mr-1">Gerar nova senha?</span>
          <Button size="sm" variant="outline" disabled={processando}
            onClick={() => setConfirmandoNova(null)}
            className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button size="sm" disabled={processando} onClick={() => gerarNovaSenha(conta)}
            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white">
            {processando ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'OK'}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {/* Mensagem pronta de primeiro acesso: so faz sentido enquanto a
            igreja ainda nao criou a senha dela. */}
        {!conta.senha_definida && conta.mensagem_pronta && (
          <BotaoCopiar
            icone={MessageSquare}
            rotulo="Mensagem"
            texto={conta.mensagem_pronta}
          />
        )}

        <Button size="sm" variant="outline" disabled={processando}
          onClick={() => alternarLiberacao(conta)}
          className={`h-8 px-3 bg-transparent border-white/10 hover:bg-white/10 ${conta.acesso_liberado ? 'text-gray-300 hover:text-white' : 'text-emerald-300 hover:text-emerald-200 border-emerald-500/30'}`}>
          {processando
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : conta.acesso_liberado
              ? <><Lock className="w-4 h-4 mr-1.5" />Bloquear</>
              : <><Unlock className="w-4 h-4 mr-1.5" />Liberar</>}
        </Button>

        <Button size="sm" disabled={processando}
          onClick={() => setConfirmandoNova(conta.codigo)}
          className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
          <KeyRound className="w-4 h-4 mr-1.5" />
          Nova senha
        </Button>
      </div>
    );
  };

  return (
    <Layout>
      <Helmet>
        <title>Senhas dos Parceiros - Metanoia Radical</title>
      </Helmet>

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <KeyRound className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Senhas dos Parceiros</h1>
          </div>
          <p className="text-gray-400">
            Libere o acesso de cada igreja conforme for enviando a mensagem, e gere senha nova para quem esquecer.
          </p>
        </motion.div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { rotulo: 'Igrejas', valor: totais.total, cor: 'text-white' },
            { rotulo: 'Liberadas', valor: totais.liberadas, cor: 'text-emerald-400' },
            { rotulo: 'Já criaram senha', valor: totais.comSenhaPropria, cor: 'text-blue-400' },
            { rotulo: 'Pedindo senha', valor: totais.pedidos, cor: totais.pedidos > 0 ? 'text-amber-400' : 'text-gray-400' },
          ].map((item) => (
            <div key={item.rotulo} className="bg-black/60 glass-effect rounded-xl border border-white/10 p-4">
              <p className={`text-2xl font-bold ${item.cor}`}>{item.valor}</p>
              <p className="text-sm text-gray-400">{item.rotulo}</p>
            </div>
          ))}
        </div>

        {/* Senha recem-gerada: aparece UMA vez, para copiar e mandar. */}
        {senhaGerada && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-emerald-300 font-semibold">
                    Senha nova para {senhaGerada.codigo} — {senhaGerada.nome}
                  </p>
                  <p className="font-mono text-2xl text-white mt-2 tracking-wide break-all">
                    {senhaGerada.senha}
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    Anote ou copie agora: esta senha não aparece de novo. Se fechar sem copiar, é só gerar outra.
                  </p>
                  <p className="text-sm text-amber-300/90 mt-1">
                    Envie para o contato que você já conhece da igreja — nunca para quem pediu, se for um número desconhecido.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSenhaGerada(null)}
                className="text-gray-400 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <BotaoCopiar texto={senhaGerada.senha} rotulo="Copiar senha" />
              {senhaGerada.mensagem && (
                <BotaoCopiar
                  icone={MessageSquare}
                  rotulo="Copiar mensagem pronta"
                  texto={senhaGerada.mensagem}
                />
              )}
            </div>
          </motion.div>
        )}

        {/* Pedidos em aberto */}
        {totais.pedidos > 0 && aba !== 'pedidos' && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-semibold">
                {totais.pedidos} {totais.pedidos === 1 ? 'igreja pediu' : 'igrejas pediram'} uma senha nova
              </p>
              <p className="text-gray-300 mt-0.5">
                Veja na aba <button type="button" onClick={() => setAba('pedidos')} className="underline hover:text-white">Pedindo senha</button>.
              </p>
            </div>
          </motion.div>
        )}

        {error ? (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <Button onClick={carregar} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent h-11">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 glass-effect rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-white/10 flex flex-col gap-4">
              <Tabs value={aba} onValueChange={setAba}>
                <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto flex flex-wrap h-auto">
                  <TabsTrigger value="todas" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                    Todas ({totais.total})
                  </TabsTrigger>
                  <TabsTrigger value="pedidos" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-gray-400">
                    Pedindo senha ({totais.pedidos})
                  </TabsTrigger>
                  <TabsTrigger value="aguardando" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                    Aguardando liberação ({totais.total - totais.liberadas})
                  </TabsTrigger>
                  <TabsTrigger value="liberadas" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                    Senha temporária ({totais.liberadas - totais.comSenhaPropria})
                  </TabsTrigger>
                  <TabsTrigger value="prontas" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
                    Senha própria ({totais.comSenhaPropria})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou código da igreja"
                  className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                Carregando contas...
              </div>
            ) : linhas.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                {busca.trim() ? 'Nenhuma igreja encontrada com esse texto.' : 'Nenhuma igreja nesta situação.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400 w-20">Código</TableHead>
                        <TableHead className="text-gray-400">Igreja</TableHead>
                        <TableHead className="text-gray-400 w-48">Situação</TableHead>
                        <TableHead className="text-gray-400 w-44">Último acesso</TableHead>
                        <TableHead className="text-gray-400 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginacao.itensDaPagina.map((conta) => (
                        <TableRow key={conta.codigo} className="border-white/10 hover:bg-white/5">
                          <TableCell className="font-mono text-white">{conta.codigo}</TableCell>
                          <TableCell className="text-gray-200">
                            {conta.nome}
                            {/* Quem se apresentou pela igreja no primeiro
                                acesso. E a unica forma de conferir depois se
                                a pessoa certa pegou a conta certa. */}
                            {conta.responsavel_nome && (
                              <span className="block text-xs text-gray-500 mt-0.5">
                                primeiro acesso por <span className="text-gray-300">{conta.responsavel_nome}</span>
                                {conta.primeiro_acesso_em ? ` em ${formatarData(conta.primeiro_acesso_em)}` : ''}
                              </span>
                            )}
                            {conta.pedido_aberto_em && (
                              <span className="block text-xs text-amber-400 mt-0.5">
                                pediu senha nova em {formatarData(conta.pedido_aberto_em)}
                                {' · '}
                                <button
                                  type="button"
                                  onClick={() => descartarPedido(conta)}
                                  className="underline hover:text-amber-300"
                                >
                                  descartar
                                </button>
                              </span>
                            )}
                          </TableCell>
                          <TableCell><Situacao conta={conta} /></TableCell>
                          <TableCell className="text-gray-400 text-sm">{formatarData(conta.ultimo_acesso)}</TableCell>
                          <TableCell className="text-right"><Acoes conta={conta} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Paginacao {...paginacao} />
              </>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default SenhasParceirosPage;
