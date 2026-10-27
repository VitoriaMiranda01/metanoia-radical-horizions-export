import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy, Loader2, MessageCircle, Pencil, Phone, RefreshCw, Search, Send, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import TagEspecialidade from '@/components/common/TagEspecialidade';
import CampoEspecialidadeSaude, { limparCacheEspecialidades } from '@/components/inscricao/CampoEspecialidadeSaude';
import EspecialidadesLista from '@/components/saude/EspecialidadesLista';
import { nomeDaIgreja } from '@/constants/igrejas';
import { ESPECIALIDADE_OUTRO, problemaEspecialidade } from '@/constants/especialidadesSaude';
import { linkWhatsApp } from '@/services/liderService';
import {
  fetchSaudeEquipe, definirEspecialidadeSaude, fetchEspecialidadesOutros, tornarEspecialidadeFixa, definirGrupoSaude,
} from '@/services/saudeService';
import { formatarTelefone } from '@/utils/telefone';
import { contemTexto, agruparTermos, rotuloEspecialidades } from '@/utils/saude';
import { GROUPS } from '@/utils/gruposTrailha';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { cn } from '@/lib/utils';

/**
 * "Equipe da Saúde" na tela da Saude (18/10/2026, pedido da Verinha via
 * Patrick): quem esta escalado em Primeiros socorros - Saude, com idade,
 * especialidade (tag), WhatsApp para chamar, o link do grupo da equipe para
 * enviar e o contato de emergencia. Busca, filtro por especialidade e
 * ordenacao. A lider corrige a especialidade de alguem pelo lapis.
 *
 * Organizador ve tambem o quadro do "Outro": o que foi escrito, quantas vezes
 * e por quem -- e pode tornar uma resposta opcao fixa da lista.
 */

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
// Principal + as demais (24/10/2026: a pessoa pode ter mais de uma).
const especialidades = (p) => [p.especialidade, ...(p.especialidades_adicionais || [])].filter(Boolean);

const Ordenar = ({ coluna, ordem, setOrdem, children }) => {
  const ativa = ordem.coluna === coluna;
  const Icone = !ativa ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => setOrdem({ coluna, asc: ativa ? !ordem.asc : true })}
      className={cn('inline-flex items-center gap-1 uppercase tracking-wide', ativa ? 'text-white' : 'hover:text-gray-300')}>
      {children}<Icone className="w-3 h-3" />
    </button>
  );
};

const temSaude = (a) => a.tem_problema_saude || a.usa_medicamento || a.tem_restricao_alimentar || a.esta_gravida
  || (a._termos && (a._termos.problema.length > 0 || a._termos.medicamento.length > 0 || a._termos.alimento.length > 0));

const EquipeSaude = ({ ehOrganizador = false, onTotal, acampantes = [] }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState({ equipe: [], grupoLink: null, lancada: true });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas'); // 'todas' | 'sem' | nome da especialidade | 'Outro'
  const [ordem, setOrdem] = useState({ coluna: 'nome', asc: true });
  const [editando, setEditando] = useState(null); // { id, esp, outro }
  const [salvando, setSalvando] = useState(false);
  const [outros, setOutros] = useState([]);
  const [fixando, setFixando] = useState(null);
  const [gravandoGrupo, setGravandoGrupo] = useState(null); // escala_id
  const [painel, setPainel] = useState(null); // cor aberta no painel da equipe do grupo
  const [buscaPainel, setBuscaPainel] = useState('');
  const [espPainel, setEspPainel] = useState('todas');
  const [listaVersao, setListaVersao] = useState(0); // "Tornar fixa" recarrega o quadro da lista

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const r = await fetchSaudeEquipe();
      setDados(r);
      onTotal?.(r.equipe.length);
      if (ehOrganizador) setOutros(await fetchEspecialidadesOutros().catch(() => []));
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar a equipe.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { equipe, grupoLink, lancada } = dados;

  // Quantos de cada especialidade (para os botoes de filtro).
  const contagem = useMemo(() => {
    const c = new Map();
    equipe.forEach((p) => especialidades(p).forEach((esp) => c.set(esp, (c.get(esp) || 0) + 1)));
    return [...c.entries()].sort((a, b) => (a[0] === ESPECIALIDADE_OUTRO) - (b[0] === ESPECIALIDADE_OUTRO) || b[1] - a[1]);
  }, [equipe]);
  const semEspecialidade = equipe.filter((p) => !p.especialidade).length;
  const semGrupo = equipe.filter((p) => !p.grupo_saude).length;

  const visiveis = useMemo(() => {
    const q = busca.trim();
    const lista = equipe.filter((p) => {
      if (filtro === 'sem' && p.especialidade) return false;
      if (filtro === 'semgrupo' && p.grupo_saude) return false;
      if (filtro !== 'todas' && filtro !== 'sem' && !especialidades(p).includes(filtro)) return false;
      if (q && ![p.nome, nomeDaIgreja(p), especialidades(p).join(' '), p.especialidade_outro, p.whatsapp].some((c) => contemTexto(c, q))) return false;
      return true;
    });
    const chave = {
      nome: (p) => (p.nome || '').toLowerCase(),
      idade: (p) => (p.idade == null ? 999 : p.idade),
      especialidade: (p) => `${p.especialidade ? '' : '~'}${especialidades(p).join(' ')} ${p.especialidade_outro || ''}`.toLowerCase(),
      igreja: (p) => nomeDaIgreja(p).toLowerCase(),
    }[ordem.coluna];
    return [...lista].sort((a, b) => {
      const x = chave(a); const y = chave(b);
      const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return ordem.asc ? r : -r;
    });
  }, [equipe, busca, filtro, ordem]);

  const textoGrupo = (p) => `Olá, ${primeiroNome(p.nome)}! Este é o grupo da equipe de Saúde do Metanoia Radical Serra: ${grupoLink}`;

  const copiarGrupo = async () => {
    try {
      await navigator.clipboard.writeText(grupoLink);
      toast({ title: 'Link do grupo copiado', className: 'bg-emerald-600 text-white' });
    } catch {
      toast({ title: 'Não deu para copiar', description: grupoLink });
    }
  };

  const salvarEspecialidade = async () => {
    const problema = problemaEspecialidade(editando.esp, editando.outro);
    if (problema) { toast({ title: 'Confira', description: problema, variant: 'destructive' }); return; }
    setSalvando(true);
    try {
      const r = await definirEspecialidadeSaude(editando.id, editando.esp, editando.esp === ESPECIALIDADE_OUTRO ? editando.outro.trim() : null, editando.adicionais);
      setDados((d) => ({
        ...d,
        equipe: d.equipe.map((p) => (p.id === editando.id
          ? { ...p, especialidade: editando.esp, especialidade_outro: editando.esp === ESPECIALIDADE_OUTRO ? editando.outro.trim() : null,
              especialidades_adicionais: r.adicionais || [] }
          : p)),
      }));
      setEditando(null);
      toast({ title: 'Especialidade salva', className: 'bg-emerald-600 text-white' });
      if (ehOrganizador) setOutros(await fetchEspecialidadesOutros().catch(() => []));
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  // Aloca (ou tira) o profissional de um grupo. Um so grupo por pessoa.
  const trocarGrupo = async (p, grupo) => {
    setGravandoGrupo(p.escala_id);
    try {
      await definirGrupoSaude(p.escala_id, grupo);
      setDados((d) => ({ ...d, equipe: d.equipe.map((x) => (x.escala_id === p.escala_id ? { ...x, grupo_saude: grupo || null } : x)) }));
    } catch (e) {
      toast({ title: 'Não foi possível salvar o grupo', description: e.message, variant: 'destructive' });
    } finally {
      setGravandoGrupo(null);
    }
  };

  // Demanda (patologias dos acampantes do grupo) x equipe alocada. So mostra.
  const cobertura = GROUPS.map((g) => {
    const doGrupo = acampantes.filter((a) => a.grupo_trailha === g && temSaude(a));
    return {
      grupo: g,
      total: doGrupo.length,
      problemas: agruparTermos(doGrupo, 'problema'),
      comMedicamento: doGrupo.filter((a) => a.usa_medicamento || a._termos?.medicamento.length > 0).length,
      comRestricao: doGrupo.filter((a) => a.tem_restricao_alimentar || a._termos?.alimento.length > 0).length,
      equipe: equipe.filter((p) => p.grupo_saude === g),
    };
  });

  const seletorGrupo = (p) => (
    <select
      value={p.grupo_saude || ''} disabled={gravandoGrupo === p.escala_id}
      onChange={(e) => trocarGrupo(p, e.target.value)}
      aria-label={`Grupo de ${primeiroNome(p.nome)}`}
      className="h-8 rounded-md border border-white/15 bg-neutral-900 px-2 text-xs text-gray-200 disabled:opacity-50"
    >
      <option value="">Sem grupo</option>
      {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
    </select>
  );

  const fixar = async (texto) => {
    if (!window.confirm(`Tornar “${texto}” uma opção fixa da lista?\n\nQuem escreveu isso em "Outro" passa para a opção nova, e as próximas pessoas já encontram “${texto}” para escolher.`)) return;
    setFixando(texto);
    try {
      const r = await tornarEspecialidadeFixa(texto);
      toast({ title: `“${r.nome}” agora é opção da lista`, description: `${r.pessoas} ${r.pessoas === 1 ? 'pessoa passou' : 'pessoas passaram'} para ela.`, className: 'bg-emerald-600 text-white' });
      limparCacheEspecialidades();
      setListaVersao((v) => v + 1);
      await carregar();
    } catch (e) {
      toast({ title: 'Não foi possível', description: e.message, variant: 'destructive' });
    } finally {
      setFixando(null);
    }
  };

  if (carregando && equipe.length === 0) {
    return <div className="py-20 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Carregando a equipe...</div>;
  }
  if (erro) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-300 mb-4">{erro}</p>
        <Button onClick={carregar} className="bg-white/10 hover:bg-white/20 text-white"><RefreshCw className="w-4 h-4 mr-1.5" />Tentar de novo</Button>
      </div>
    );
  }
  if (!lancada) {
    return <p className="py-16 text-center text-gray-400">A equipe aparece aqui quando a escala for divulgada.</p>;
  }

  // Funcoes de desenho (nao componentes): um componente criado dentro do
  // render remontaria a cada tecla e o campo da especialidade perderia o foco.
  const nome = (p) => (
    <p className="font-medium text-white flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {p.eh_lider && <Star className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-label="Líder" />}
      <span>{p.nome}</span>
      <TagEspecialidade especialidade={p.especialidade} outro={p.especialidade_outro} adicionais={p.especialidades_adicionais} semEspecialidade />
    </p>
  );

  const acoes = (p) => {
    const zap = linkWhatsApp(p.whatsapp, p.estrangeiro);
    const zapGrupo = grupoLink ? linkWhatsApp(p.whatsapp, p.estrangeiro, textoGrupo(p)) : null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {zap ? (
          <a href={zap} target="_blank" rel="noreferrer" title="Mandar mensagem no WhatsApp"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs hover:bg-emerald-500/20">
            <MessageCircle className="w-3.5 h-3.5" />Mensagem
          </a>
        ) : <span className="text-xs text-gray-500">Sem WhatsApp</span>}
        {zapGrupo && (
          <a href={zapGrupo} target="_blank" rel="noreferrer" title="Enviar o link do grupo da equipe para esta pessoa"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-200 text-xs hover:bg-sky-500/20">
            <Send className="w-3.5 h-3.5" />Enviar grupo
          </a>
        )}
        <button type="button" onClick={() => setEditando({ id: p.id, esp: p.especialidade || '', outro: p.especialidade_outro || '', adicionais: p.especialidades_adicionais || [] })}
          title="Corrigir a especialidade"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-white/15 bg-white/5 text-gray-300 text-xs hover:bg-white/10">
          <Pencil className="w-3.5 h-3.5" />Especialidade
        </button>
      </div>
    );
  };

  const edicao = (p) => (editando?.id === p.id ? (
    <div className="mt-2 p-3 rounded-md border border-white/15 bg-black/40 space-y-3">
      <CampoEspecialidadeSaude id={`esp-${p.id}`} rotulo={`Especialidades de ${primeiroNome(p.nome)}`} compacto multipla
        valor={editando.esp} outro={editando.outro} adicionais={editando.adicionais}
        onChange={(v, o, a) => setEditando((e) => ({ ...e, esp: v, outro: o, adicionais: a }))} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditando(null)} className="text-gray-400 hover:text-white hover:bg-white/10">Cancelar</Button>
        <Button size="sm" onClick={salvarEspecialidade} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" />Salvar</>}
        </Button>
      </div>
    </div>
  ) : null);

  return (
    <div className="space-y-4">
      {/* Grupo do WhatsApp da equipe */}
      <section className="rounded-xl border border-white/10 bg-black/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Grupo do WhatsApp da equipe de Saúde</p>
          {grupoLink
            ? <p className="text-xs text-gray-400 truncate">{grupoLink}</p>
            : <p className="text-xs text-amber-300/90">O líder da equipe ainda não cadastrou o link do grupo na relação dele.</p>}
        </div>
        {grupoLink && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={copiarGrupo} className="h-9 border-white/15 bg-white/5 text-gray-200 hover:bg-white/10">
              <Copy className="w-4 h-4 mr-1.5" />Copiar link
            </Button>
            <a href={grupoLink} target="_blank" rel="noreferrer"
              className="inline-flex items-center h-9 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Abrir grupo</a>
          </div>
        )}
      </section>

      {/* Cobertura por grupo: a demanda de saude de cada cor x quem da equipe foi alocado */}
      <section className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Cobertura por grupo</p>
          <p className="text-xs text-gray-500">Patologias dos acampantes de cada cor e a equipe alocada nela. Clique no cartão de uma cor para escolher quem da equipe vai nela.</p>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {cobertura.map((c) => (
            <div key={c.grupo} role="button" tabIndex={0}
              onClick={() => { setPainel(c.grupo); setBuscaPainel(''); setEspPainel('todas'); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPainel(c.grupo); setBuscaPainel(''); setEspPainel('todas'); } }}
              title={`Escolher a equipe do grupo ${c.grupo}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2 cursor-pointer transition-colors hover:bg-white/[0.07] hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400/50">
              <div className="flex items-center gap-2">
                <GrupoTrilhaTag grupo={c.grupo} />
                <span className="text-xs text-gray-400">{c.total} {c.total === 1 ? 'acampante' : 'acampantes'} com saúde</span>
                <span className="ml-auto text-[11px] text-emerald-300">Escolher equipe</span>
              </div>
              {c.total === 0 ? <p className="text-xs text-gray-600">Nenhuma informação de saúde.</p> : (
                <p className="text-xs text-gray-300 leading-relaxed">
                  {c.problemas.length > 0 && <>{c.problemas.map((g) => `${g.rotulo} (${g.ids.size})`).join(', ')}. </>}
                  <span className="text-gray-500">{c.comMedicamento} com medicamento · {c.comRestricao} com restrição alimentar</span>
                </p>
              )}
              <div className="border-t border-white/10 pt-2">
                {c.equipe.length === 0
                  ? <p className="text-xs text-amber-300/90">Ninguém da equipe alocado neste grupo.</p>
                  : <p className="text-xs text-gray-200"><span className="text-gray-500">Equipe: </span>
                    {c.equipe.map((p) => `${primeiroNome(p.nome)}${rotuloEspecialidades(p) ? ` (${rotuloEspecialidades(p)})` : ''}`).join(', ')}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Busca e filtros */}
      <section className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, igreja, especialidade, telefone..."
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[['todas', `Todos · ${equipe.length}`], ...contagem.map(([esp, n]) => [esp, `${esp} · ${n}`]),
            ...(semEspecialidade ? [['sem', `Sem especialidade · ${semEspecialidade}`]] : []),
            ...(semGrupo ? [['semgrupo', `Sem grupo · ${semGrupo}`]] : [])].map(([v, rot]) => (
            <button key={v} type="button" onClick={() => setFiltro(v)}
              className={cn('px-3 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors',
                filtro === v ? 'border-emerald-400 bg-emerald-500/20 text-white'
                  : (v === 'sem' || v === 'semgrupo') ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}>
              {rot}
            </button>
          ))}
        </div>
      </section>

      {/* Lista */}
      <section className="rounded-xl border border-white/10 bg-black/50">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <p className="text-sm text-gray-300"><strong className="text-white tabular-nums">{visiveis.length}</strong> {visiveis.length === 1 ? 'pessoa' : 'pessoas'}</p>
          {(busca || filtro !== 'todas') && (
            <button type="button" onClick={() => { setBusca(''); setFiltro('todas'); }} className="text-xs text-gray-400 hover:text-white underline underline-offset-2">limpar filtros</button>
          )}
          <Button size="sm" variant="ghost" onClick={carregar} disabled={carregando} className="ml-auto h-8 text-gray-400 hover:text-white hover:bg-white/10" aria-label="Recarregar">
            <RefreshCw className={cn('w-4 h-4', carregando && 'animate-spin')} />
          </Button>
        </div>

        {visiveis.length === 0 ? (
          <p className="py-12 text-center text-gray-500 text-sm">Ninguém com esses filtros.</p>
        ) : (
          <>
            {/* Computador */}
            <div className="hidden md:block overflow-auto max-h-[calc(100dvh-12rem)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-900">
                  <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                    <th className="px-3 py-2 min-w-[240px]"><Ordenar coluna="nome" ordem={ordem} setOrdem={setOrdem}>Nome</Ordenar></th>
                    <th className="px-3 py-2"><Ordenar coluna="idade" ordem={ordem} setOrdem={setOrdem}>Idade</Ordenar></th>
                    <th className="px-3 py-2"><Ordenar coluna="especialidade" ordem={ordem} setOrdem={setOrdem}>Especialidade</Ordenar></th>
                    <th className="px-3 py-2 uppercase tracking-wide">Grupo</th>
                    <th className="px-3 py-2 min-w-[160px]"><Ordenar coluna="igreja" ordem={ordem} setOrdem={setOrdem}>Igreja</Ordenar></th>
                    <th className="px-3 py-2 min-w-[170px] uppercase tracking-wide">Emergência</th>
                    <th className="px-3 py-2 uppercase tracking-wide">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((p) => {
                    const zapEm = linkWhatsApp(p.contato_emergencia_telefone);
                    return (
                      <tr key={p.escala_id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                        <td className="px-3 py-2.5">
                          {nome(p)}
                          <p className="text-xs text-gray-500">{p.whatsapp ? formatarTelefone(p.whatsapp) : 'Sem WhatsApp'}{p.eh_lider ? ' · Líder' : ''}</p>
                          {edicao(p)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-200 tabular-nums whitespace-nowrap">{p.idade != null ? `${p.idade} anos` : '—'}<p className="text-xs text-gray-500">{p.sexo || ''}</p></td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {p.especialidade === ESPECIALIDADE_OUTRO
                              ? <>
                                  <span className="text-gray-200">{p.especialidade_outro}</span>
                                  {(p.especialidades_adicionais || []).map((x) => <TagEspecialidade key={x} especialidade={x} />)}
                                </>
                              : <TagEspecialidade especialidade={p.especialidade} adicionais={p.especialidades_adicionais} semEspecialidade />}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">{seletorGrupo(p)}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-300 max-w-[220px] truncate" title={nomeDaIgreja(p)}>{nomeDaIgreja(p) || '—'}</td>
                        <td className="px-3 py-2.5 text-xs">
                          <p className="text-gray-200">{p.contato_emergencia_nome || '—'}</p>
                          {p.contato_emergencia_telefone && (zapEm
                            ? <a href={zapEm} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline inline-flex items-center gap-1"><Phone className="w-3 h-3" />{formatarTelefone(p.contato_emergencia_telefone)}</a>
                            : <span className="text-gray-400">{p.contato_emergencia_telefone}</span>)}
                        </td>
                        <td className="px-3 py-2.5">{acoes(p)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular */}
            <div className="md:hidden">
              <div className="flex gap-2 px-4 py-2 text-[11px] text-gray-500 border-b border-white/5 overflow-x-auto">
                Ordenar:
                {[['nome', 'Nome'], ['idade', 'Idade'], ['especialidade', 'Especialidade']].map(([c, r]) => (
                  <Ordenar key={c} coluna={c} ordem={ordem} setOrdem={setOrdem}>{r}</Ordenar>
                ))}
              </div>
              <div className="divide-y divide-white/5">
                {visiveis.map((p) => (
                  <div key={p.escala_id} className="p-4 space-y-2">
                    {nome(p)}
                    <p className="text-xs text-gray-500">
                      {p.idade != null ? `${p.idade} anos` : 'sem idade'}{p.sexo ? ` · ${p.sexo}` : ''}{p.eh_lider ? ' · Líder' : ''}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{nomeDaIgreja(p) || '—'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">Grupo: {seletorGrupo(p)}</div>
                    {p.contato_emergencia_nome && (
                      <p className="text-xs"><span className="text-gray-500">Emergência: </span><span className="text-gray-300">{p.contato_emergencia_nome}{p.contato_emergencia_telefone ? ` · ${formatarTelefone(p.contato_emergencia_telefone)}` : ''}</span></p>
                    )}
                    {acoes(p)}
                    {edicao(p)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Painel: marcar quem da equipe vai neste grupo (um grupo so por pessoa) */}
      <Dialog open={!!painel} onOpenChange={(v) => !v && setPainel(null)}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-2xl max-h-[90dvh] flex flex-col">
          {painel && (() => {
            const c = cobertura.find((x) => x.grupo === painel);
            const q = buscaPainel.trim();
            const lista = equipe
              .filter((p) => (espPainel === 'todas' || especialidades(p).includes(espPainel)))
              .filter((p) => !q || [p.nome, rotuloEspecialidades(p), nomeDaIgreja(p)].some((x) => contemTexto(x, q)))
              .sort((a, b) => (Number(b.grupo_saude === painel) - Number(a.grupo_saude === painel)) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">Equipe do grupo <GrupoTrilhaTag grupo={painel} /></DialogTitle>
                  <DialogDescription className="text-gray-300 text-xs leading-relaxed">
                    {c.total} {c.total === 1 ? 'acampante' : 'acampantes'} com saúde.{' '}
                    {c.problemas.length > 0 ? c.problemas.map((g) => `${g.rotulo} (${g.ids.size})`).join(', ') : 'Nenhuma patologia informada.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input value={buscaPainel} onChange={(e) => setBuscaPainel(e.target.value)} placeholder="Buscar nome ou especialidade..."
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
                  </div>
                  <select value={espPainel} onChange={(e) => setEspPainel(e.target.value)} aria-label="Filtrar por especialidade"
                    className="h-10 rounded-md border border-white/15 bg-neutral-900 px-2 text-sm text-gray-200">
                    <option value="todas">Todas as especialidades</option>
                    {contagem.map(([esp, n]) => <option key={esp} value={esp}>{esp} ({n})</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-400">
                  <strong className="text-white tabular-nums">{c.equipe.length}</strong> {c.equipe.length === 1 ? 'pessoa' : 'pessoas'} neste grupo. Quem está em outra cor muda para esta ao marcar.
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                  {lista.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Ninguém com esse filtro.</p>}
                  {lista.map((p) => {
                    const aqui = p.grupo_saude === painel;
                    return (
                      <label key={p.escala_id}
                        className={cn('flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/5', aqui && 'bg-emerald-500/10', gravandoGrupo === p.escala_id && 'opacity-60')}>
                        <Checkbox checked={aqui} disabled={gravandoGrupo === p.escala_id}
                          onCheckedChange={(v) => trocarGrupo(p, v === true ? painel : null)} aria-label={`Colocar ${p.nome} no grupo ${painel}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            {p.eh_lider && <Star className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-label="Líder" />}
                            <span>{p.nome}</span>
                            <TagEspecialidade especialidade={p.especialidade} outro={p.especialidade_outro} adicionais={p.especialidades_adicionais} semEspecialidade />
                          </p>
                          <p className="text-xs text-gray-500">{p.idade != null ? `${p.idade} anos` : 'sem idade'}{p.sexo ? ` · ${p.sexo}` : ''}</p>
                        </div>
                        {p.grupo_saude && !aqui && <GrupoTrilhaTag grupo={p.grupo_saude} className="text-[10px] px-2" />}
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setPainel(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white">Pronto</Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quadro do "Outro" (organizador) */}
      {ehOrganizador && (
        <section className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Especialidades escritas em “Outro”</p>
            <p className="text-xs text-gray-500">De todos os equipantes. “Tornar fixa” põe a resposta na lista de opções e passa quem a escreveu para ela.</p>
          </div>
          {outros.length === 0 ? (
            <p className="text-xs text-gray-600">Ninguém escreveu nada em “Outro” ainda.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {outros.map((o) => (
                <div key={o.texto} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{o.texto} <span className="text-xs text-gray-500">· {o.quantos} {o.quantos === 1 ? 'pessoa' : 'pessoas'}</span></p>
                    <p className="text-xs text-gray-500 truncate" title={(o.nomes || []).join(', ')}>{(o.nomes || []).join(', ')}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={!!fixando} onClick={() => fixar(o.texto)}
                    className="h-8 shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                    {fixando === o.texto ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tornar fixa'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Lista de especialidades (Vera e organizador) */}
      <EspecialidadesLista key={listaVersao} onMudou={carregar} />
    </div>
  );
};

export default EquipeSaude;
