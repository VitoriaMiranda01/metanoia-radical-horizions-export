import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Banknote, CheckCircle2, CreditCard, DoorOpen, Loader2, LogOut, MessageSquare, RefreshCw, Search, Undo2, Wallet, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import Layout from '@/components/Layout';
import { getAuthToken } from '@/services/authToken';
import {
  darBaixaPortaria, desfazerBaixaPortaria, desfazerEntradaPortaria, fetchPortariaLista, fetchPortariaVersao, fetchValorPrevisto,
  liberarEntradaPortaria, salvarObservacaoPortaria
} from '@/services/portariaService';

/**
 * Tela da portaria (login "Apoio", Patrick, 24/10/2026): ENTRADA DOS EQUIPANTES.
 *
 * Usada na sexta, sabado e domingo do evento, quase sempre no celular. So
 * equipantes (os da escala, ou que ja pagaram). Quem ja pagou -- PIX, em maos
 * ou isento -- recebe a pulseira e a portaria toca em "Liberar entrada": a
 * pessoa vai para "Ja entrou" e fica verde. Quem nao pagou usa "Pagar agora"
 * (dinheiro ou cartao) e, no mesmo passo, ja tem a entrada liberada.
 *
 * Uma pesquisa so: nome, igreja ou area. Observacao livre por pessoa para a
 * organizacao. Os dados vem de portaria_lista() -- a conta de apoio nao le
 * nenhuma tabela direto, e cada gravacao e conferida no banco. Organizador
 * tambem abre esta tela (botao "Portaria" de Configuracoes), dentro do painel.
 */

const POR_PAGINA = 50;
const CONFERIR_A_CADA_MS = 5000;
const RECARGA_COMPLETA_MS = 120000;

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const moeda = (v) => (v == null || v === '' ? '—'
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

const dataHora = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// Dia do cadastro no horario de Brasilia (AAAA-MM-DD), para o filtro "a partir de".
const diaBrasilia = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
};

const maiusculas = (t) => String(t || '').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());

const semPrefixo = (quem) => maiusculas(String(quem || '').replace(/^Portaria: /, ''));

const pagoNaPortaria = (p) => p.pago && p.metodo === 'manual' && String(p.confirmado_por || '').startsWith('Portaria: ');

// Na portaria so se recebe dinheiro ou cartao (Patrick, 24/10/2026): o PIX o
// equipante paga sozinho na propria area. 'pix' fica so para quem ja pagou assim.
const NOME_MEIO = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };

// Texto da situacao do pagamento.
const situacao = (p) => {
  if (!p.pago) return { texto: 'Pagamento em aberto', classe: 'border-amber-500/40 bg-amber-500/15 text-amber-200' };
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

// ---- Janela "Pagar agora" -------------------------------------------------------
const PagarAgoraDialog = ({ pessoa, onFechar, onFeito, onErro }) => {
  const { toast } = useToast();
  const [meio, setMeio] = useState('');
  const [valor, setValor] = useState('');
  const [liberar, setLiberar] = useState(true);
  const [previsto, setPrevisto] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pessoa) return;
    setMeio('');
    setValor('');
    setLiberar(true);
    setPrevisto(null);
    let vivo = true;
    fetchValorPrevisto('equipante', pessoa.id).then((r) => {
      if (!vivo || !r) return;
      setPrevisto(r);
      if (r.valor != null) setValor(String(Number(r.valor).toFixed(2)).replace('.', ','));
    });
    return () => { vivo = false; };
  }, [pessoa]);

  // "80,00" ou "1.080,50" (virgula decimal) e tambem "80.50" (ponto decimal).
  const valorTexto = String(valor).trim();
  const valorNumero = Number(valorTexto.includes(',') ? valorTexto.replace(/\./g, '').replace(',', '.') : valorTexto);
  const valorOk = Number.isFinite(valorNumero) && valorNumero > 0 && valorNumero <= 5000;

  const confirmar = async () => {
    if (!meio || !valorOk) return;
    setSalvando(true);
    try {
      await darBaixaPortaria('equipante', pessoa.id, meio, valorNumero, liberar);
      toast({
        title: liberar ? 'Pago e entrada liberada' : 'Pagamento registrado',
        description: `${pessoa.nome} · ${NOME_MEIO[meio]} · ${moeda(valorNumero)}${liberar ? ' · entregue a pulseira' : ''}`,
        className: 'bg-emerald-600 text-white',
      });
      onFeito();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
      // Recusa do banco (ex.: outra pessoa da portaria ja registrou): fecha a
      // janela para ninguem tentar de novo. Falha de conexao: fica aberta.
      if (e?.recusadoPeloBanco) onFechar();
      onErro();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!pessoa} onOpenChange={(aberto) => { if (!aberto && !salvando) onFechar(); }}>
      <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar agora</DialogTitle>
          <DialogDescription className="text-gray-400">
            {pessoa?.nome}{pessoa?.igreja ? ` · ${pessoa.igreja}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-300 mb-2">Como pagou?</p>
            <div className="grid grid-cols-2 gap-3">
              {[['dinheiro', 'Dinheiro', [Banknote]], ['cartao', 'Cartão', [CreditCard]]].map(([v, rotulo, icones]) => (
                <button key={v} type="button" onClick={() => setMeio(v)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-4 transition-colors ${
                    meio === v ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}>
                  <span className="flex items-center gap-1.5">
                    {icones.map((Icone, i) => <Icone key={i} className="w-6 h-6" />)}
                  </span>
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
                ? <>Valor do último lote: {moeda(previsto.valor)}
                    {Number(previsto.desconto) > 0 && <> (com desconto de {previsto.motivo === 'pastor' ? 'pastor' : 'infiltrado'})</>}.
                    {' '}Confira antes de confirmar.</>
                : 'Confira o valor antes de confirmar.'}
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer">
            <Checkbox checked={liberar} onCheckedChange={(v) => setLiberar(v === true)} className="mt-0.5" />
            <span className="text-sm text-gray-200">
              Liberar a entrada agora
              <span className="block text-xs text-gray-500">Entregue a pulseira. A pessoa vai para "Entrada liberada".</span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={salvando} onClick={onFechar}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button disabled={salvando || !meio || !valorOk} onClick={confirmar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Confirmacao em linha (desfazer entrada / desfazer pagamento).
const Confirmar = ({ texto, rotulo, ocupado, onNao, onSim }) => (
  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
    <span className="text-sm text-red-200 flex-1 min-w-[180px]">{texto}</span>
    <Button size="sm" variant="outline" disabled={ocupado} onClick={onNao}
      className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
      Não
    </Button>
    <Button size="sm" disabled={ocupado} onClick={onSim} className="h-8 bg-red-600 hover:bg-red-700 text-white">
      {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : rotulo}
    </Button>
  </div>
);

// ---- Cartao de uma pessoa ------------------------------------------------------
const CartaoPessoa = ({ p, onPagar, onAtualizado }) => {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.observacao || '');
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(''); // 'entrada' | 'pagamento'
  const [ocupado, setOcupado] = useState(false);
  const s = situacao(p);
  const entrou = !!p.entrou_em;

  // Toda gravacao recarrega a lista, deu certo ou nao: "ja entrou" ou "ja esta
  // paga" (outra pessoa da portaria foi mais rapida) passa a aparecer na hora.
  const executar = async (acao, sucesso) => {
    setOcupado(true);
    try {
      await acao();
      toast(sucesso);
      setConfirmando('');
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setOcupado(false);
      onAtualizado();
    }
  };

  const liberar = () => executar(() => liberarEntradaPortaria(p.id), {
    title: 'Entrada liberada', description: `${p.nome} · entregue a pulseira.`, className: 'bg-emerald-600 text-white',
  });
  const desfazerEntrada = () => executar(() => desfazerEntradaPortaria(p.id), {
    title: 'Entrada desfeita', description: `${p.nome} voltou para "Entrada pendente".`,
  });
  const desfazerPagamento = () => executar(() => desfazerBaixaPortaria('equipante', p.id), {
    title: 'Pagamento desfeito', description: `${p.nome} voltou para "Pagamento em aberto".`,
  });

  const salvarObs = async () => {
    setSalvando(true);
    try {
      await salvarObservacaoPortaria('equipante', p.id, texto);
      toast({ title: texto.trim() ? 'Observação salva' : 'Observação apagada', className: 'bg-emerald-600 text-white' });
      setEditando(false);
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
      onAtualizado();
    }
  };

  const botaoSecundario = 'flex-1 sm:flex-none border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10';

  return (
    <div className={`rounded-xl border p-4 ${entrou ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white break-words flex items-center gap-2">
            {entrou && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {p.nome}
          </p>
          <p className="text-sm text-gray-400 break-words">{p.igreja || 'Sem igreja informada'}</p>
          {p.areas?.length > 0 && <p className="text-xs text-gray-500 break-words">{p.areas.join(' · ')}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {entrou && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-400 bg-emerald-500/30 text-white">
                Entrada liberada · {dataHora(p.entrou_em)}
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${s.classe}`}>{s.texto}</span>
            {p.pago && p.metodo === 'manual' && p.valor != null && (
              <span className="text-xs text-gray-400">{moeda(p.valor)}</span>
            )}
            {!p.na_escala && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-200">
                Fora da escala
              </span>
            )}
          </div>
          {p.cadastrado_em && <p className="text-[11px] text-gray-500 mt-1">Cadastrou em {dataHora(p.cadastrado_em)}</p>}
          {(entrou || pagoNaPortaria(p)) && (
            <p className="text-[11px] text-gray-500 mt-1">
              {pagoNaPortaria(p) && <>Pagou na portaria ({semPrefixo(p.confirmado_por)}, {dataHora(p.data_pagamento)})</>}
              {pagoNaPortaria(p) && entrou && ' · '}
              {entrou && <>Entrada liberada por {semPrefixo(p.entrada_por)}</>}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {!entrou && !p.pago && (
            <Button size="sm" onClick={() => onPagar(p)} className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white">
              <Wallet className="w-4 h-4 mr-1.5" />Pagar agora
            </Button>
          )}
          {!entrou && p.pago && (
            <Button size="sm" disabled={ocupado} onClick={liberar} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white">
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <><DoorOpen className="w-4 h-4 mr-1.5" />Liberar entrada</>}
            </Button>
          )}
          {entrou && !confirmando && (
            <Button size="sm" variant="outline" onClick={() => setConfirmando('entrada')} className={botaoSecundario}>
              <Undo2 className="w-4 h-4 mr-1.5" />Desfazer entrada
            </Button>
          )}
          {!entrou && pagoNaPortaria(p) && !confirmando && (
            <Button size="sm" variant="outline" onClick={() => setConfirmando('pagamento')} className={botaoSecundario}>
              <Undo2 className="w-4 h-4 mr-1.5" />Desfazer pagamento
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setTexto(p.observacao || ''); setEditando(!editando); }}
            className={botaoSecundario}>
            <MessageSquare className="w-4 h-4 mr-1.5" />Observação
          </Button>
        </div>
      </div>

      {confirmando === 'entrada' && (
        <Confirmar texto='Desfazer a entrada? A pessoa volta para "Entrada pendente".' rotulo="Sim, desfazer"
          ocupado={ocupado} onNao={() => setConfirmando('')} onSim={desfazerEntrada} />
      )}
      {confirmando === 'pagamento' && (
        <Confirmar texto='Desfazer o pagamento feito na portaria? Volta para "Pagamento em aberto".' rotulo="Sim, desfazer"
          ocupado={ocupado} onNao={() => setConfirmando('')} onSim={desfazerPagamento} />
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
const ABAS = [
  { valor: 'falta', rotulo: 'Entrada pendente' },
  { valor: 'entrou', rotulo: 'Entrada liberada' },
  { valor: 'todos', rotulo: 'Todos' },
];

const PortariaPage = () => {
  const { apoioUser, organizadorUser, user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const [aba, setAba] = useState('falta');
  const [busca, setBusca] = useState('');
  const [pagamento, setPagamento] = useState('todos');
  const [soObservacao, setSoObservacao] = useState(false);
  const [desde, setDesde] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [pagando, setPagando] = useState(null);

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
  // gravacao), ela roda quando a atual terminar -- a atual pode ter saido do
  // banco antes da gravacao e trazer a pessoa ainda sem a mudanca.
  const emCurso = useRef(false);
  const deNovo = useRef(false);
  const versaoRef = useRef(null);
  const ultimaCarga = useRef(0);
  const carregar = async (silencioso = false) => {
    if (semSessao()) { sessaoAcabou(); return; }
    if (emCurso.current) { deNovo.current = true; return; }
    emCurso.current = true;
    if (silencioso) setAtualizando(true); else setCarregando(true);
    try {
      // A assinatura vem ANTES da lista: se algo mudar entre as duas, a
      // assinatura guardada fica velha e a proxima conferencia recarrega.
      const versao = await fetchPortariaVersao().catch(() => null);
      const dados = await fetchPortariaLista();
      versaoRef.current = versao;
      ultimaCarga.current = Date.now();
      setLista(dados.map((p) => ({
        ...p,
        areas: Array.isArray(p.areas) ? p.areas : [],
        _cadastro: diaBrasilia(p.cadastrado_em),
        _busca: semAcento([p.nome, p.igreja, ...(Array.isArray(p.areas) ? p.areas : [])].join(' ')),
      })));
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

  // A lista precisa estar sempre em dia: depois da escala oficial ha trocas
  // de area (inclusive infiltrado <-> outra area), e quem trocou as 17:00 e
  // chega as 17:01 ja tem de aparecer certo. A cada 5 s a tela confere a
  // assinatura (consulta pequena) e so recarrega a lista quando ela mudou;
  // ao voltar para a tela (celular desbloqueado, aba trocada) confere na hora.
  // Por seguranca, recarrega tudo de 2 em 2 minutos. Toda gravacao tambem
  // recarrega, e o banco confere de novo em cada acao.
  const conferir = async () => {
    if (document.visibilityState === 'hidden' || emCurso.current) return;
    if (Date.now() - ultimaCarga.current > RECARGA_COMPLETA_MS) { carregar(true); return; }
    try {
      const versao = await fetchPortariaVersao();
      if (!versao || versao !== versaoRef.current) carregar(true);
    } catch (e) {
      carregar(true);
    }
  };

  useEffect(() => {
    carregar();
    const t = setInterval(conferir, CONFERIR_A_CADA_MS);
    const aoVoltar = () => { if (document.visibilityState === 'visible') conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, []);

  useEffect(() => { setLimite(POR_PAGINA); }, [aba, busca, pagamento, soObservacao, desde]);

  const sair = () => {
    logout();
    navigate('/login');
  };

  const numeros = useMemo(() => {
    const entraram = lista.filter((p) => p.entrou_em).length;
    const faltam = lista.filter((p) => !p.entrou_em);
    const pagosNaPortaria = lista.filter(pagoNaPortaria);
    return {
      total: lista.length,
      entraram,
      faltam: faltam.length,
      faltamPagos: faltam.filter((p) => p.pago).length,
      faltamAbertos: faltam.filter((p) => !p.pago).length,
      pagosNaPortaria: pagosNaPortaria.length,
    };
  }, [lista]);

  const contagemAba = { falta: numeros.faltam, entrou: numeros.entraram, todos: numeros.total };

  const filtrados = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return lista.filter((p) => {
      if (aba === 'falta' && p.entrou_em) return false;
      if (aba === 'entrou' && !p.entrou_em) return false;
      // Em "Ja entrou" todo mundo pagou: o filtro de pagamento nao vale ali.
      if (aba !== 'entrou' && pagamento === 'pagos' && !p.pago) return false;
      if (aba !== 'entrou' && pagamento === 'aberto' && p.pago) return false;
      if (soObservacao && !p.observacao) return false;
      if (desde && !(p._cadastro && p._cadastro >= desde)) return false;
      return termos.every((t) => p._busca.includes(t));
    });
  }, [lista, aba, busca, pagamento, soObservacao, desde]);

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
        <Numero rotulo="Equipantes" valor={numeros.total} />
        <Numero rotulo="Entrada liberada" valor={numeros.entraram} cor="text-emerald-300" />
        <Numero rotulo="Entrada pendente" valor={numeros.faltam} cor="text-amber-300"
          detalhe={`${numeros.faltamPagos} já pagos · ${numeros.faltamAbertos} pagam na hora`} />
        <Numero rotulo="Pagos na portaria" valor={numeros.pagosNaPortaria} />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {ABAS.map((a) => (
          <button key={a.valor} type="button" onClick={() => setAba(a.valor)}
            className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors ${
              aba === a.valor
                ? (a.valor === 'entrou' ? 'bg-emerald-600 text-white' : 'bg-white/15 text-white')
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}>
            {a.rotulo} <span className="opacity-70">({contagemAba[a.valor]})</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar nome, igreja ou área"
            className="pl-9 pr-9 bg-white/5 border-white/20 text-white h-11 text-base" />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar pesquisa"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {aba !== 'entrou' && (
            <>
              <Chip ativo={pagamento === 'todos'} onClick={() => setPagamento('todos')}>Todos</Chip>
              <Chip ativo={pagamento === 'pagos'} onClick={() => setPagamento('pagos')}>Já pagos</Chip>
              <Chip ativo={pagamento === 'aberto'} onClick={() => setPagamento('aberto')}>Pagam na hora</Chip>
              <span className="w-px bg-white/10 mx-1" />
            </>
          )}
          <Chip ativo={soObservacao} onClick={() => setSoObservacao(!soObservacao)}>Com observação</Chip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="portaria-desde" className="text-xs text-gray-400">Cadastrados a partir de</label>
          <Input id="portaria-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="w-auto h-9 bg-white/5 border-white/20 text-white [color-scheme:dark]" />
          {desde && (
            <button type="button" onClick={() => setDesde('')} className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" />Limpar data
            </button>
          )}
        </div>
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
            <CartaoPessoa key={`${p.id}:${p.observacao || ''}`} p={p} onPagar={setPagando} onAtualizado={() => carregar(true)} />
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
                  <DoorOpen className="w-6 h-6 text-emerald-400" /> Portaria · Equipantes
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
                  <DoorOpen className="w-4 h-4 text-emerald-400" /> Portaria · Equipantes
                </p>
                <p className="text-xs text-gray-500 truncate">Metanoia Radical Serra · {maiusculas(nomeDaConta) || 'Apoio'}</p>
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

      <PagarAgoraDialog pessoa={pagando} onFechar={() => setPagando(null)}
        onFeito={() => { setPagando(null); carregar(true); }} onErro={() => carregar(true)} />
    </>
  );
};

export default PortariaPage;
