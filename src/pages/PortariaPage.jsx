import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Banknote, CheckCircle2, CreditCard, DoorOpen, Loader2, LogOut, MessageSquare, RefreshCw, Search, Undo2, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import Layout from '@/components/Layout';
import { getAuthToken } from '@/services/authToken';
import {
  darBaixaPortaria, desfazerBaixaPortaria, fetchPortariaLista, fetchValorPrevisto, salvarObservacaoPortaria
} from '@/services/portariaService';

/**
 * Tela da portaria (login "Apoio", Patrick, 24/10/2026).
 *
 * Usada na sexta, sabado e domingo do evento, quase sempre no celular: cada
 * acampante e cada equipante da escala com nome completo, igreja e se o
 * pagamento esta pago ou em aberto. A portaria da baixa de quem paga na hora
 * (dinheiro ou cartao), desfaz so a baixa que ela mesma deu e escreve uma
 * observacao livre para a organizacao.
 *
 * Os dados vem de portaria_lista() -- a conta de apoio nao le nenhuma tabela
 * direto, e cada gravacao e conferida no banco. Organizador tambem abre esta
 * tela (botao "Portaria" de Configuracoes), dentro do painel.
 */

const POR_PAGINA = 50;
const ATUALIZAR_A_CADA_MS = 30000;

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const moeda = (v) => (v == null || v === '' ? '—'
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

const dataHora = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ehBaixaDaPortaria = (p) => p.pago && p.metodo === 'manual' && String(p.confirmado_por || '').startsWith('Portaria: ');

const NOME_MEIO = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };

// Texto da situacao do pagamento.
const situacao = (p) => {
  if (!p.pago) return { texto: 'Em aberto', classe: 'border-amber-500/40 bg-amber-500/15 text-amber-200' };
  if (p.metodo === 'isento') return { texto: 'Isento', classe: 'border-sky-500/40 bg-sky-500/15 text-sky-200' };
  if (p.metodo === 'pix') return { texto: 'Pago · PIX', classe: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' };
  const meio = NOME_MEIO[p.meio];
  return { texto: meio ? `Pago · ${meio}` : 'Pago', classe: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' };
};

const Chip = ({ ativo, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
      ativo ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

const Numero = ({ rotulo, valor, detalhe, cor = 'text-white' }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
    <p className="text-xs text-gray-400">{rotulo}</p>
    <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
    {detalhe && <p className="text-[11px] text-gray-500 mt-0.5">{detalhe}</p>}
  </div>
);

// ---- Janela de baixa ----------------------------------------------------------
const BaixaDialog = ({ pessoa, onFechar, onFeito, onErro }) => {
  const { toast } = useToast();
  const [meio, setMeio] = useState('');
  const [valor, setValor] = useState('');
  const [previsto, setPrevisto] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pessoa) return;
    setMeio('');
    setValor('');
    setPrevisto(null);
    let vivo = true;
    fetchValorPrevisto(pessoa.tipo, pessoa.id).then((r) => {
      if (!vivo || !r) return;
      setPrevisto(r);
      if (r.valor != null) setValor(String(Number(r.valor).toFixed(2)).replace('.', ','));
    });
    return () => { vivo = false; };
  }, [pessoa]);

  // "220,00" ou "1.220,50" (virgula decimal) e tambem "220.50" (ponto decimal).
  const valorTexto = String(valor).trim();
  const valorNumero = Number(valorTexto.includes(',') ? valorTexto.replace(/\./g, '').replace(',', '.') : valorTexto);
  const valorOk = Number.isFinite(valorNumero) && valorNumero > 0 && valorNumero <= 5000;

  const confirmar = async () => {
    if (!meio || !valorOk) return;
    setSalvando(true);
    try {
      await darBaixaPortaria(pessoa.tipo, pessoa.id, meio, valorNumero);
      toast({
        title: 'Baixa feita',
        description: `${pessoa.nome} · ${NOME_MEIO[meio]} · ${moeda(valorNumero)}`,
        className: 'bg-emerald-600 text-white',
      });
      onFeito();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
      onErro();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!pessoa} onOpenChange={(aberto) => { if (!aberto && !salvando) onFechar(); }}>
      <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Dar baixa no pagamento</DialogTitle>
          <DialogDescription className="text-gray-400">
            {pessoa?.nome}{pessoa?.igreja ? ` · ${pessoa.igreja}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-300 mb-2">Como pagou?</p>
            <div className="grid grid-cols-2 gap-3">
              {[['dinheiro', 'Dinheiro', Banknote], ['cartao', 'Cartão', CreditCard]].map(([v, rotulo, Icone]) => (
                <button key={v} type="button" onClick={() => setMeio(v)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-4 transition-colors ${
                    meio === v ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}>
                  <Icone className="w-6 h-6" />
                  <span className="font-medium">{rotulo}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-2">Valor recebido (R$)</p>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="0,00" className="bg-white/5 border-white/20 text-white text-lg" />
            <p className="text-xs text-gray-500 mt-1.5">
              {previsto?.valor != null
                ? <>Valor de hoje: {moeda(previsto.valor)}
                    {Number(previsto.desconto) > 0 && <> (com desconto de {previsto.motivo === 'pastor' ? 'pastor' : 'infiltrado'})</>}.
                    {' '}Confira antes de confirmar.</>
                : 'Confira o valor antes de confirmar.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={salvando} onClick={onFechar}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button disabled={salvando || !meio || !valorOk} onClick={confirmar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar baixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---- Cartao de uma pessoa ------------------------------------------------------
const CartaoPessoa = ({ p, onBaixa, onAtualizado }) => {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.observacao || '');
  const [salvando, setSalvando] = useState(false);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const s = situacao(p);

  const salvarObs = async () => {
    setSalvando(true);
    try {
      await salvarObservacaoPortaria(p.tipo, p.id, texto);
      toast({ title: texto.trim() ? 'Observação salva' : 'Observação apagada', className: 'bg-emerald-600 text-white' });
      setEditando(false);
      onAtualizado();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
      onAtualizado();
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async () => {
    setDesfazendo(true);
    try {
      await desfazerBaixaPortaria(p.tipo, p.id);
      toast({ title: 'Baixa desfeita', description: `${p.nome} voltou para "Em aberto".` });
      setConfirmarDesfazer(false);
      onAtualizado();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
      onAtualizado();
    } finally {
      setDesfazendo(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white break-words">{p.nome}</p>
          <p className="text-sm text-gray-400 break-words">
            {p.igreja || 'Sem igreja informada'}
            {p.congrega && p.congrega !== p.igreja && !/^N[ÃA]O SE APLICA/i.test(p.congrega) && <span className="text-gray-500"> · congrega: {p.congrega}</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
              p.tipo === 'acampante' ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-blue-500/40 bg-blue-500/10 text-blue-200'
            }`}>
              {p.tipo === 'acampante' ? 'Acampante' : 'Equipante'}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${s.classe}`}>{s.texto}</span>
            {p.pago && p.metodo === 'manual' && p.valor != null && (
              <span className="text-xs text-gray-400">{moeda(p.valor)}</span>
            )}
          </div>
          {ehBaixaDaPortaria(p) && (
            <p className="text-[11px] text-gray-500 mt-1">
              Baixa por {String(p.confirmado_por).replace('Portaria: ', '')} em {dataHora(p.data_pagamento)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {!p.pago && (
            <Button size="sm" onClick={() => onBaixa(p)} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />Dar baixa
            </Button>
          )}
          {ehBaixaDaPortaria(p) && !confirmarDesfazer && (
            <Button size="sm" variant="outline" onClick={() => setConfirmarDesfazer(true)}
              className="flex-1 sm:flex-none border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
              <Undo2 className="w-4 h-4 mr-1.5" />Desfazer baixa
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setTexto(p.observacao || ''); setEditando(!editando); }}
            className="flex-1 sm:flex-none border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            <MessageSquare className="w-4 h-4 mr-1.5" />Observação
          </Button>
        </div>
      </div>

      {confirmarDesfazer && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <span className="text-sm text-red-200 flex-1 min-w-[180px]">Desfazer a baixa? A pessoa volta para "Em aberto".</span>
          <Button size="sm" variant="outline" disabled={desfazendo} onClick={() => setConfirmarDesfazer(false)}
            className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Não
          </Button>
          <Button size="sm" disabled={desfazendo} onClick={desfazer} className="h-8 bg-red-600 hover:bg-red-700 text-white">
            {desfazendo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, desfazer'}
          </Button>
        </div>
      )}

      {editando ? (
        <div className="mt-3 space-y-2">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 500))} rows={3}
            placeholder="Escreva qualquer informação para a organização"
            className="bg-white/5 border-white/20 text-white" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 mr-auto">{texto.length}/500 · deixe vazio para apagar</span>
            <Button size="sm" variant="outline" disabled={salvando} onClick={() => setEditando(false)}
              className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button size="sm" disabled={salvando} onClick={salvarObs} className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      ) : p.observacao && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-sm text-amber-100 whitespace-pre-wrap break-words">{p.observacao}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {p.observacao_por}{p.observacao_em ? ` · ${dataHora(p.observacao_em)}` : ''}
          </p>
        </div>
      )}
    </div>
  );
};

// ---- Tela -------------------------------------------------------------------------
const PortariaPage = () => {
  const { apoioUser, organizadorUser, user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [pagamento, setPagamento] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [igreja, setIgreja] = useState('');
  const [extra, setExtra] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [baixa, setBaixa] = useState(null);

  const nomeDaConta = apoioUser?.nome || organizadorUser?.nome || user?.nome || '';
  const ehOrganizador = !apoioUser && (!!organizadorUser || ['organizador', 'organizador-aprovador'].includes(user?.role));

  // O cracha vale 8 horas e a portaria fica com a tela aberta o dia todo.
  // Vencido, o banco passa a responder "Acesso não autorizado" e a lista
  // pararia de atualizar sem aviso: aqui a pessoa e mandada para o login.
  const sessaoAcabou = () => {
    toast({
      title: 'Sua sessão terminou',
      description: 'Entre de novo com o seu nome e a sua senha.',
      variant: 'destructive',
    });
    logout();
    navigate('/login');
  };
  const semSessao = () => !getAuthToken();
  const ehRecusaDeAcesso = (e) => /acesso não autorizado/i.test(String(e?.message || ''));

  // Uma carga por vez. Se pedirem outra no meio (ex.: logo depois de uma
  // baixa), ela roda quando a atual terminar -- a atual pode ter saido do
  // banco antes da gravacao e trazer a pessoa ainda "em aberto".
  const emCurso = useRef(false);
  const deNovo = useRef(false);
  const carregar = async (silencioso = false) => {
    if (semSessao()) { sessaoAcabou(); return; }
    if (emCurso.current) { deNovo.current = true; return; }
    emCurso.current = true;
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      const dados = await fetchPortariaLista();
      setLista(dados.map((p) => ({ ...p, _busca: semAcento(p.nome) })));
      setErro('');
    } catch (e) {
      console.error('PortariaPage - carregar', e?.message || e);
      if (ehRecusaDeAcesso(e) && (semSessao() || !ehOrganizador)) { sessaoAcabou(); return; }
      if (!silencioso) setErro(e?.message || 'Não foi possível carregar a lista.');
    } finally {
      emCurso.current = false;
      setCarregando(false);
      setAtualizando(false);
      if (deNovo.current) {
        deNovo.current = false;
        carregar(true);
      }
    }
  };

  // Varias pessoas da portaria trabalham ao mesmo tempo: a lista se atualiza
  // sozinha a cada 30 s (e logo depois de cada gravacao).
  useEffect(() => {
    carregar();
    const t = setInterval(() => carregar(true), ATUALIZAR_A_CADA_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setLimite(POR_PAGINA); }, [busca, pagamento, tipo, igreja, extra]);

  const sair = () => {
    logout();
    navigate('/login');
  };

  const igrejas = useMemo(
    () => [...new Set(lista.map((p) => p.igreja).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [lista]
  );

  const filtrados = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return lista.filter((p) => {
      if (tipo !== 'todos' && p.tipo !== tipo) return false;
      if (pagamento === 'aberto' && p.pago) return false;
      if (pagamento === 'pagos' && !p.pago) return false;
      if (igreja && p.igreja !== igreja) return false;
      if (extra === 'obs' && !p.observacao) return false;
      if (extra === 'baixas' && !ehBaixaDaPortaria(p)) return false;
      return termos.every((t) => p._busca.includes(t));
    });
  }, [lista, busca, pagamento, tipo, igreja, extra]);

  const numeros = useMemo(() => {
    const pagos = lista.filter((p) => p.pago).length;
    const baixas = lista.filter(ehBaixaDaPortaria);
    const soma = (m) => baixas.filter((p) => p.meio === m).reduce((t, p) => t + Number(p.valor || 0), 0);
    return {
      total: lista.length, pagos, aberto: lista.length - pagos,
      baixas: baixas.length, dinheiro: soma('dinheiro'), cartao: soma('cartao'),
    };
  }, [lista]);

  const conteudo = carregando ? (
    <div className="py-20 text-center text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Carregando...
    </div>
  ) : erro ? (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <p className="text-red-200 mb-4">{erro}</p>
      <Button onClick={() => carregar()} className="bg-white/10 hover:bg-white/20 text-white">Tentar de novo</Button>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Numero rotulo="Total" valor={numeros.total} />
        <Numero rotulo="Pagos" valor={numeros.pagos} cor="text-emerald-300" />
        <Numero rotulo="Em aberto" valor={numeros.aberto} cor="text-amber-300" />
        <Numero rotulo="Baixas na portaria" valor={numeros.baixas}
          detalhe={`Dinheiro ${moeda(numeros.dinheiro)} · Cartão ${moeda(numeros.cartao)}`} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar pelo nome"
            className="pl-9 pr-9 bg-white/5 border-white/20 text-white h-11 text-base" />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar pesquisa"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip ativo={pagamento === 'todos'} onClick={() => setPagamento('todos')}>Todos</Chip>
          <Chip ativo={pagamento === 'aberto'} onClick={() => setPagamento('aberto')}>Em aberto</Chip>
          <Chip ativo={pagamento === 'pagos'} onClick={() => setPagamento('pagos')}>Pagos</Chip>
          <span className="w-px bg-white/10 mx-1" />
          <Chip ativo={tipo === 'todos'} onClick={() => setTipo('todos')}>Acampantes e equipantes</Chip>
          <Chip ativo={tipo === 'acampante'} onClick={() => setTipo('acampante')}>Acampantes</Chip>
          <Chip ativo={tipo === 'equipante'} onClick={() => setTipo('equipante')}>Equipantes</Chip>
          <span className="w-px bg-white/10 mx-1" />
          <Chip ativo={extra === 'obs'} onClick={() => setExtra(extra === 'obs' ? '' : 'obs')}>Com observação</Chip>
          <Chip ativo={extra === 'baixas'} onClick={() => setExtra(extra === 'baixas' ? '' : 'baixas')}>Baixas na portaria</Chip>
        </div>

        <select value={igreja} onChange={(e) => setIgreja(e.target.value)}
          className="w-full h-10 rounded-md border border-white/20 bg-zinc-900 px-3 text-sm text-white">
          <option value="">Todas as igrejas</option>
          {igrejas.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-gray-400">
        <span>{filtrados.length} {filtrados.length === 1 ? 'pessoa' : 'pessoas'}</span>
        <button type="button" onClick={() => carregar(true)} className="inline-flex items-center gap-1.5 hover:text-white">
          <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />Atualizar
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Ninguém encontrado com esses filtros.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.slice(0, limite).map((p) => (
            <CartaoPessoa key={`${p.tipo}:${p.id}:${p.observacao || ''}`} p={p} onBaixa={setBaixa} onAtualizado={() => carregar(true)} />
          ))}
          {filtrados.length > limite && (
            <Button variant="outline" onClick={() => setLimite(limite + POR_PAGINA)}
              className="w-full border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
              Mostrar mais ({filtrados.length - limite} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Portaria - Metanoia Radical</title>
      </Helmet>

      {ehOrganizador ? (
        <Layout largo>
          <div className="space-y-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <DoorOpen className="w-6 h-6 text-emerald-400" /> Portaria
                </h1>
                <p className="text-sm text-gray-400">A mesma tela que a portaria vê no login Apoio.</p>
              </div>
              <Link to="/organizer/configuracoes" className="shrink-0 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" />Voltar para Configurações
              </Link>
            </div>
            {conteudo}
          </div>
        </Layout>
      ) : (
        <div className="min-h-screen bg-black text-white">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-black/90 backdrop-blur">
            <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center gap-3">
              <img src="/images/logo.png" alt="Metanoia Radical" className="hidden sm:block h-9 w-auto object-contain" />
              <div className="min-w-0">
                <p className="font-bold leading-tight flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-emerald-400" /> Portaria
                </p>
                <p className="text-xs text-gray-500 truncate">Metanoia Radical Serra · {nomeDaConta || 'Apoio'}</p>
              </div>
              <div className="ml-auto">
                <Button variant="ghost" size="sm" onClick={sair} className="text-gray-300 hover:text-white hover:bg-white/10">
                  <LogOut className="w-4 h-4 mr-1.5" />Sair
                </Button>
              </div>
            </div>
          </header>
          <main className="max-w-[1100px] mx-auto px-4 py-5">{conteudo}</main>
        </div>
      )}

      <BaixaDialog pessoa={baixa} onFechar={() => setBaixa(null)} onFeito={() => { setBaixa(null); carregar(true); }}
        onErro={() => carregar(true)} />
    </>
  );
};

export default PortariaPage;
