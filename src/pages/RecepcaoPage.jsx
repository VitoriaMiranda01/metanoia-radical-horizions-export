import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Baby, BookOpen, Bus, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, FileText, Flag,
  Loader2, Lock, LogOut, MessageSquare, Phone, RefreshCw, Search, Undo2, Unlock, UserCheck, X
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
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { supabase } from '@/services/supabaseClient';
import { getAuthToken } from '@/services/authToken';
import { GROUPS } from '@/utils/gruposTrailha';
import { digitosTelefone, formatarTelefone } from '@/utils/telefone';
import { textoComposicao } from '@/utils/onibus';
import {
  PDF_TERMO_ARQUIVO, PDF_TERMO_BUCKET, chave, dataHora, horaCurta, onibusDaRecepcao, quemFez, semAcento
} from '@/utils/recepcao';
import {
  desfazerPresenca, encerrarChamada, fetchRecepcaoLista, fetchRecepcaoVersao, marcarPresenca, reabrirChamada,
  salvarObservacaoRecepcao
} from '@/services/recepcaoService';

/**
 * Recepcao dos acampantes na igreja (login "Apoio" da area recepcao --
 * Bruna e Rodolfo -- Patrick, 25/10/2026). A chamada de quem realmente
 * chegou, em mais de um aparelho ao mesmo tempo: a tela confere a assinatura
 * do banco a cada 5 s e o banco barra presenca em dobro.
 *
 * Aparecem so os acampantes pagos (isento conta) ou com pagamento agendado
 * (20261026b; a tela nao mostra a situacao do pagamento), e os infiltrados da
 * escala oficial como acampantes (sigilo: nada os diferencia aqui). "Chegou"
 * pede "ciente do termo" (o mesmo da inscricao); menor de idade pede tambem
 * "autorizacao dos responsaveis entregue". "Encerrar chamada" avisa os
 * organizadores no painel (e a recepcao avisa tambem pelo WhatsApp).
 * Organizador tambem abre esta tela (Configuracoes -> Recepcao).
 */

const POR_PAGINA = 50;
const CONFERIR_A_CADA_MS = 5000;
const RECARGA_COMPLETA_MS = 120000;

const maiusculas = (t) => String(t || '').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());

// Caixa de marcar visivel no fundo escuro e maior para o dedo.
const CAIXA = 'mt-0.5 h-5 w-5 border-white/60 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500 data-[state=checked]:text-white';

const linkTermo = () => supabase.storage.from(PDF_TERMO_BUCKET).getPublicUrl(PDF_TERMO_ARQUIVO).data.publicUrl;

const Telefone = ({ numero, rotulo }) => {
  const d = digitosTelefone(numero);
  if (!d) return <span className="text-gray-500">{rotulo ? `${rotulo}: ` : ''}sem telefone</span>;
  return (
    <a href={`tel:${d}`} className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline">
      <Phone className="w-3.5 h-3.5" />{rotulo ? `${rotulo}: ` : ''}{formatarTelefone(numero) || numero}
    </a>
  );
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

const Numero = ({ rotulo, valor, detalhe, cor = 'text-white', ativo, onClick }) => (
  <button type="button" onClick={onClick}
    className={`text-left rounded-xl border px-4 py-3 transition-colors ${
      ativo ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
    }`}>
    <p className="text-xs text-gray-400">{rotulo}</p>
    <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
    {detalhe && <p className="text-[11px] text-gray-500 mt-0.5">{detalhe}</p>}
  </button>
);

// ---- Janela "Confirmar presenca" ----------------------------------------------------
const ChegouDialog = ({ pessoa, numeroOnibus, onFechar, onFeito }) => {
  const { toast } = useToast();
  const [termo, setTermo] = useState(false);
  const [responsavel, setResponsavel] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { setTermo(false); setResponsavel(false); }, [pessoa]);

  const pode = termo && (!pessoa?.menor || responsavel);

  const confirmar = async () => {
    if (!pode) return;
    setSalvando(true);
    try {
      await marcarPresenca(pessoa.tipo, pessoa.id, true, !!pessoa.menor && responsavel);
      toast({ title: 'Presença confirmada', description: pessoa.nome, className: 'bg-emerald-600 text-white' });
      onFeito();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
      if (e?.recusadoPeloBanco) onFeito();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!pessoa} onOpenChange={(aberto) => { if (!aberto && !salvando) onFechar(); }}>
      <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar presença</DialogTitle>
          <DialogDescription className="text-gray-300">
            <span className="font-semibold text-white">{pessoa?.nome}</span>
            {pessoa?.idade != null && ` · ${pessoa.idade} anos`}
          </DialogDescription>
        </DialogHeader>

        {pessoa && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <GrupoTrilhaTag grupo={pessoa.grupo} />
              <span className="inline-flex items-center gap-1 text-gray-300"><Bus className="w-4 h-4" />
                {numeroOnibus ? `Ônibus ${numeroOnibus}` : 'Sem ônibus'}
              </span>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
              <p className="text-sm text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />Termo de responsabilidade
              </p>
              <p className="text-xs text-gray-400">
                É o mesmo termo aceito na inscrição e repassado no grupo de WhatsApp dos acampantes.
                {' '}Na inscrição: {pessoa.termo_inscricao ? <span className="text-emerald-300">aceito (“Estou Ciente”)</span> : <span className="text-amber-300">não consta aceite</span>}
                {' · '}<a href={linkTermo()} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-2">abrir o termo (PDF)</a>
              </p>
              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <Checkbox checked={termo} onCheckedChange={(v) => setTermo(v === true)} className={CAIXA} />
                <span className="text-sm text-gray-100">
                  {pessoa.menor ? 'Termo de responsabilidade' : 'Ciente do termo de responsabilidade'}
                </span>
              </label>
            </div>

            {pessoa.menor && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <p className="flex items-center gap-2 font-semibold text-amber-200">
                  <Baby className="w-4 h-4" />Menor de idade{pessoa.idade != null ? ` (${pessoa.idade} anos)` : ''}
                </p>
                <p className="text-sm text-amber-100/90">
                  Precisa entregar a <strong>autorização dos responsáveis</strong>. Se não trouxe, o responsável assina
                  agora, no papel da recepção, e entrega.
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={responsavel} onCheckedChange={(v) => setResponsavel(v === true)} className={CAIXA} />
                  <span className="text-sm text-gray-100">Autorização dos responsáveis entregue</span>
                </label>
                <div className="text-sm space-y-1 pt-1 border-t border-amber-500/20">
                  <p className="text-xs text-amber-100/70 pt-1">Contato de emergência:</p>
                  <p className="text-white">{pessoa.emergencia_nome || 'Contato de emergência não informado'}</p>
                  <Telefone numero={pessoa.emergencia_telefone} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={salvando} onClick={onFechar}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button disabled={salvando || !pode} onClick={confirmar} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserCheck className="w-4 h-4 mr-1.5" />Confirmar presença</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---- Janela "Como usar a recepcao" (guia em /guia-recepcao.html) ---------------------
const GuiaDialog = ({ aberto, onFechar }) => (
  <Dialog open={aberto} onOpenChange={(a) => { if (!a) onFechar(); }}>
    <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-3xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
      <DialogHeader className="px-5 py-3 border-b border-white/10 text-left">
        <DialogTitle>Como usar a recepção</DialogTitle>
        <DialogDescription className="sr-only">Guia passo a passo da tela da recepção dos acampantes.</DialogDescription>
      </DialogHeader>
      {aberto && <iframe title="Como usar a recepção" src="/guia-recepcao.html" className="flex-1 w-full border-0 bg-[#0d1511]" />}
    </DialogContent>
  </Dialog>
);

// ---- Janela "Encerrar chamada" -------------------------------------------------------
const EncerrarDialog = ({ aberto, numeros, onFechar, onFeito }) => {
  const { toast } = useToast();
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    setSalvando(true);
    try {
      await encerrarChamada();
      toast({
        title: 'Chamada encerrada',
        description: 'Os organizadores foram avisados no painel. Avise também pelo WhatsApp.',
        className: 'bg-emerald-600 text-white',
      });
      onFeito();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
      if (e?.recusadoPeloBanco) onFeito();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(a) => { if (!a && !salvando) onFechar(); }}>
      <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar a chamada?</DialogTitle>
          <DialogDescription className="text-gray-400">
            {numeros.presentes} presentes · {numeros.faltam} faltando
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100 space-y-2">
            <p>
              Ao encerrar, será disparada uma <strong>notificação para os organizadores</strong> conferirem a chamada
              no sítio e confirmarem se realmente pode finalizar.
            </p>
            <p><strong>Comunique também a organização pelo WhatsApp.</strong></p>
          </div>
          <p className="text-gray-400">
            Depois de encerrada, a recepção não marca nem desfaz presenças. Para mudar algo, um organizador reabre a chamada.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={salvando} onClick={onFechar}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button disabled={salvando} onClick={confirmar} className="bg-red-600 hover:bg-red-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Flag className="w-4 h-4 mr-1.5" />Encerrar chamada</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---- Cartao de um acampante ------------------------------------------------------------
const CartaoPessoa = ({ p, numeroOnibus, travada, onChegou, onAtualizado }) => {
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.observacao || '');
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const chegou = !!p.chegou_em;

  const desfazer = async () => {
    setOcupado(true);
    try {
      await desfazerPresenca(p.tipo, p.id);
      toast({ title: 'Presença desfeita', description: `${p.nome} voltou para "Faltam".` });
      setConfirmando(false);
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setOcupado(false);
      onAtualizado();
    }
  };

  const salvarObs = async () => {
    setSalvando(true);
    try {
      await salvarObservacaoRecepcao(p.tipo, p.id, texto);
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
    <div className={`rounded-xl border p-4 ${chegou ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white break-words flex items-center gap-2 flex-wrap">
            {chegou && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {p.nome}
            {p.menor && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-200 inline-flex items-center gap-1">
                <Baby className="w-3 h-3" />Menor{p.idade != null ? ` · ${p.idade} anos` : ''}
              </span>
            )}
            {p.infiltrado && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200">infiltrado</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <GrupoTrilhaTag grupo={p.grupo} />
            <span className="inline-flex items-center gap-1 text-gray-300"><Bus className="w-4 h-4" />{numeroOnibus ? `Ônibus ${numeroOnibus}` : 'Sem ônibus'}</span>
            <Telefone numero={p.whatsapp} />
          </div>
          {p.igreja && <p className="text-xs text-gray-500 mt-1 break-words">{p.igreja}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {chegou && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-400 bg-emerald-500/30 text-white">
                Chegou às {horaCurta(p.chegou_em)}
              </span>
            )}
          </div>
          {chegou && (
            <p className="text-[11px] text-gray-500 mt-1">
              Marcado por {maiusculas(quemFez(p.chegou_por))} · ciente do termo{p.responsavel_ciente ? ' · autorização dos responsáveis entregue' : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {!chegou && !travada && (
            <Button size="sm" onClick={() => onChegou(p)} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white">
              <UserCheck className="w-4 h-4 mr-1.5" />Chegou
            </Button>
          )}
          {chegou && !travada && !confirmando && (
            <Button size="sm" variant="outline" onClick={() => setConfirmando(true)} className={botaoSecundario}>
              <Undo2 className="w-4 h-4 mr-1.5" />Desfazer
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setTexto(p.observacao || ''); setEditando(!editando); }} className={botaoSecundario}>
            <MessageSquare className="w-4 h-4 mr-1.5" />Observação
          </Button>
        </div>
      </div>

      {confirmando && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <span className="text-sm text-red-200 flex-1 min-w-[180px]">Desfazer a presença? Volta para “Faltam”.</span>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setConfirmando(false)}
            className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Não</Button>
          <Button size="sm" disabled={ocupado} onClick={desfazer} className="h-8 bg-red-600 hover:bg-red-700 text-white">
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, desfazer'}
          </Button>
        </div>
      )}

      {editando ? (
        <div className="mt-3 space-y-2">
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 500))} rows={3}
            placeholder="Ex.: chegou com o pai, vai sair mais cedo..." className="bg-white/5 border-white/20 text-white" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 mr-auto">{texto.length}/500 · deixe vazio para apagar</span>
            <Button size="sm" variant="outline" disabled={salvando} onClick={() => setEditando(false)}
              className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
            <Button size="sm" disabled={salvando} onClick={salvarObs} className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      ) : p.observacao && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-sm text-amber-100 whitespace-pre-wrap break-words">{p.observacao}</p>
          <p className="text-[11px] text-gray-500 mt-1">{maiusculas(quemFez(p.observacao_por))}{p.observacao_em ? ` · ${dataHora(p.observacao_em)}` : ''}</p>
        </div>
      )}
    </div>
  );
};

// ---- Aba "Onibus" ---------------------------------------------------------------------------
const AbaOnibus = ({ divisao, semOnibus }) => {
  const [aberto, setAberto] = useState(null);
  const lista = [...divisao.onibus.map((o) => ({ ...o, rotulo: `Ônibus ${o.numero}` })),
    ...(semOnibus.length ? [{ numero: 'sem', rotulo: 'Sem ônibus', pessoas: semOnibus, composicao: [] }] : [])];

  return (
    <div className="space-y-3">
      <p className={`text-sm rounded-lg border px-3 py-2 ${divisao.fechada
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
        {divisao.fechada
          ? 'Divisão definida pela organização.'
          : 'Divisão provisória: a organização ainda não fechou os ônibus, a lista pode mudar.'}
      </p>
      {lista.map((o) => {
        const presentes = o.pessoas.filter((p) => p.chegou_em).length;
        const expandido = aberto === o.numero;
        return (
          <div key={o.numero} className="rounded-xl border border-white/10 bg-white/[0.03]">
            <button type="button" onClick={() => setAberto(expandido ? null : o.numero)}
              className="w-full flex flex-wrap items-center gap-2 p-3 text-left" aria-expanded={expandido}>
              {expandido ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <span className="font-semibold">{o.rotulo}</span>
              <span className={`text-sm tabular-nums ${presentes === o.pessoas.length && o.pessoas.length ? 'text-emerald-300' : 'text-gray-300'}`}>
                {presentes} de {o.pessoas.length} presentes
              </span>
              {o.composicao.length > 0 && <span className="text-xs text-gray-500 basis-full sm:basis-auto sm:ml-auto">{textoComposicao(o.composicao)}</span>}
            </button>
            {expandido && (
              <ul className="border-t border-white/10 divide-y divide-white/5">
                {o.pessoas.map((p) => (
                  <li key={chave(p)} className="flex items-center gap-2 px-3 py-2 text-sm">
                    {p.chegou_em ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" />}
                    <span className={`flex-1 min-w-0 break-words ${p.chegou_em ? 'text-white' : 'text-gray-300'}`}>{p.nome}</span>
                    <GrupoTrilhaTag grupo={p.grupo} className="text-[10px] px-2" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---- Tela -------------------------------------------------------------------------------------
const RecepcaoPage = () => {
  const { apoioUser, organizadorUser, user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dados, setDados] = useState({ pessoas: [], onibus: {}, chamada: {}, organizador: false });
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  const [aba, setAba] = useState('chamada');
  const [situacao, setSituacao] = useState('faltam');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [onibusFiltro, setOnibusFiltro] = useState('');
  const [soMenores, setSoMenores] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [chegando, setChegando] = useState(null);
  const [encerrarAberto, setEncerrarAberto] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [guiaAberto, setGuiaAberto] = useState(false);

  const nomeDaConta = apoioUser?.nome || organizadorUser?.nome || user?.nome || '';
  const ehOrganizador = !apoioUser && (!!organizadorUser || ['organizador', 'organizador-aprovador'].includes(user?.role));

  // Cracha vencido (8 h): o banco passa a recusar e a lista pararia sem aviso.
  const sessaoAcabou = () => {
    toast({ title: 'Sua sessão terminou', description: 'Entre de novo com o seu nome e a sua senha.', variant: 'destructive' });
    logout();
    navigate('/login');
  };
  const semSessao = () => !getAuthToken();
  const ehRecusaDeAcesso = (e) => /acesso não autorizado/i.test(String(e?.message || ''));

  // Uma carga por vez (mesmo esquema da portaria).
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
      const versao = await fetchRecepcaoVersao().catch(() => null);
      const r = await fetchRecepcaoLista();
      versaoRef.current = versao;
      ultimaCarga.current = Date.now();
      setDados({
        ...r,
        pessoas: r.pessoas.map((p) => ({ ...p, _busca: semAcento(p.nome) })),
      });
      setErro('');
    } catch (e) {
      console.error('RecepcaoPage - carregar', e?.message || e);
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

  // Varios aparelhos: confere a assinatura a cada 5 s e ao voltar para a tela;
  // recarga completa de 2 em 2 minutos por seguranca.
  const conferir = async () => {
    if (document.visibilityState === 'hidden' || emCurso.current) return;
    if (Date.now() - ultimaCarga.current > RECARGA_COMPLETA_MS) { carregar(true); return; }
    try {
      const versao = await fetchRecepcaoVersao();
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

  useEffect(() => { setLimite(POR_PAGINA); }, [situacao, busca, grupo, onibusFiltro, soMenores]);

  const sair = () => { logout(); navigate('/login'); };

  const { pessoas, chamada } = dados;
  const encerrada = !!chamada?.encerrada_em;
  const travada = encerrada && !ehOrganizador;

  const divisao = useMemo(() => onibusDaRecepcao(pessoas, dados.onibus), [pessoas, dados.onibus]);
  const onibusDe = (p) => divisao.porPessoa.get(chave(p)) || null;
  const semOnibus = useMemo(() => pessoas.filter((p) => !divisao.porPessoa.has(chave(p))), [pessoas, divisao]);

  const numeros = useMemo(() => {
    const presentes = pessoas.filter((p) => p.chegou_em).length;
    const menores = pessoas.filter((p) => p.menor);
    return {
      total: pessoas.length,
      presentes,
      faltam: pessoas.length - presentes,
      menores: menores.length,
      menoresPresentes: menores.filter((p) => p.chegou_em).length,
    };
  }, [pessoas]);

  const filtrados = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return pessoas.filter((p) => {
      if (situacao === 'faltam' && p.chegou_em) return false;
      if (situacao === 'presentes' && !p.chegou_em) return false;
      if (soMenores && !p.menor) return false;
      if (grupo === 'sem' && GROUPS.includes(p.grupo)) return false;
      if (grupo && grupo !== 'sem' && p.grupo !== grupo) return false;
      if (onibusFiltro === 'sem' && onibusDe(p)) return false;
      if (onibusFiltro && onibusFiltro !== 'sem' && onibusDe(p) !== Number(onibusFiltro)) return false;
      return termos.every((t) => p._busca.includes(t));
    });
  }, [pessoas, situacao, busca, grupo, onibusFiltro, soMenores, divisao]);

  const clicarNumero = (s, menores = false) => {
    setAba('chamada');
    setSituacao(s);
    setSoMenores(menores);
  };

  const reabrir = async () => {
    setReabrindo(true);
    try {
      await reabrirChamada();
      toast({ title: 'Chamada reaberta', className: 'bg-emerald-600 text-white' });
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setReabrindo(false);
      carregar(true);
    }
  };

  const conteudo = carregando ? (
    <div className="py-20 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Carregando...</div>
  ) : erro ? (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
      <p className="text-red-200 mb-4">{erro}</p>
      <Button onClick={() => carregar()} className="bg-white/10 hover:bg-white/20 text-white">Tentar de novo</Button>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setGuiaAberto(true)}
          className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline">
          <BookOpen className="w-4 h-4" />Como usar a recepção
        </button>
      </div>
      {encerrada && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
          <Lock className="w-5 h-5 text-red-300 shrink-0" />
          <p className="text-sm text-red-100 flex-1 min-w-[200px]">
            Chamada encerrada por {maiusculas(quemFez(chamada.encerrada_por))} em {dataHora(chamada.encerrada_em)}.
            {' '}{ehOrganizador ? 'Confira e, se precisar mudar algo, reabra.' : 'Os organizadores foram avisados. Para mudar algo, peça a um organizador para reabrir.'}
          </p>
          {ehOrganizador && (
            <Button size="sm" disabled={reabrindo} onClick={reabrir} className="bg-white/10 hover:bg-white/20 text-white">
              {reabrindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4 mr-1.5" />Reabrir chamada</>}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Numero rotulo="Acampantes" valor={numeros.total} ativo={aba === 'chamada' && situacao === 'todos' && !soMenores}
          onClick={() => clicarNumero('todos')} />
        <Numero rotulo="Presentes" valor={numeros.presentes} cor="text-emerald-300"
          ativo={aba === 'chamada' && situacao === 'presentes' && !soMenores} onClick={() => clicarNumero('presentes')} />
        <Numero rotulo="Faltam" valor={numeros.faltam} cor="text-amber-300"
          ativo={aba === 'chamada' && situacao === 'faltam' && !soMenores} onClick={() => clicarNumero('faltam')} />
        <Numero rotulo="Menores de idade" valor={numeros.menores}
          detalhe={`${numeros.menoresPresentes} presentes · ${numeros.menores - numeros.menoresPresentes} faltam`}
          ativo={aba === 'chamada' && soMenores} onClick={() => clicarNumero('todos', true)} />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {[['chamada', 'Chamada', ClipboardCheck], ['onibus', 'Ônibus', Bus]].map(([v, rotulo, Icone]) => (
          <button key={v} type="button" onClick={() => setAba(v)}
            className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
              aba === v ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <Icone className="w-4 h-4" />{rotulo}
          </button>
        ))}
      </div>

      {aba === 'onibus' ? <AbaOnibus divisao={divisao} semOnibus={semOnibus} /> : (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar o nome do acampante"
                className="pl-9 pr-9 bg-white/5 border-white/20 text-white h-11 text-base" />
              {busca && (
                <button type="button" onClick={() => setBusca('')} aria-label="Limpar pesquisa"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip ativo={situacao === 'faltam'} onClick={() => setSituacao('faltam')}>Faltam ({numeros.faltam})</Chip>
              <Chip ativo={situacao === 'presentes'} onClick={() => setSituacao('presentes')}>Presentes ({numeros.presentes})</Chip>
              <Chip ativo={situacao === 'todos'} onClick={() => setSituacao('todos')}>Todos ({numeros.total})</Chip>
              <span className="w-px bg-white/10 mx-1" />
              <Chip ativo={soMenores} onClick={() => setSoMenores(!soMenores)}>Só menores</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip ativo={!grupo} onClick={() => setGrupo('')}>Todos os grupos</Chip>
              {GROUPS.map((g) => <Chip key={g} ativo={grupo === g} onClick={() => setGrupo(g)}>{g}</Chip>)}
              <Chip ativo={grupo === 'sem'} onClick={() => setGrupo('sem')}>Sem grupo</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip ativo={!onibusFiltro} onClick={() => setOnibusFiltro('')}>Todos os ônibus</Chip>
              {divisao.onibus.map((o) => (
                <Chip key={o.numero} ativo={onibusFiltro === String(o.numero)} onClick={() => setOnibusFiltro(String(o.numero))}>Ônibus {o.numero}</Chip>
              ))}
              <Chip ativo={onibusFiltro === 'sem'} onClick={() => setOnibusFiltro('sem')}>Sem ônibus</Chip>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-gray-400">
            <span>{filtrados.length} {filtrados.length === 1 ? 'acampante' : 'acampantes'}</span>
            <button type="button" onClick={() => carregar(true)} className="inline-flex items-center gap-1.5 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />Atualizar
            </button>
          </div>

          {filtrados.length === 0 ? (
            <p className="py-10 text-center text-gray-500">Ninguém encontrado com esses filtros.</p>
          ) : (
            <div className="space-y-2">
              {filtrados.slice(0, limite).map((p) => (
                <CartaoPessoa key={`${chave(p)}:${p.observacao || ''}`} p={p} numeroOnibus={onibusDe(p)} travada={travada}
                  onChegou={setChegando} onAtualizado={() => carregar(true)} />
              ))}
              {filtrados.length > limite && (
                <Button variant="outline" onClick={() => setLimite(limite + POR_PAGINA)}
                  className="w-full border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
                  Mostrar mais ({filtrados.length - limite} restantes)
                </Button>
              )}
            </div>
          )}

          {!encerrada && (
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-gray-400 flex-1">
                Terminou de receber todo mundo? Encerre a chamada para os organizadores conferirem no sítio.
              </p>
              <Button onClick={() => setEncerrarAberto(true)} variant="outline"
                className="border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white">
                <Flag className="w-4 h-4 mr-1.5" />Encerrar chamada
              </Button>
            </div>
          )}
        </>
      )}

      {numeros.faltam > 0 && encerrada && aba === 'chamada' && (
        <p className="flex items-center gap-1.5 text-xs text-amber-300"><AlertTriangle className="w-3.5 h-3.5" />{numeros.faltam} sem presença na chamada encerrada.</p>
      )}
    </div>
  );

  return (
    <>
      <Helmet><title>Recepção - Metanoia Radical</title></Helmet>

      {ehOrganizador ? (
        <Layout largo>
          <div className="space-y-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ClipboardCheck className="w-6 h-6 text-emerald-400" /> Recepção · Acampantes
                </h1>
                <p className="text-sm text-gray-400">A mesma tela que a recepção da igreja vê no login Apoio.</p>
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
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" /> Recepção · Acampantes
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

      <GuiaDialog aberto={guiaAberto} onFechar={() => setGuiaAberto(false)} />
      <ChegouDialog pessoa={chegando} numeroOnibus={chegando ? onibusDe(chegando) : null} onFechar={() => setChegando(null)}
        onFeito={() => { setChegando(null); carregar(true); }} />
      <EncerrarDialog aberto={encerrarAberto} numeros={numeros} onFechar={() => setEncerrarAberto(false)}
        onFeito={() => { setEncerrarAberto(false); carregar(true); }} />
    </>
  );
};

export default RecepcaoPage;
