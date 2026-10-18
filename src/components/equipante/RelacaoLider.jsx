import React, {
  memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState
} from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, Loader2, MessageCircle,
  Plus, RefreshCw, Search, Send, Trash2, Truck, UserCog, Users, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { areaExtraPorChave, rotuloAreaExtra } from '@/constants/areasExtra';
import { formatarTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';
import {
  fetchRelacaoLider, marcarPresenca, salvarGrupoLider, marcarConviteLider, linkWhatsApp,
  trocarAtuacaoLider, definirCorLider, delegarReuniao,
  buscarParaAreaExtra, incluirNaAreaExtra, removerDaAreaExtra
} from '@/services/liderService';

/**
 * "Minha equipe" -- a relacao do lider, no acompanhamento da inscricao.
 *
 * Pedido do Patrick (05/10/2026): depois que a escala PROVISORIA sai, cada
 * lider ve quem esta escalado na sua area (nome completo, igreja e
 * telefone) e faz a CHAMADA na reuniao de escala, como chamada de escola.
 * Toda nova alocacao aparece sozinha (a relacao se atualiza a cada 15 s).
 * Sem codigo de lider: vale a mesma prova de dono do acompanhamento.
 *
 * 15/10/2026 (lider v2):
 *  - so aparece depois que a pessoa viu a propria area;
 *  - uma ABA por equipe (lider de mais de uma area, responsavel pela
 *    reuniao de outra, lider de area extra), um toque troca de uma pra outra;
 *  - busca e filtros, sempre em ordem alfabetica;
 *  - o lider troca a atuacao (areas com 2+ atuacoes alem do lider, menos
 *    Guia) e, so na Fotografia, a cor;
 *  - o Invisivel de cada cor ve tambem os Marcadores da cor (selo Marcador);
 *  - "Delegar reuniao": outra pessoa da equipe faz a chamada e o grupo;
 *  - lider de area extra ve os aprovados e pode puxar mais gente.
 *
 * Feito para celular: so a aba aberta e desenhada, cada linha so redesenha
 * quando os dados DELA mudam, e a atualizacao automatica para quando a tela
 * esta em segundo plano.
 */

const CORES = { Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444' };
const LISTA_CORES = Object.keys(CORES);

const TEXTO_PENDENCIA = {
  telefone: 'WhatsApp fora do padrão',
  igreja: 'falta a igreja',
  autorizacao: 'falta a autorização dos pais (menor de idade)'
};

const ATUALIZAR_A_CADA_MS = 15000;

// Linhas longas so sao desenhadas quando chegam perto da tela.
const LINHA_LEVE = { contentVisibility: 'auto', containIntrinsicSize: 'auto 104px' };

const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const Cor = ({ cor }) => cor ? (
  <span className="inline-flex items-center gap-1 text-xs text-gray-300">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[cor] || '#999' }} />
    {cor}
  </span>
) : null;

// "Maria da Silva Souza" -> "Maria da Silva" (nome e primeiro sobrenome).
const nomeCurto = (nome) => {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  const ligas = ['da', 'de', 'do', 'das', 'dos', 'e'];
  const out = [partes[0]];
  for (let i = 1; i < partes.length; i += 1) {
    out.push(partes[i]);
    if (!ligas.includes(partes[i].toLowerCase())) break;
  }
  return out.join(' ');
};

// Responsaveis pela reuniao de uma equipe (lista; telas antigas tinham um so).
const responsaveisDe = (e) => e?.delegados || (e?.delegado ? [e.delegado] : []);

const tituloEquipe = (e) => `${e.area}${e.cor ? ` · ${e.cor}` : ''}`;

const telefoneVisivel = (m) => (m.whatsapp ? (m.estrangeiro ? m.whatsapp : formatarTelefone(m.whatsapp)) : 'Sem telefone');

const RelacaoLider = ({ equipanteId, dono: donoBruto, liderDe = [], delegadoDe = [], liderExtraDe = [], onPresencaPropria }) => {
  const { toast } = useToast();
  // O mesmo objeto enquanto CPF/nome/nascimento nao mudam: sem isso as
  // funcoes de cada linha mudariam a cada desenho e a lista inteira redesenharia.
  const dono = useMemo(() => donoBruto, [donoBruto?.cpf, donoBruto?.nome, donoBruto?.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps
  const [aberta, setAberta] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState({});
  const [aba, setAba] = useState(null);
  const [delegando, setDelegando] = useState(false);
  const temDados = useRef(false);
  // Atualizacao que saiu ANTES de um toque (presenca, atuacao...) chega com
  // a lista velha: e descartada, senao o botao "voltava" por um instante.
  const versao = useRef(0);
  const emVoo = useRef(0);

  const carregar = useCallback(async (silencioso = false) => {
    const v = versao.current;
    if (!silencioso) setCarregando(true);
    const r = await fetchRelacaoLider(equipanteId, dono);
    if (!silencioso) setCarregando(false);
    if (r.ok) {
      if (silencioso && (emVoo.current > 0 || v !== versao.current)) return;
      temDados.current = true;
      setDados(r);
      setErro('');
    } else if (!silencioso || !temDados.current) {
      setErro(r.erro || 'Não foi possível abrir a relação.');
    }
  }, [equipanteId, dono?.cpf, dono?.nome, dono?.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Atualiza sozinha -- mas so com a tela a vista (celular no bolso nao
  // fica baixando a lista).
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) carregar(true);
    }, ATUALIZAR_A_CADA_MS);
    const aoVoltar = () => { if (!document.hidden) carregar(true); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [carregar]);

  // Muda um membro na tela na hora (o toque responde sem esperar o servidor).
  const ajustarMembro = useCallback((escalaId, mudanca) => {
    versao.current += 1;
    setDados((d) => d && ({
      ...d,
      equipes: (d.equipes || []).map((e) => (
        (e.membros || []).some((m) => m.escala_id === escalaId)
          ? { ...e, membros: e.membros.map((m) => (m.escala_id === escalaId ? { ...m, ...mudanca } : m)) }
          : e))
    }));
  }, []);

  // Executa uma acao e recarrega a relacao. `id` marca o botao como ocupado.
  const agir = useCallback(async (id, acao, sucesso) => {
    setOcupado((o) => ({ ...o, [id]: true }));
    emVoo.current += 1;
    const r = await acao();
    emVoo.current -= 1;
    versao.current += 1;
    setOcupado((o) => { const c = { ...o }; delete c[id]; return c; });
    if (!r.ok) {
      toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' });
      await carregar(true);
      return r;
    }
    if (sucesso) toast({ title: sucesso(r), className: 'bg-green-600 text-white' });
    await carregar(true);
    return r;
  }, [carregar, toast]);

  const onPresenca = useCallback((m, presente) => {
    ajustarMembro(m.escala_id, { presente });
    agir(`p-${m.escala_id}`, () => marcarPresenca(equipanteId, dono, m.escala_id, presente))
      .then((r) => { if (r.ok && m.eu) onPresencaPropria?.(); });
  }, [agir, ajustarMembro, equipanteId, dono, onPresencaPropria]);

  const onConvite = useCallback((m) => {
    agir(`c-${m.escala_id}`, () => marcarConviteLider(equipanteId, dono, m.escala_id));
  }, [agir, equipanteId, dono]);

  const onAtuacao = useCallback((m, atuacao) => {
    ajustarMembro(m.escala_id, { atuacao });
    agir(`e-${m.escala_id}`, () => trocarAtuacaoLider(equipanteId, dono, m.escala_id, atuacao),
      () => `${(m.nome || '').split(' ')[0]} agora é ${atuacao}`);
  }, [agir, ajustarMembro, equipanteId, dono]);

  const onCor = useCallback((m, cor) => {
    ajustarMembro(m.escala_id, { cor: cor || null });
    agir(`e-${m.escala_id}`, () => definirCorLider(equipanteId, dono, m.escala_id, cor),
      () => (cor ? `${(m.nome || '').split(' ')[0]} agora é ${cor}` : 'Cor retirada'));
  }, [agir, ajustarMembro, equipanteId, dono]);

  const equipes = dados?.equipes || [];
  const extras = dados?.extras || [];

  const abas = useMemo(() => [
    ...equipes.map((e) => ({
      chave: `e:${e.chave}`, tipo: 'equipe', equipe: e,
      rotulo: tituloEquipe(e), selo: e.papel === 'delegado' ? 'reunião' : null
    })),
    ...extras.map((x) => ({
      chave: `x:${x.area}`, tipo: 'extra', extra: x,
      rotulo: rotuloAreaExtra(x.area), selo: 'extra'
    }))
  ], [equipes, extras]);

  const abaAtual = abas.find((a) => a.chave === aba) || abas[0] || null;
  const equipeAtual = abaAtual?.tipo === 'equipe' ? abaAtual.equipe : null;
  const podeDelegar = equipeAtual?.papel === 'lider';

  const titulo = liderDe.length > 0
    ? `Você é líder: ${liderDe.map(tituloEquipe).join(', ')}`
    : delegadoDe.length > 0
      ? `Responsável pela reunião: ${delegadoDe.map(tituloEquipe).join(', ')}`
      : `Líder da área extra: ${liderExtraDe.map(rotuloAreaExtra).join(', ')}`;

  return (
    <div id="relacao-lider" className="bg-black/40 border border-amber-500/30 rounded-xl p-4 sm:p-6 scroll-mt-20">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Users className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-lg leading-snug">{titulo}</h3>
            <p className="text-gray-400 text-sm">A lista se atualiza sozinha, sempre em ordem alfabética.</p>
          </div>
        </div>
        {/* Celular: Atualizar e Esconder lado a lado, Delegar na linha de
            baixo, inteiro (o nome e grande). */}
        <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
          <Button variant="outline" onClick={() => carregar()} disabled={carregando}
            className="h-10 border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white">
            {carregando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Atualizar
          </Button>
          <Button variant="ghost" onClick={() => setAberta((v) => !v)}
            className="h-10 text-gray-400 hover:text-white hover:bg-white/10 sm:order-last">
            {aberta ? <><ChevronUp className="w-4 h-4 mr-1" /> Esconder</> : <><ChevronDown className="w-4 h-4 mr-1" /> Mostrar</>}
          </Button>
          {podeDelegar && (
            <Button variant="outline" onClick={() => setDelegando(true)}
              title="Delegar responsável pela reunião da escala"
              className="col-span-2 h-10 border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/10 hover:text-amber-100">
              <UserCog className="w-4 h-4 mr-1.5 shrink-0" />
              <span className="truncate">Delegar responsável pela reunião</span>
            </Button>
          )}
        </div>
        {/* Quem conduz a reuniao, com o nome completo, logo abaixo do botao.
            Pode ter mais de um, e de outra area (17/10/2026). */}
        {podeDelegar && responsaveisDe(equipeAtual).length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm space-y-1">
            {responsaveisDe(equipeAtual).map((d) => (
              <div key={d.equipante_id}>
                <p className="text-amber-100">
                  <UserCog className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                  Responsável pela reunião{abas.length > 1 ? ` (${tituloEquipe(equipeAtual)})` : ''}:{' '}
                  <strong className="text-white">{d.nome}</strong>
                  {d.de_fora && <span className="text-xs text-sky-200"> · de outra área</span>}
                </p>
                {d.definido_por && (
                  <p className="text-xs text-amber-200/70 mt-0.5">definido por {d.definido_por}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {aberta && !dados && (
        <div className="mt-5 text-center text-gray-400 py-6">
          {carregando ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (erro || 'Carregando...')}
        </div>
      )}

      {aberta && dados && abas.length > 1 && (
        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto pb-1 px-1" role="tablist">
          {abas.map((a) => {
            const ativa = a.chave === abaAtual?.chave;
            return (
              <button key={a.chave} type="button" role="tab" aria-selected={ativa}
                onClick={() => setAba(a.chave)}
                className={cn('shrink-0 rounded-full border px-3 py-2 text-sm font-medium flex items-center gap-1.5',
                  ativa ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-white/15 bg-white/5 text-gray-300')}>
                {a.tipo === 'extra' && <Truck className="w-3.5 h-3.5" />}
                {a.rotulo}
                {a.selo === 'reunião' && <span className="text-[10px] uppercase text-amber-300/80">reunião</span>}
              </button>
            );
          })}
        </div>
      )}

      {aberta && dados && abas.length === 0 && (
        <p className="mt-5 text-sm text-gray-400">Nenhuma equipe por enquanto.</p>
      )}

      {aberta && dados && abaAtual?.tipo === 'equipe' && (
        <div className="mt-5">
          <Equipe
            key={abaAtual.chave}
            equipe={abaAtual.equipe}
            ocupado={ocupado}
            onPresenca={onPresenca}
            onConvite={onConvite}
            onAtuacao={onAtuacao}
            onCor={onCor}
            remetente={dados.lider}
            onSalvarGrupo={(link) => agir(`g-${abaAtual.equipe.escala_id}`,
              () => salvarGrupoLider(equipanteId, dono, abaAtual.equipe.escala_id, link),
              (r) => (r.link ? 'Link do grupo salvo' : 'Link do grupo apagado'))}
          />
        </div>
      )}

      {aberta && dados && abaAtual?.tipo === 'extra' && (
        <div className="mt-5">
          <EquipeExtra key={abaAtual.chave} extra={abaAtual.extra} equipanteId={equipanteId} dono={dono}
            onMudou={() => carregar(true)} />
        </div>
      )}

      {delegando && equipeAtual && (
        <DelegarDialog equipe={equipeAtual}
          onClose={() => setDelegando(false)}
          onEscolher={async (pessoa) => {
            const r = await agir('delegar',
              () => delegarReuniao(equipanteId, dono, equipeAtual.area, equipeAtual.cor, pessoa?.equipante_id || null),
              () => (pessoa ? `${pessoa.nome} é o responsável pela reunião` : 'Responsável retirado'));
            if (r.ok) setDelegando(false);
          }}
          ocupado={!!ocupado.delegar} />
      )}
    </div>
  );
};

const Numero = ({ valor, rotulo, cor, ativo, onClick }) => (
  <button type="button" onClick={onClick}
    className={cn('rounded-lg border px-2 py-2 text-center',
      ativo ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-white/5')}>
    <p className={cn('text-2xl font-bold leading-none', cor)}>{valor}</p>
    <p className="text-[11px] text-gray-400 mt-1">{rotulo}</p>
  </button>
);

const FILTROS = {
  todos: () => true,
  presentes: (m) => m.presente === true,
  ausentes: (m) => m.presente === false,
  sem_chamada: (m) => m.presente !== true && m.presente !== false,
  pendencia: (m) => m.pendencias?.length > 0,
  // Quem vem de outra area para a reuniao desta equipe (Marcadores na
  // Invisivel, Perseguidos na Selva).
  agregados: (m, equipe) => m.area !== equipe.area,
  da_area: (m, equipe) => m.area === equipe.area
};

// Area que se reune junto com esta equipe (17/10/2026).
const AGREGADOS = {
  'Invisível': { area: 'Marcador', um: 'marcador', varios: 'Marcadores' },
  'Selva': { area: 'Perseguidos', um: 'perseguido', varios: 'Perseguidos' }
};

const Equipe = ({ equipe, ocupado, onPresenca, onConvite, onAtuacao, onCor, onSalvarGrupo, remetente }) => {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [atuacao, setAtuacao] = useState('');
  const termo = semAcento(useDeferredValue(busca).trim());

  const membros = useMemo(() => [...(equipe.membros || [])].sort(porNome), [equipe.membros]);

  const contas = useMemo(() => {
    const c = { total: membros.length, presentes: 0, ausentes: 0, sem: 0, pend: 0, agregados: 0 };
    membros.forEach((m) => {
      if (m.presente === true) c.presentes += 1;
      else if (m.presente === false) c.ausentes += 1;
      else c.sem += 1;
      if (m.pendencias?.length) c.pend += 1;
      if (m.area !== equipe.area) c.agregados += 1;
    });
    return c;
  }, [membros, equipe.area]);
  const agregado = AGREGADOS[equipe.area];

  const atuacoesNaLista = useMemo(
    () => [...new Set(membros.map((m) => m.atuacao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [membros]);

  const mostrados = useMemo(() => membros.filter((m) => FILTROS[filtro](m, equipe)
    && (!atuacao || m.atuacao === atuacao)
    && (!termo || semAcento(`${m.nome} ${nomeDaIgreja(m) || ''} ${m.whatsapp || ''}`).includes(termo))),
  [membros, filtro, atuacao, termo, equipe]);

  // O proprio lider criou o grupo -- nao precisa de convite.
  const prontosConvite = useMemo(
    () => membros.filter((m) => m.presente === true && !m.pendencias?.length && !m.eu), [membros]);

  const alternarFiltro = (f) => setFiltro((atual) => (atual === f ? 'todos' : f));
  const filtrando = filtro !== 'todos' || atuacao || termo;

  return (
    <section className="space-y-4">
      <div className="border-b border-white/10 pb-3 space-y-3">
        <h4 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
          {equipe.area} <Cor cor={equipe.cor} />
        </h4>

        {equipe.papel === 'delegado' ? (
          <p className="text-xs text-amber-200/90">
            Você é o <strong>responsável pela reunião</strong> desta equipe
            {equipe.lideres?.length ? ` (líder: ${equipe.lideres.join(', ')})` : ''}. Faça a chamada e mande o convite do grupo.
          </p>
        ) : null}

        <div className="grid grid-cols-4 gap-2">
          <Numero valor={contas.total} rotulo={contas.total === 1 ? 'pessoa' : 'pessoas'} cor="text-white"
            ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
          <Numero valor={contas.presentes} rotulo="presentes" cor="text-green-400"
            ativo={filtro === 'presentes'} onClick={() => alternarFiltro('presentes')} />
          <Numero valor={contas.ausentes} rotulo="ausentes" cor="text-red-400"
            ativo={filtro === 'ausentes'} onClick={() => alternarFiltro('ausentes')} />
          <Numero valor={contas.sem} rotulo="sem chamada" cor="text-gray-300"
            ativo={filtro === 'sem_chamada'} onClick={() => alternarFiltro('sem_chamada')} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, igreja ou telefone"
              inputMode="search" className="h-10 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          {atuacoesNaLista.length > 1 && (
            <select value={atuacao} onChange={(e) => setAtuacao(e.target.value)} aria-label="Filtrar por atuação"
              className="h-10 rounded-md border border-white/20 bg-black/40 px-2 text-sm text-white">
              <option value="">Todas as atuações</option>
              {atuacoesNaLista.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {/* Invisivel + Marcadores, Selva + Perseguidos: quantos de cada e o total. */}
        {agregado && contas.agregados > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {/* Total primeiro e ja marcado: o lider faz a chamada de todos
                (Perseguidos/Marcadores juntos) sem precisar descobrir o filtro. */}
            <button type="button" onClick={() => setFiltro('todos')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'todos' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-white/20 text-gray-200')}>
              Total: <strong>{contas.total}</strong>
            </button>
            <button type="button" onClick={() => alternarFiltro('da_area')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'da_area' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-white/20 text-gray-300')}>
              {equipe.area}: <strong>{contas.total - contas.agregados}</strong>
            </button>
            <button type="button" onClick={() => alternarFiltro('agregados')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'agregados' ? 'border-sky-400 bg-sky-400/15 text-sky-100' : 'border-sky-500/30 text-sky-300')}>
              {agregado.varios}: <strong>{contas.agregados}</strong>
            </button>
          </div>
        )}

        {contas.pend > 0 && (
          <div className="flex flex-wrap gap-2">
            {contas.pend > 0 && (
              <button type="button" onClick={() => alternarFiltro('pendencia')}
                className={cn('rounded-full border px-3 py-1 text-xs',
                  filtro === 'pendencia' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-amber-500/30 text-amber-300')}>
                {contas.pend} com pendência no cadastro
              </button>
            )}
          </div>
        )}

        {filtrando && (
          <p className="text-xs text-gray-400">
            Mostrando {mostrados.length} de {membros.length}.{' '}
            <button type="button" className="text-sky-300 underline"
              onClick={() => { setBusca(''); setFiltro('todos'); setAtuacao(''); }}>
              limpar
            </button>
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {mostrados.map((m) => (
          <Membro key={m.escala_id} m={m} grupoLink={equipe.grupo_link} area={equipe.area} remetente={remetente}
            atuacoes={!m.eh_lider && m.area === equipe.area ? equipe.atuacoes : null}
            responsavel={responsaveisDe(equipe).some((d) => d.equipante_id === m.equipante_id)}
            podeCor={equipe.pode_trocar_cor && !m.eh_lider}
            ocupadoPresenca={!!ocupado[`p-${m.escala_id}`]}
            ocupadoConvite={!!ocupado[`c-${m.escala_id}`]}
            ocupadoEdicao={!!ocupado[`e-${m.escala_id}`]}
            onPresenca={onPresenca} onConvite={onConvite} onAtuacao={onAtuacao} onCor={onCor} />
        ))}
        {membros.length === 0 && <li className="text-sm text-gray-500">Ninguém nesta equipe ainda.</li>}
        {membros.length > 0 && mostrados.length === 0 && <li className="text-sm text-gray-500">Ninguém com esse filtro.</li>}
      </ul>

      {equipe.escala_id && (
        <GrupoWhatsApp equipe={equipe} prontos={prontosConvite} ocupado={!!ocupado[`g-${equipe.escala_id}`]}
          onSalvar={onSalvarGrupo} />
      )}
    </section>
  );
};

const mesmasProps = (a, b) => (
  a.grupoLink === b.grupoLink && a.area === b.area && a.remetente === b.remetente && a.podeCor === b.podeCor && a.responsavel === b.responsavel
  && (a.atuacoes === b.atuacoes || JSON.stringify(a.atuacoes) === JSON.stringify(b.atuacoes))
  && a.ocupadoPresenca === b.ocupadoPresenca && a.ocupadoConvite === b.ocupadoConvite
  && a.ocupadoEdicao === b.ocupadoEdicao
  && a.onPresenca === b.onPresenca && a.onConvite === b.onConvite && a.onAtuacao === b.onAtuacao && a.onCor === b.onCor
  && (a.m === b.m || JSON.stringify(a.m) === JSON.stringify(b.m))
);

const Membro = memo(({ m, grupoLink, area, remetente, atuacoes, podeCor, responsavel, ocupadoPresenca, ocupadoConvite, ocupadoEdicao,
  onPresenca, onConvite, onAtuacao, onCor }) => {
  const pendente = m.pendencias?.length > 0;
  const zap = linkWhatsApp(m.whatsapp, m.estrangeiro);
  const podeConvidar = grupoLink && m.presente === true && !pendente && !m.eu;
  // Marcador na lista da Invisivel, Perseguido na lista da Selva.
  const etiquetaAgregado = m.area !== area ? (m.area === 'Perseguidos' ? 'Perseguido' : m.area) : null;

  // Sem o nome da area na mensagem (17/10/2026, Patrick): so quem esta
  // mandando -- o lider ou o responsavel pela reuniao.
  const enviarConvite = () => {
    const quem = nomeCurto(remetente);
    const texto = `Olá, ${(m.nome || '').split(' ')[0]}! Aqui é ${quem ? `${quem}, ` : ''}da equipe do Metanoia Radical Serra. `
      + `Entre no nosso grupo pelo link: ${grupoLink}`;
    const link = linkWhatsApp(m.whatsapp, m.estrangeiro, texto);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    onConvite(m);
  };

  return (
    <li style={LINHA_LEVE} className={cn('rounded-lg border p-3',
      pendente ? 'border-amber-500/40 bg-amber-500/5'
        : m.presente === true ? 'border-green-500/30 bg-green-500/5'
          : m.presente === false ? 'border-red-500/30 bg-red-500/5'
            : 'border-white/10 bg-white/5')}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium flex items-center gap-2 flex-wrap">
            {m.nome}
            {m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">você</span>}
            {m.eh_lider && !m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">líder</span>}
            {etiquetaAgregado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">{etiquetaAgregado}</span>}
            {responsavel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                responsável pela reunião
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 truncate">{nomeDaIgreja(m) || 'Igreja não informada'}</p>
          <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5 flex-wrap">
            {telefoneVisivel(m)}
            {zap && (
              <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp"
                className="text-green-400 hover:text-green-300">
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
            {!atuacoes && m.atuacao && <span className="text-xs text-gray-500">· {m.atuacao}</span>}
            {!podeCor && m.cor && <Cor cor={m.cor} />}
          </p>

          {(atuacoes || podeCor) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {atuacoes && (
                <select value={m.atuacao || ''} disabled={ocupadoEdicao}
                  onChange={(e) => onAtuacao(m, e.target.value)} aria-label={`Atuação de ${m.nome}`}
                  className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white">
                  {!atuacoes.includes(m.atuacao) && <option value={m.atuacao || ''}>{m.atuacao || 'Sem atuação'}</option>}
                  {atuacoes.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {podeCor && (
                <select value={m.cor || ''} disabled={ocupadoEdicao}
                  onChange={(e) => onCor(m, e.target.value)} aria-label={`Cor de ${m.nome}`}
                  className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white">
                  <option value="">Sem cor</option>
                  {LISTA_CORES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {podeCor && m.cor && <span className="h-3 w-3 rounded-full" style={{ background: CORES[m.cor] }} />}
              {ocupadoEdicao && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 shrink-0">
          <Button size="sm" disabled={ocupadoPresenca}
            onClick={() => onPresenca(m, m.presente === true ? null : true)}
            className={cn('h-10 px-3', m.presente === true
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-transparent border border-green-600/50 text-green-300 hover:bg-green-600/20')}>
            <Check className="w-4 h-4 mr-1" /> Presente
          </Button>
          <Button size="sm" disabled={ocupadoPresenca}
            onClick={() => onPresenca(m, m.presente === false ? null : false)}
            className={cn('h-10 px-3', m.presente === false
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-transparent border border-red-600/50 text-red-300 hover:bg-red-600/20')}>
            <X className="w-4 h-4 mr-1" /> Ausente
          </Button>
        </div>
      </div>

      {pendente && (
        <p className="mt-2 text-xs text-amber-200 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Cadastro com pendência: {m.pendencias.map((p) => TEXTO_PENDENCIA[p.tipo] || p.tipo).join(', ')}.
            A pessoa precisa corrigir no acompanhamento da inscrição dela (site → Equipante → CPF).
          </span>
        </p>
      )}

      {podeConvidar && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={enviarConvite} disabled={ocupadoConvite}
            className={cn('h-8', m.convite_enviado_em
              ? 'bg-transparent border border-white/20 text-gray-300 hover:bg-white/10'
              : 'bg-[#25D366] hover:bg-[#20bd5a] text-white')}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {m.convite_enviado_em ? 'Reenviar convite' : 'Enviar convite do grupo'}
          </Button>
          {m.convite_enviado_em && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> convite enviado
            </span>
          )}
        </div>
      )}
    </li>
  );
}, mesmasProps);
Membro.displayName = 'Membro';

// "Delegar responsável pela reuniao da escala": quem faz a chamada e o grupo
// quando o lider nao vai estar. So gente da propria equipe.
const DelegarDialog = ({ equipe, onClose, onEscolher, ocupado }) => {
  const [busca, setBusca] = useState('');
  // O que o lider escolhe e o responsavel de DENTRO da equipe; os de outra
  // area, postos pela organizacao, nao mudam por aqui.
  const doLider = responsaveisDe(equipe).find((d) => !d.de_fora) || null;
  const termo = semAcento(busca.trim());
  const candidatos = useMemo(() => (equipe.membros || [])
    .filter((m) => !m.eu && m.area === equipe.area)
    .filter((m) => !termo || semAcento(m.nome).includes(termo))
    .sort(porNome), [equipe, termo]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-neutral-950"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10 flex items-start gap-3">
          <UserCog className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold leading-snug">Delegar responsável pela reunião da escala</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              {tituloEquipe(equipe)} · a pessoa escolhida faz a chamada e o grupo do WhatsApp. Você continua com acesso.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {doLider && (
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <p className="flex-1 text-sm text-gray-200">
              Hoje: <strong className="text-white">{doLider.nome}</strong>
            </p>
            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => onEscolher(null)}
              className="text-red-300 hover:text-red-200 hover:bg-white/10">
              Tirar
            </Button>
          </div>
        )}

        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na equipe"
              className="h-10 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {candidatos.map((m) => {
            const atual = doLider?.equipante_id === m.equipante_id;
            return (
              <li key={m.escala_id}>
                <button type="button" disabled={ocupado || atual} onClick={() => onEscolher(m)}
                  className={cn('w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-2',
                    atual ? 'bg-amber-500/15 text-amber-100' : 'hover:bg-white/10 text-gray-100')}>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{m.nome}</span>
                    <span className="block text-xs text-gray-500 truncate">{m.atuacao}{m.eh_lider ? ' · líder' : ''}</span>
                  </span>
                  {atual ? <Check className="w-4 h-4" /> : ocupado ? null : <Plus className="w-4 h-4 text-gray-500" />}
                </button>
              </li>
            );
          })}
          {candidatos.length === 0 && <li className="text-sm text-gray-500 text-center py-6">Ninguém encontrado.</li>}
        </ul>
      </div>
    </div>
  );
};

// Area extra (caminhao, cozinha, limpeza): os aprovados pela organizacao e
// quem o lider puxou. O lider so tira quem ele mesmo incluiu.
const EquipeExtra = ({ extra, equipanteId, dono, onMudou }) => {
  const { toast } = useToast();
  const info = areaExtraPorChave(extra.area);
  const [busca, setBusca] = useState('');
  const [procura, setProcura] = useState('');
  const [achados, setAchados] = useState([]);
  const [procurando, setProcurando] = useState(false);
  const [ocupado, setOcupado] = useState({});
  const termo = semAcento(useDeferredValue(busca).trim());

  const membros = useMemo(() => [...(extra.membros || [])].sort(porNome), [extra.membros]);
  const mostrados = useMemo(() => membros.filter((m) => !termo
    || semAcento(`${m.nome} ${nomeDaIgreja(m) || ''} ${m.whatsapp || ''}`).includes(termo)), [membros, termo]);

  // Busca de quem puxar: espera a pessoa parar de digitar.
  useEffect(() => {
    const t = procura.trim();
    if (t.length < 3) { setAchados([]); return undefined; }
    let vivo = true;
    const timer = setTimeout(async () => {
      setProcurando(true);
      const r = await buscarParaAreaExtra(equipanteId, dono, extra.area, t);
      if (!vivo) return;
      setProcurando(false);
      setAchados(r.ok ? (r.pessoas || []) : []);
    }, 400);
    return () => { vivo = false; clearTimeout(timer); };
  }, [procura, equipanteId, dono, extra.area]);

  const agir = async (id, acao, sucesso) => {
    setOcupado((o) => ({ ...o, [id]: true }));
    const r = await acao();
    setOcupado((o) => { const c = { ...o }; delete c[id]; return c; });
    if (!r.ok) {
      toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' });
      return;
    }
    toast({ title: sucesso, className: 'bg-green-600 text-white' });
    onMudou();
  };

  return (
    <section className="space-y-4">
      <div className="border-b border-white/10 pb-3 space-y-3">
        <h4 className="text-xl font-bold text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-300" /> {info?.rotulo || extra.area}
        </h4>
        {info?.detalhe && <p className="text-xs text-gray-400">{info.detalhe}</p>}
        <p className="text-sm text-gray-300">
          <strong className="text-white">{membros.length}</strong> {membros.length === 1 ? 'pessoa' : 'pessoas'} na lista
          (aprovadas pela organização ou incluídas por você).
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na lista"
            inputMode="search" className="h-10 pl-8 bg-black/40 border-white/20 text-white" />
        </div>
      </div>

      <ul className="space-y-2">
        {mostrados.map((m) => {
          const zap = linkWhatsApp(m.whatsapp, m.estrangeiro);
          return (
            <li key={m.equipante_id} style={LINHA_LEVE} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium flex items-center gap-2 flex-wrap">
                  {m.nome}
                  {m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">você</span>}
                  {m.incluido_pelo_lider && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">incluído por você</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{nomeDaIgreja(m) || 'Igreja não informada'}</p>
                <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5">
                  {telefoneVisivel(m)}
                  {zap && (
                    <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp"
                      className="text-green-400 hover:text-green-300">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </p>
              </div>
              {m.incluido_pelo_lider && !m.eu && (
                <Button size="sm" variant="ghost" disabled={!!ocupado[`r-${m.equipante_id}`]}
                  onClick={() => agir(`r-${m.equipante_id}`,
                    () => removerDaAreaExtra(equipanteId, dono, extra.area, m.equipante_id), 'Retirado da lista')}
                  aria-label={`Tirar ${m.nome} da lista`}
                  className="text-gray-400 hover:text-red-300 hover:bg-white/10 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </li>
          );
        })}
        {membros.length === 0 && <li className="text-sm text-gray-500">Ninguém aprovado ainda.</li>}
        {membros.length > 0 && mostrados.length === 0 && <li className="text-sm text-gray-500">Ninguém com essa busca.</li>}
      </ul>

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
        <p className="text-white font-medium flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-300" /> Puxar alguém para a lista
        </p>
        <Input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Digite pelo menos 3 letras do nome"
          className="h-10 bg-black/40 border-white/20 text-white" />
        {procurando && <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Procurando...</p>}
        {!procurando && procura.trim().length >= 3 && achados.length === 0 && (
          <p className="text-xs text-gray-400">Ninguém encontrado (ou já está na lista).</p>
        )}
        <ul className="space-y-1">
          {achados.map((p) => (
            <li key={p.equipante_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-100 truncate">{p.nome}</span>
                <span className="block text-xs text-gray-500 truncate">{nomeDaIgreja(p) || ''}</span>
              </span>
              <Button size="sm" disabled={!!ocupado[`i-${p.equipante_id}`]}
                onClick={async () => {
                  await agir(`i-${p.equipante_id}`,
                    () => incluirNaAreaExtra(equipanteId, dono, extra.area, p.equipante_id), `${p.nome} incluído`);
                  setAchados((l) => l.filter((x) => x.equipante_id !== p.equipante_id));
                }}
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                Incluir
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const GrupoWhatsApp = ({ equipe, prontos, ocupado, onSalvar }) => {
  const { toast } = useToast();
  const [editando, setEditando] = useState(!equipe.grupo_link);
  const [link, setLink] = useState(equipe.grupo_link || '');

  useEffect(() => {
    setEditando(!equipe.grupo_link);
    setLink(equipe.grupo_link || '');
  }, [equipe.grupo_link]);

  const enviados = prontos.filter((m) => m.convite_enviado_em).length;

  const copiarTelefones = async () => {
    const lista = prontos.map((m) => `${m.nome} - ${m.estrangeiro ? m.whatsapp : formatarTelefone(m.whatsapp)}`).join('\n');
    try {
      await navigator.clipboard.writeText(lista);
      toast({ title: `${prontos.length} telefones copiados`, className: 'bg-green-600 text-white' });
    } catch {
      toast({ title: 'Não consegui copiar', description: 'Seu navegador bloqueou a área de transferência.', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 p-4 space-y-3">
      <p className="text-white font-medium flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#25D366]" /> Grupo de WhatsApp da equipe
      </p>

      {editando ? (
        <>
          <ol className="text-xs text-gray-300 list-decimal pl-4 space-y-0.5">
            <li>Crie o grupo no seu WhatsApp.</li>
            <li>No grupo, toque em “Convidar via link” e copie o link.</li>
            <li>Cole aqui. O botão de convite aparece para quem estiver <strong>presente e sem pendência</strong>.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="bg-black/40 border-white/20 text-white" />
            <div className="flex gap-2">
              <Button onClick={() => onSalvar(link)} disabled={ocupado || !link.trim()}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white">
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar link'}
              </Button>
              {equipe.grupo_link && (
                <Button variant="ghost" onClick={() => setEditando(false)} className="text-gray-400 hover:text-white hover:bg-white/10">
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-300 break-all">{equipe.grupo_link}</p>
          <p className="text-xs text-gray-400">
            {prontos.length === 0
              ? 'Ninguém liberado ainda: o convite aparece para quem for marcado presente e estiver sem pendência.'
              : `${prontos.length} liberados para o convite · ${enviados} já enviados.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {prontos.length > 0 && (
              <Button size="sm" variant="outline" onClick={copiarTelefones}
                className="border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white">
                <Copy className="w-4 h-4 mr-1.5" /> Copiar telefones dos presentes
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditando(true)}
              className="text-gray-400 hover:text-white hover:bg-white/10">
              Trocar link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSalvar('')} disabled={ocupado}
              className="text-gray-500 hover:text-red-300 hover:bg-white/10">
              Apagar link
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default RelacaoLider;
