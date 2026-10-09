import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Baby, Download, HeartPulse, Loader2, LogOut, Pill, RefreshCw, Search, Users, UtensilsCrossed, X, Phone, ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import Layout from '@/components/Layout';
import ExportarSaudeDialog from '@/components/saude/ExportarSaudeDialog';
import { fetchSaudeAcampantes } from '@/services/saudeService';
import { linkWhatsApp } from '@/services/liderService';
import { formatarTelefone } from '@/utils/telefone';
import { GROUPS } from '@/utils/gruposTrailha';
import { agruparTermos, contemTexto, termosDaPessoa } from '@/utils/saude';

/**
 * Tela da lider da saude (login "Apoio", Patrick, 09/10/2026).
 *
 * Uma tela so: quantos acampantes, quem tem problema de saude, quem usa
 * medicamento, restricao alimentar e gestantes. Filtra, junta quem tem o
 * mesmo problema/remedio (botoes de "Agrupar") e exporta para Excel.
 *
 * Os dados vem de saude_acampantes() -- a conta de apoio nao le nenhuma
 * tabela direto. Organizador tambem abre esta tela, pelo botao "Saude dos
 * acampantes" de Configuracoes -- dentro do painel, com a barra de cima.
 */

const MOSTRAR = [
  { valor: 'saude', rotulo: 'Com alguma informação de saúde' },
  { valor: 'problema', rotulo: 'Problema de saúde' },
  { valor: 'medicamento', rotulo: 'Usam medicamento' },
  { valor: 'alimento', rotulo: 'Restrição alimentar' },
  { valor: 'gestante', rotulo: 'Gestantes' },
  { valor: 'todos', rotulo: 'Todos os acampantes' },
];

const PAINEIS = [
  { tipo: 'problema', titulo: 'Problemas de saúde', icone: Activity, cor: 'text-rose-300', chip: 'border-rose-500/40 bg-rose-500/10 text-rose-200', ativo: 'border-rose-400 bg-rose-500/30 text-white' },
  { tipo: 'medicamento', titulo: 'Medicamentos', icone: Pill, cor: 'text-sky-300', chip: 'border-sky-500/40 bg-sky-500/10 text-sky-200', ativo: 'border-sky-400 bg-sky-500/30 text-white' },
  { tipo: 'alimento', titulo: 'Restrições alimentares', icone: UtensilsCrossed, cor: 'text-amber-300', chip: 'border-amber-500/40 bg-amber-500/10 text-amber-200', ativo: 'border-amber-400 bg-amber-500/30 text-white' },
];

const Chip = ({ ativo, onClick, children, dica }) => (
  <button
    type="button"
    onClick={onClick}
    data-dica={dica}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
      ativo ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

// divisao: { confirmados, inscritos } -- quem ja pagou e quem so se inscreveu
// (Patrick, 09/10/2026: "divida quem foi inscrito e quem esta confirmado").
const Cartao = ({ icone: Icone, rotulo, valor, detalhe, divisao, cor, ativo, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left rounded-xl border p-4 transition-colors ${
      ativo ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-white/10 bg-black/50 hover:bg-white/5'
    }`}
  >
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <Icone className={`w-4 h-4 ${cor}`} />
      {rotulo}
    </div>
    <p className="text-3xl font-bold text-white mt-1 tabular-nums">{valor}</p>
    {divisao && (
      <p className="text-xs mt-1 leading-relaxed">
        <span className="text-emerald-300 font-medium tabular-nums">{divisao.confirmados}</span>
        <span className="text-gray-500"> confirmados · </span>
        <span className="text-amber-300 font-medium tabular-nums">{divisao.inscritos}</span>
        <span className="text-gray-500"> só inscritos</span>
      </p>
    )}
    {detalhe && <p className="text-xs text-gray-500 mt-0.5">{detalhe}</p>}
  </button>
);

const Texto = ({ valor, marcado }) =>
  valor ? <span className="text-gray-200 whitespace-pre-wrap break-words">{valor}</span>
    : marcado ? <span className="text-amber-300/80 italic">marcou “sim”, sem descrever</span>
      : <span className="text-gray-600">—</span>;

const SaudePage = () => {
  const { apoioUser, organizadorUser, user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [mostrar, setMostrar] = useState('saude');
  const [busca, setBusca] = useState('');
  const [inscricao, setInscricao] = useState('todas');
  const [sexo, setSexo] = useState('todos');
  const [grupo, setGrupo] = useState('todos');
  const [idade, setIdade] = useState('todas');
  const [termos, setTermos] = useState([]); // [{ tipo, chave, rotulo }]
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [exportando, setExportando] = useState(false);

  const nomeDaConta = apoioUser?.nome || organizadorUser?.nome || user?.nome || '';
  const ehOrganizador = !apoioUser && (!!organizadorUser || ['organizador', 'organizador-aprovador'].includes(user?.role));

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await fetchSaudeAcampantes();
      // Os termos de cada pessoa sao calculados uma vez so.
      setLista(dados.map((p) => ({
        ...p,
        _termos: {
          problema: termosDaPessoa(p, 'problema'),
          medicamento: termosDaPessoa(p, 'medicamento'),
          alimento: termosDaPessoa(p, 'alimento'),
        },
      })));
    } catch (e) {
      console.error('SaudePage - carregar', e?.message || e);
      setErro(e?.message || 'Não foi possível carregar os dados.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const sair = () => {
    logout();
    navigate('/login');
  };

  const tem = {
    problema: (p) => p.tem_problema_saude || p._termos.problema.length > 0,
    medicamento: (p) => p.usa_medicamento || p._termos.medicamento.length > 0,
    alimento: (p) => p.tem_restricao_alimentar || p._termos.alimento.length > 0,
    gestante: (p) => p.esta_gravida,
  };
  tem.saude = (p) => tem.problema(p) || tem.medicamento(p) || tem.alimento(p) || tem.gestante(p);
  tem.todos = () => true;

  // Filtros "de fora" (inscricao, sexo, grupo, idade): valem para os cartoes,
  // para os botoes de agrupar e para a tabela.
  const base = useMemo(() => lista.filter((p) => {
    if (inscricao === 'pagas' && !p.pago) return false;
    if (inscricao === 'pendentes' && p.pago) return false;
    if (sexo !== 'todos' && p.sexo !== sexo) return false;
    if (grupo !== 'todos' && (grupo === 'sem' ? !!p.grupo_trailha : p.grupo_trailha !== grupo)) return false;
    if (idade === 'menores' && !(p.idade != null && p.idade < 18)) return false;
    if (idade === '60' && !(p.idade != null && p.idade >= 60)) return false;
    return true;
  }), [lista, inscricao, sexo, grupo, idade]);

  // Cada numero vem com a divisao confirmados (pagos) x so inscritos.
  const contagem = useMemo(() => Object.fromEntries(
    ['todos', 'saude', 'problema', 'medicamento', 'alimento', 'gestante'].map((k) => {
      const lista = base.filter(tem[k]);
      const confirmados = lista.filter((p) => p.pago).length;
      return [k, { total: lista.length, confirmados, inscritos: lista.length - confirmados }];
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [base]);

  const grupos = useMemo(() => ({
    problema: agruparTermos(base, 'problema'),
    medicamento: agruparTermos(base, 'medicamento'),
    alimento: agruparTermos(base, 'alimento'),
  }), [base]);

  const visiveis = useMemo(() => base.filter((p) => {
    if (!tem[mostrar](p)) return false;
    if (termos.length > 0) {
      const bate = termos.some((t) => p._termos[t.tipo].some((x) => x.chave === t.chave));
      if (!bate) return false;
    }
    const q = busca.trim();
    if (q) {
      const campos = [p.nome, p.igreja, p.condicoes_medicas, p.medicamentos, p.restricoes_alimentares,
        p.contato_emergencia_nome, p.grupo_trailha];
      if (!campos.some((c) => contemTexto(c, q))) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [base, mostrar, termos, busca]);

  const alternarTermo = (tipo, g) => {
    setTermos((atual) => (atual.some((t) => t.tipo === tipo && t.chave === g.chave)
      ? atual.filter((t) => !(t.tipo === tipo && t.chave === g.chave))
      : [...atual, { tipo, chave: g.chave, rotulo: g.rotulo }]));
    // Quem clica num remedio quer ver quem toma -- mesmo se o filtro de cima
    // estiver em outra coisa.
    if (mostrar !== 'todos' && mostrar !== 'saude' && mostrar !== tipo) setMostrar('saude');
  };

  const limparFiltros = () => {
    setMostrar('saude'); setBusca(''); setInscricao('todas'); setSexo('todos');
    setGrupo('todos'); setIdade('todas'); setTermos([]);
  };

  const filtrosAtivos = busca || inscricao !== 'todas' || sexo !== 'todos' || grupo !== 'todos'
    || idade !== 'todas' || termos.length > 0 || mostrar !== 'saude';

  // Lista em dois blocos: confirmados (pagos) primeiro, depois quem so se
  // inscreveu. Com o filtro de situacao ligado, um bloco so.
  const secoes = [
    { chave: 'confirmados', titulo: 'Confirmados (pagos)', cor: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/5', pessoas: visiveis.filter((p) => p.pago) },
    { chave: 'inscritos', titulo: 'Só inscritos · aguardando pagamento', cor: 'text-amber-300 border-amber-500/30 bg-amber-500/5', pessoas: visiveis.filter((p) => !p.pago) },
  ].filter((sec) => sec.pessoas.length > 0);

  const idsVisiveis = visiveis.map((p) => p.id);
  const todosMarcados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));
  const marcarTodos = (v) => setSelecionados((atual) => {
    const novo = new Set(atual);
    idsVisiveis.forEach((id) => (v ? novo.add(id) : novo.delete(id)));
    return novo;
  });
  const marcar = (id, v) => setSelecionados((atual) => {
    const novo = new Set(atual);
    if (v) novo.add(id); else novo.delete(id);
    return novo;
  });
  const listaSelecionados = lista.filter((p) => selecionados.has(p.id));

  const conteudo = (
    <>
      {carregando && lista.length === 0 ? (
        <div className="py-24 text-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          Carregando os dados de saúde...
        </div>
      ) : erro ? (
        <div className="py-16 text-center">
          <p className="text-red-300 mb-4">{erro}</p>
          <Button onClick={carregar} className="bg-white/10 hover:bg-white/20 text-white">
            <RefreshCw className="w-4 h-4 mr-1.5" />Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          {/* ------------------------ Numeros ------------------------ */}
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Cartao icone={Users} cor="text-gray-300" rotulo="Acampantes" valor={contagem.todos.total}
              divisao={contagem.todos} ativo={mostrar === 'todos'} onClick={() => setMostrar('todos')} />
            <Cartao icone={HeartPulse} cor="text-emerald-300" rotulo="Com informação de saúde" valor={contagem.saude.total}
              divisao={contagem.saude} ativo={mostrar === 'saude'} onClick={() => setMostrar('saude')} />
            <Cartao icone={Activity} cor="text-rose-300" rotulo="Problema de saúde" valor={contagem.problema.total}
              divisao={contagem.problema} ativo={mostrar === 'problema'} onClick={() => setMostrar('problema')} />
            <Cartao icone={Pill} cor="text-sky-300" rotulo="Usam medicamento" valor={contagem.medicamento.total}
              divisao={contagem.medicamento} ativo={mostrar === 'medicamento'} onClick={() => setMostrar('medicamento')} />
            <Cartao icone={UtensilsCrossed} cor="text-amber-300" rotulo="Restrição alimentar" valor={contagem.alimento.total}
              divisao={contagem.alimento} ativo={mostrar === 'alimento'} onClick={() => setMostrar('alimento')} />
            <Cartao icone={Baby} cor="text-pink-300" rotulo="Gestantes" valor={contagem.gestante.total}
              divisao={contagem.gestante} ativo={mostrar === 'gestante'} onClick={() => setMostrar('gestante')} />
          </section>

          {/* ------------------------ Filtros ------------------------ */}
          <section className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome, igreja, doença, remédio, alimento..."
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MOSTRAR.map((m) => (
                  <Chip key={m.valor} ativo={mostrar === m.valor} onClick={() => setMostrar(m.valor)}>
                    {m.rotulo}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-gray-500 mr-1">Situação:</span>
                <Chip ativo={inscricao === 'todas'} onClick={() => setInscricao('todas')}>Todas</Chip>
                <Chip ativo={inscricao === 'pagas'} onClick={() => setInscricao('pagas')}>Confirmados (pagos)</Chip>
                <Chip ativo={inscricao === 'pendentes'} onClick={() => setInscricao('pendentes')}>Só inscritos (aguardando pagamento)</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-gray-500 mr-1">Sexo:</span>
                <Chip ativo={sexo === 'todos'} onClick={() => setSexo('todos')}>Todos</Chip>
                <Chip ativo={sexo === 'Masculino'} onClick={() => setSexo('Masculino')}>Masculino</Chip>
                <Chip ativo={sexo === 'Feminino'} onClick={() => setSexo('Feminino')}>Feminino</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-gray-500 mr-1">Idade:</span>
                <Chip ativo={idade === 'todas'} onClick={() => setIdade('todas')}>Todas</Chip>
                <Chip ativo={idade === 'menores'} onClick={() => setIdade('menores')}>Menores de 18</Chip>
                <Chip ativo={idade === '60'} onClick={() => setIdade('60')}>60 anos ou mais</Chip>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-gray-500 mr-1">Grupo de trilha:</span>
                <Chip ativo={grupo === 'todos'} onClick={() => setGrupo('todos')}>Todos</Chip>
                {GROUPS.map((g) => (
                  <button key={g} type="button" onClick={() => setGrupo(grupo === g ? 'todos' : g)}
                    className={`rounded-full transition-opacity ${grupo === g ? 'ring-2 ring-white/70' : grupo === 'todos' ? '' : 'opacity-50 hover:opacity-100'}`}>
                    <GrupoTrilhaTag grupo={g} />
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ------------------- Agrupar (mesmo problema / remedio) ------------------- */}
          <section className="grid gap-3 lg:grid-cols-3">
            {PAINEIS.map(({ tipo, titulo, icone: Icone, cor, chip, ativo }) => (
              <div key={tipo} className="rounded-xl border border-white/10 bg-black/50 p-4">
                <p className="text-sm font-semibold flex items-center gap-2 mb-1">
                  <Icone className={`w-4 h-4 ${cor}`} />{titulo}
                </p>
                <p className="text-xs text-gray-500 mb-3">Clique para ver quem tem o mesmo.</p>
                {grupos[tipo].length === 0 ? (
                  <p className="text-xs text-gray-600">Ninguém informou.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {grupos[tipo].map((g) => {
                      const marcado = termos.some((t) => t.tipo === tipo && t.chave === g.chave);
                      return (
                        <button
                          key={g.chave} type="button" onClick={() => alternarTermo(tipo, g)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${marcado ? ativo : `${chip} hover:brightness-125`}`}
                        >
                          {g.rotulo}
                          <span className="rounded-full bg-black/40 px-1.5 text-[10px] font-bold tabular-nums">{g.ids.size}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* ------------------------ Tabela ------------------------ */}
          <section className="rounded-xl border border-white/10 bg-black/50">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/10">
              <p className="text-sm text-gray-300">
                <strong className="text-white tabular-nums">{visiveis.length}</strong>{' '}
                {visiveis.length === 1 ? 'acampante' : 'acampantes'}
                {selecionados.size > 0 && <> · <strong className="text-emerald-300">{selecionados.size}</strong> marcados</>}
              </p>
              {termos.map((t) => (
                <span key={`${t.tipo}:${t.chave}`} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-200">
                  {t.rotulo}
                  <button type="button" onClick={() => setTermos((a) => a.filter((x) => x !== t))} aria-label={`Tirar ${t.rotulo}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {filtrosAtivos && (
                <button type="button" onClick={limparFiltros} className="text-xs text-gray-400 hover:text-white underline underline-offset-2">
                  limpar filtros
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                {selecionados.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}
                    className="h-8 text-gray-400 hover:text-white hover:bg-white/10">
                    Desmarcar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={carregar} disabled={carregando}
                  data-dica="Buscar os dados de novo."
                  className="h-8 text-gray-400 hover:text-white hover:bg-white/10">
                  <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="sm" onClick={() => setExportando(true)} disabled={visiveis.length === 0 && selecionados.size === 0}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Download className="w-4 h-4 mr-1.5" />Exportar Excel
                </Button>
              </div>
            </div>

            {visiveis.length === 0 ? (
              <p className="py-12 text-center text-gray-500 text-sm">Ninguém com esses filtros.</p>
            ) : (
              <>
                {/* Computador */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-white/10">
                        <th className="px-3 py-2 w-8">
                          <Checkbox checked={todosMarcados} onCheckedChange={(v) => marcarTodos(v === true)} aria-label="Marcar todos" />
                        </th>
                        <th className="px-3 py-2 min-w-[190px]">Acampante</th>
                        <th className="px-3 py-2">Grupo</th>
                        <th className="px-3 py-2 min-w-[180px]">Problema de saúde</th>
                        <th className="px-3 py-2 min-w-[180px]">Medicamentos</th>
                        <th className="px-3 py-2 min-w-[140px]">Restrição alimentar</th>
                        <th className="px-3 py-2 min-w-[170px]">Contato de emergência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secoes.map((sec) => (
                        <React.Fragment key={sec.chave}>
                          <tr>
                            <td colSpan={7} className={`px-3 py-2 border-y text-xs font-semibold uppercase tracking-wide ${sec.cor}`}>
                              {sec.titulo} · {sec.pessoas.length}
                            </td>
                          </tr>
                          {sec.pessoas.map((p) => {
                        const zap = linkWhatsApp(p.contato_emergencia_telefone);
                        return (
                          <tr key={p.id} className={`border-b border-white/5 align-top ${selecionados.has(p.id) ? 'bg-emerald-500/5' : 'hover:bg-white/[0.03]'}`}>
                            <td className="px-3 py-2.5">
                              <Checkbox checked={selecionados.has(p.id)} onCheckedChange={(v) => marcar(p.id, v === true)} aria-label={`Marcar ${p.nome}`} />
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-white">{p.nome}</p>
                              <p className="text-xs text-gray-500">
                                {p.idade != null ? `${p.idade} anos` : 'idade —'}
                                {p.sexo ? ` · ${p.sexo}` : ''}
                                {p.esta_gravida && <span className="ml-1 text-pink-300">· gestante</span>}
                              </p>
                              <p className="text-xs text-gray-500 truncate max-w-[240px]" title={p.igreja || ''}>{p.igreja || '—'}</p>
                            </td>
                            <td className="px-3 py-2.5"><GrupoTrilhaTag grupo={p.grupo_trailha} /></td>
                            <td className="px-3 py-2.5"><Texto valor={p.condicoes_medicas} marcado={p.tem_problema_saude} /></td>
                            <td className="px-3 py-2.5"><Texto valor={p.medicamentos} marcado={p.usa_medicamento} /></td>
                            <td className="px-3 py-2.5"><Texto valor={p.restricoes_alimentares} marcado={p.tem_restricao_alimentar} /></td>
                            <td className="px-3 py-2.5">
                              <p className="text-gray-200">{p.contato_emergencia_nome || '—'}</p>
                              {p.contato_emergencia_telefone && (
                                zap ? (
                                  <a href={zap} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 hover:underline inline-flex items-center gap-1">
                                    <Phone className="w-3 h-3" />{formatarTelefone(p.contato_emergencia_telefone)}
                                  </a>
                                ) : <p className="text-xs text-gray-400">{p.contato_emergencia_telefone}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Celular */}
                <div className="md:hidden">
                  {secoes.map((sec) => (
                    <div key={sec.chave} className="divide-y divide-white/5">
                      <p className={`px-4 py-2 border-y text-xs font-semibold uppercase tracking-wide ${sec.cor}`}>
                        {sec.titulo} · {sec.pessoas.length}
                      </p>
                  {sec.pessoas.map((p) => {
                    const zap = linkWhatsApp(p.contato_emergencia_telefone);
                    return (
                      <div key={p.id} className={`p-4 space-y-2 ${selecionados.has(p.id) ? 'bg-emerald-500/5' : ''}`}>
                        <div className="flex items-start gap-3">
                          <Checkbox className="mt-1" checked={selecionados.has(p.id)} onCheckedChange={(v) => marcar(p.id, v === true)} aria-label={`Marcar ${p.nome}`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{p.nome}</p>
                            <p className="text-xs text-gray-500">
                              {p.idade != null ? `${p.idade} anos` : 'idade —'}{p.sexo ? ` · ${p.sexo}` : ''}
                              {p.esta_gravida && <span className="text-pink-300"> · gestante</span>}
                            </p>
                          </div>
                          <GrupoTrilhaTag grupo={p.grupo_trailha} />
                        </div>
                        {[
                          ['Problema de saúde', p.condicoes_medicas, p.tem_problema_saude],
                          ['Medicamentos', p.medicamentos, p.usa_medicamento],
                          ['Restrição alimentar', p.restricoes_alimentares, p.tem_restricao_alimentar],
                        ].filter(([, v, m]) => v || m).map(([rotulo, v, m]) => (
                          <p key={rotulo} className="text-sm"><span className="text-gray-500">{rotulo}: </span><Texto valor={v} marcado={m} /></p>
                        ))}
                        <p className="text-sm">
                          <span className="text-gray-500">Emergência: </span>
                          <span className="text-gray-200">{p.contato_emergencia_nome || '—'}</span>
                          {zap && (
                            <a href={zap} target="_blank" rel="noreferrer" className="ml-1 text-emerald-300">
                              {formatarTelefone(p.contato_emergencia_telefone)}
                            </a>
                          )}
                        </p>
                      </div>
                    );
                  })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </>
  );

  return (
    <>
      <Helmet>
        <title>Saúde - Metanoia Radical</title>
      </Helmet>

      {ehOrganizador ? (
        // Organizador (pelo menu): dentro do painel, com a barra de cima.
        <Layout largo>
          <div className="space-y-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <HeartPulse className="w-6 h-6 text-rose-400" /> Saúde dos acampantes
              </h1>
              <p className="text-sm text-gray-400">A mesma tela que a equipe de saúde vê no login Apoio.</p>
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
          <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center gap-3">
            <img
              src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/ea6fe427e17542cbf0e791fb09fba6dc.png"
              alt="Metanoia Radical" className="hidden sm:block h-9 w-auto object-contain"
            />
            <div className="min-w-0">
              <p className="font-bold leading-tight flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-400" /> Saúde dos acampantes
              </p>
              <p className="text-xs text-gray-500 truncate">Metanoia Radical Serra · {nomeDaConta || 'Apoio'}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={sair} className="text-gray-300 hover:text-white hover:bg-white/10">
                <LogOut className="w-4 h-4 mr-1.5" />Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-[1500px] mx-auto px-4 py-6 space-y-5">
          {conteudo}
        </main>
      </div>
      )}

      <ExportarSaudeDialog
        aberto={exportando}
        onFechar={() => setExportando(false)}
        visiveis={visiveis}
        selecionados={listaSelecionados}
        onExportado={(n) => toast({ title: 'Planilha baixada', description: `${n} ${n === 1 ? 'acampante' : 'acampantes'}.`, className: 'bg-emerald-600 text-white' })}
      />
    </>
  );
};

export default SaudePage;
