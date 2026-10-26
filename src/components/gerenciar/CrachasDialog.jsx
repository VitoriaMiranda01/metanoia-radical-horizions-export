import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Contact2, FileDown, Loader2, Pencil, Search, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { GROUPS } from '@/utils/gruposTrailha';
import { limparNomePessoa, problemaNomePessoa } from '@/utils/nomePessoa';
import {
  AREAS_COM_CRACHA, camisaNormalizada, dadosDoCracha, ehEquipeDaTrilha, gerarPdfCrachas, NUMERO_DA_CAMISA,
  NUMERO_INFILTRADO, ordenarCrachas, POR_FOLHA, situacaoDoCracha, svgPreviaCracha, TAMANHOS_CAMISA
} from '@/utils/crachas';
import { desmarcarCrachaImpresso, fetchCrachas, marcarCrachasImpressos } from '@/services/crachasService';
import { updateAcampante } from '@/services/acampantesService';
import { updateEquipante } from '@/services/equipantesService';
import { definirCor } from '@/services/scalesService';
import { dataHora, semAcento } from '@/utils/recepcao';

/**
 * Crachas (Patrick, 26/10/2026, migrations 20261026c e 20261026d). So
 * organizador. Quem ganha cracha: os acampantes da lista da recepcao e dos
 * onibus (pago, isento ou com pagamento agendado) e toda a equipe da trilha
 * escalada em Infiltrados, Espirito Santo e Inimigo -- basta estar alocado,
 * mesmo antes da escala oficial. O cracha puxa nome, cor e camisa da ficha;
 * corrigir aqui muda a ficha (vale para o sistema todo) -- a cor do acampante
 * pela mesma troca de grupo dos Grupos de Trilha (com o aviso dos vinculos), a
 * da equipe pela cor na escala. A equipe da trilha sai sempre com o numero 8
 * (a camisa ja foi entregue e nao muda aqui).
 *
 * Gerar PDF: folha A4 com 8 crachas, no tamanho do modelo (utils/crachas.js),
 * para imprimir ou mandar para quem vai imprimir. Depois a tela pergunta se ja
 * pode marcar como impresso (guarda o que saiu); se nome/cor/numero mudar
 * depois, o cracha aparece como "Mudou -- reimprimir".
 */

const SITUACOES = {
  todos: { rotulo: 'Todos' },
  nao_impresso: { rotulo: 'Não impressos', classe: 'text-sky-300' },
  alterado: { rotulo: 'Mudaram — reimprimir', classe: 'text-amber-300' },
  impresso: { rotulo: 'Impressos', classe: 'text-emerald-300' },
  pendente: { rotulo: 'Pendentes', classe: 'text-red-300' },
};

const chaveDe = (p) => `${p.tipo}:${p.id}`;

// Etiqueta da equipe da trilha (so nesta tela; o cracha nao mostra).
const ETIQUETA_AREA = {
  Infiltrados: { rotulo: 'infiltrado', classe: 'border-fuchsia-500/50 text-fuchsia-300 bg-fuchsia-500/10' },
  'Espírito Santo': { rotulo: 'Espírito Santo', classe: 'border-sky-400/50 text-sky-200 bg-sky-400/10' },
  Inimigo: { rotulo: 'inimigo', classe: 'border-orange-500/50 text-orange-300 bg-orange-500/10' },
};
const areaDe = (p) => (p.infiltrado ? 'Infiltrados' : p.area || null);
const EtiquetaArea = ({ p }) => {
  const e = ETIQUETA_AREA[areaDe(p)];
  return e ? <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${e.classe}`}>{e.rotulo}</span> : null;
};

const SeloSituacao = ({ p }) => {
  const s = situacaoDoCracha(p);
  if (s === 'pendente') {
    const c = dadosDoCracha(p);
    const falta = [!c.grupo && 'cor', !c.numero && 'camisa'].filter(Boolean).join(' e ');
    return <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-500/40 text-red-300 whitespace-nowrap">Sem {falta}</span>;
  }
  if (s === 'nao_impresso') return <span className="text-[11px] px-2 py-0.5 rounded-full border border-sky-500/40 text-sky-300 whitespace-nowrap">Não impresso</span>;
  if (s === 'alterado') return <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/50 text-amber-300 whitespace-nowrap">Mudou — reimprimir</span>;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-300 whitespace-nowrap"
      title={`Impresso por ${p.impresso.por || 'organizador'} em ${dataHora(p.impresso.em)}${p.impresso.vezes > 1 ? ` (${p.impresso.vezes} vezes)` : ''}`}>
      Impresso {dataHora(p.impresso.em)}
    </span>
  );
};

// ---- Editar um cracha (muda a ficha) ------------------------------------------
const EditarCracha = ({ pessoa, vinc, onRealocar, onFechar, onSalvo, onGerarPdf }) => {
  const equipe = ehEquipeDaTrilha(pessoa);
  const { toast } = useToast();
  const [nome, setNome] = useState(pessoa.nome || '');
  const [grupo, setGrupo] = useState(pessoa.grupo || '');
  const [camisa, setCamisa] = useState(camisaNormalizada(pessoa.camisa) || '');
  const [salvando, setSalvando] = useState(false);

  const previa = dadosDoCracha({ ...pessoa, nome, grupo, camisa });
  const avisos = grupo && grupo !== pessoa.grupo && vinc?.carregado ? vinc.avisoParaGrupo(pessoa.id, grupo) : [];
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
  const mudouNome = nomeLimpo !== String(pessoa.nome || '').trim().replace(/\s+/g, ' ');
  const mudouGrupo = !!grupo && grupo !== (pessoa.grupo || '');
  const mudouCamisa = !equipe && !!camisa && camisa !== (camisaNormalizada(pessoa.camisa) || '');
  const mudou = mudouNome || mudouGrupo || mudouCamisa;

  const salvar = async (pdfDepois) => {
    if (mudouNome) {
      const problema = problemaNomePessoa(nomeLimpo);
      if (problema || !nomeLimpo) {
        toast({ title: 'Confira o nome', description: problema || 'Escreva o nome completo.', variant: 'destructive' });
        return;
      }
    }
    setSalvando(true);
    try {
      const dados = {};
      if (mudouNome) dados.nome = nomeLimpo;
      if (mudouCamisa) dados.tamanho_camisa = camisa;
      if (Object.keys(dados).length) {
        const r = pessoa.tipo === 'equipante' ? await updateEquipante(pessoa.id, dados) : await updateAcampante(pessoa.id, dados);
        if (!r.success) throw new Error(r.error);
      }
      if (mudouGrupo) {
        if (pessoa.tipo === 'equipante') {
          // Equipe da trilha: a cor e a da escala (a Geracao de Escalas mostra a mesma).
          if (!pessoa.escala_id) throw new Error('Não achei a alocação na escala. Feche e abra de novo.');
          const r = await definirCor(pessoa.escala_id, grupo);
          if (!r?.ok) throw new Error(r?.erro || 'Não foi possível trocar a cor.');
        } else {
          // Acampante: a mesma troca dos Grupos de Trilha.
          const r = await onRealocar({ id: pessoa.id, nome: mudouNome ? nomeLimpo : pessoa.nome, infiltrado: false }, grupo);
          if (!r?.success) throw new Error(r?.error || 'Não foi possível trocar a cor.');
        }
      }
      if (mudou) toast({ title: 'Crachá atualizado', description: 'A mudança vale para todo o sistema.', className: 'bg-emerald-600 text-white' });
      await onSalvo();
      if (pdfDepois) onGerarPdf({ ...pessoa, nome: mudouNome ? nomeLimpo : pessoa.nome, grupo: grupo || pessoa.grupo, camisa: mudouCamisa ? camisa : pessoa.camisa });
      onFechar();
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const podeGerar = !!(previa.nome && previa.grupo && previa.numero);

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !salvando) onFechar(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4" />Editar crachá</DialogTitle>
          <DialogDescription className="text-gray-400">
            O que mudar aqui muda a ficha {pessoa.tipo === 'equipante' ? 'do equipante (e a cor na escala)' : 'do acampante'} e vale
            para todo o sistema (grupos, ônibus, recepção, listas).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md overflow-hidden border border-white/10 bg-white"
          dangerouslySetInnerHTML={{ __html: svgPreviaCracha({ nome: previa.nome || '—', grupo: previa.grupo || '', numero: previa.numero || '' }) }} />

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm text-gray-300">Nome completo</span>
            <Input value={nome} onChange={(e) => setNome(limparNomePessoa(e.target.value))}
              className="bg-white/5 border-white/10 text-white" placeholder="Só letras" />
          </label>

          <div className="space-y-1">
            <span className="text-sm text-gray-300">Cor do grupo</span>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <button key={g} type="button" onClick={() => setGrupo(g)} aria-pressed={grupo === g} aria-label={g}
                  className={`rounded-full ${grupo === g ? 'ring-2 ring-white' : 'opacity-70 hover:opacity-100'}`}>
                  <GrupoTrilhaTag grupo={g} />
                </button>
              ))}
            </div>
            {avisos.length > 0 && (
              <p className="flex gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Não deveria ficar no grupo {grupo}: {avisos.map((a) => `${a.nome} (${a.rotulo.toLowerCase()})`).join(', ')} {avisos.length > 1 ? 'estão' : 'está'} nele. Dá para salvar assim mesmo.
              </p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-sm text-gray-300">Tamanho da camisa {equipe ? '' : '(define o número do crachá)'}</span>
            {equipe ? (
              <p className="text-sm text-gray-400 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                {ETIQUETA_AREA[areaDe(pessoa)]?.rotulo.replace(/^./, (l) => l.toUpperCase())}: o crachá sai sempre com o número {NUMERO_INFILTRADO}. A camisa já foi entregue e não muda aqui.
              </p>
            ) : (
              <select value={camisa} onChange={(e) => setCamisa(e.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white">
                {!camisa && <option value="">Escolher...</option>}
                {TAMANHOS_CAMISA.map((t) => <option key={t} value={t}>{t} — número {NUMERO_DA_CAMISA[t]}</option>)}
              </select>
            )}
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline" disabled={salvando} onClick={onFechar}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
          <Button variant="outline" disabled={salvando || !podeGerar} onClick={() => salvar(true)}
            className="border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white">
            <FileDown className="w-4 h-4 mr-2" />{mudou ? 'Salvar e gerar PDF' : 'Gerar PDF deste crachá'}
          </Button>
          <Button disabled={salvando || !mudou} onClick={() => salvar(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---- Janela principal -----------------------------------------------------------
const CrachasDialog = ({ isOpen, onClose, vinc, onRealocar, onAlterado }) => {
  const { toast } = useToast();
  const [pessoas, setPessoas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [grupoFiltro, setGrupoFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [editando, setEditando] = useState(null);
  // Crachas esperando o "marcar como impressos": { itens, pdf } -- pdf = veio
  // de um PDF que acabou de ser gerado (senao, marcar a mao os selecionados).
  const [aConfirmar, setAConfirmar] = useState(null);
  // false ou { feitos, total } enquanto o PDF e montado.
  const [gerando, setGerando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      setPessoas(ordenarCrachas(await fetchCrachas()));
    } catch (e) {
      toast({ title: 'Não foi possível carregar os crachás', description: e.message, variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isOpen) { setSelecionados(new Set()); setAConfirmar(null); setFiltro('todos'); carregar(); }
  }, [isOpen]);

  const contagem = useMemo(() => {
    const c = { todos: pessoas.length, nao_impresso: 0, alterado: 0, impresso: 0, pendente: 0 };
    pessoas.forEach((p) => { c[situacaoDoCracha(p)] += 1; });
    return c;
  }, [pessoas]);

  const contagemTipo = useMemo(() => {
    const equipe = pessoas.filter(ehEquipeDaTrilha).length;
    return { equipe, acampantes: pessoas.length - equipe };
  }, [pessoas]);

  // tipoFiltro: '' todos | 'acampante' | uma das AREAS_COM_CRACHA.
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((p) =>
      (filtro === 'todos' || situacaoDoCracha(p) === filtro)
      && (!grupoFiltro || (grupoFiltro === '-' ? !p.grupo : p.grupo === grupoFiltro))
      && (!tipoFiltro || (tipoFiltro === 'acampante' ? !ehEquipeDaTrilha(p) : areaDe(p) === tipoFiltro))
      && (!termo || semAcento(p.nome).includes(termo)));
  }, [pessoas, filtro, grupoFiltro, tipoFiltro, busca]);

  const imprimiveis = (lista) => lista.filter((p) => situacaoDoCracha(p) !== 'pendente');
  const faltam = useMemo(() => pessoas.filter((p) => ['nao_impresso', 'alterado'].includes(situacaoDoCracha(p))), [pessoas]);
  const escolhidos = useMemo(() => imprimiveis(pessoas.filter((p) => selecionados.has(chaveDe(p)))), [pessoas, selecionados]);

  const itensDe = (lista) => imprimiveis(ordenarCrachas(lista)).map((p) => ({ tipo: p.tipo, id: p.id, ...dadosDoCracha(p) }));

  const gerarPdf = async (lista) => {
    const itens = itensDe(lista);
    if (!itens.length) return;
    setGerando({ feitos: 0, total: itens.length });
    try {
      const nome = itens.length === 1
        ? `cracha_${semAcento(itens[0].nome).replace(/[^a-z ]/g, '').trim().replace(/ +/g, '_')}.pdf`
        : `crachas_metanoia_${new Date().toISOString().split('T')[0]}_${itens.length}.pdf`;
      await gerarPdfCrachas(itens, nome, (feitos, total) => setGerando({ feitos, total }));
      setAConfirmar({ itens, pdf: true });
    } catch (e) {
      toast({ title: 'Não foi possível gerar o PDF', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const confirmarImpressos = async () => {
    setOcupado(true);
    try {
      await marcarCrachasImpressos(aConfirmar.itens);
      toast({ title: 'Crachás marcados como impressos', className: 'bg-emerald-600 text-white' });
      setAConfirmar(null);
      setSelecionados(new Set());
    } catch (e) {
      toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' });
    } finally {
      setOcupado(false);
      carregar();
    }
  };

  const desmarcar = async (p) => {
    setOcupado(true);
    try {
      await desmarcarCrachaImpresso(p.tipo, p.id);
    } catch (e) {
      toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' });
    } finally {
      setOcupado(false);
      carregar();
    }
  };

  const alternar = (p) => setSelecionados((s) => {
    const novo = new Set(s);
    const k = chaveDe(p);
    if (novo.has(k)) novo.delete(k); else novo.add(k);
    return novo;
  });
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((p) => selecionados.has(chaveDe(p)));
  const alternarTodos = () => setSelecionados((s) => {
    const novo = new Set(s);
    visiveis.forEach((p) => (todosVisiveisMarcados ? novo.delete(chaveDe(p)) : novo.add(chaveDe(p))));
    return novo;
  });

  const folhas = (qtd) => Math.ceil(qtd / POR_FOLHA);
  const qtdTexto = (qtd) => `${qtd} (${folhas(qtd)} ${folhas(qtd) === 1 ? 'folha' : 'folhas'})`;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-5xl max-h-[92vh] flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><Contact2 className="w-5 h-5" />Crachás</DialogTitle>
            <DialogDescription className="text-gray-400">
              Acampantes da lista da recepção e dos ônibus (pagos, isentos e com pagamento agendado): <span className="text-white font-medium">{contagemTipo.acampantes}</span>
              {' '}+ equipe da trilha escalada em Infiltrados, Espírito Santo e Inimigo: <span className="text-white font-medium">{contagemTipo.equipe}</span>.
              Número = camisa (1 PP · 2 P · 3 M · 4 G · 5 GG · 6 XG · 7 XXG); <span className="text-white">8 = infiltrado, Espírito Santo e inimigo</span>.
              Folha A4 com 8 crachás, no tamanho do modelo, em ordem de cor e nome.
            </DialogDescription>
          </DialogHeader>

          {aConfirmar && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm flex flex-wrap items-center gap-2">
              <FileDown className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="flex-1 min-w-[220px] text-emerald-100">
                {aConfirmar.pdf
                  ? <>PDF com {aConfirmar.itens.length} {aConfirmar.itens.length === 1 ? 'crachá gerado' : 'crachás gerados'}. Já marcar como {aConfirmar.itens.length === 1 ? 'impresso' : 'impressos'}? Se vai imprimir depois, marque pela lista quando estiver pronto.</>
                  : <>Marcar {aConfirmar.itens.length} {aConfirmar.itens.length === 1 ? 'crachá' : 'crachás'} como {aConfirmar.itens.length === 1 ? 'impresso' : 'impressos'}?</>}
              </span>
              <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setAConfirmar(null)}
                className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">{aConfirmar.pdf ? 'Ainda não' : 'Não'}</Button>
              <Button size="sm" disabled={ocupado} onClick={confirmarImpressos} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Sim, marcar como impressos</>}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {Object.entries(SITUACOES).map(([k, s]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                className={`rounded-md border px-3 py-1.5 text-sm ${filtro === k ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <span className={s.classe || 'text-gray-200'}>{s.rotulo}</span> <span className="tabular-nums text-white font-semibold">{contagem[k]}</span>
              </button>
            ))}
            {carregando && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
          </div>
          {contagem.pendente > 0 && (
            <p className="flex gap-1.5 text-xs text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {contagem.pendente} {contagem.pendente === 1 ? 'pessoa está' : 'pessoas estão'} sem cor ou sem camisa e não {contagem.pendente === 1 ? 'sai' : 'saem'} no PDF. Clique em Editar para completar.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome"
                className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            </div>
            <select value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)} aria-label="Filtrar por cor"
              className="h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-white">
              <option value="">Todas as cores</option>
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="-">Sem cor</option>
            </select>
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} aria-label="Filtrar por tipo"
              className="h-9 rounded-md border border-white/10 bg-zinc-900 px-2 text-sm text-white">
              <option value="">Acampantes e equipe</option>
              <option value="acampante">Só acampantes</option>
              {AREAS_COM_CRACHA.map((a) => <option key={a} value={a}>Só {a}</option>)}
            </select>
            <div className="ml-auto flex flex-wrap gap-2">
              {gerando && <span className="inline-flex items-center gap-1.5 text-sm text-gray-300"><Loader2 className="w-4 h-4 animate-spin" />Gerando o PDF… <span className="tabular-nums">{gerando.feitos}/{gerando.total}</span></span>}
              <Button type="button" disabled={!faltam.length || !!aConfirmar || gerando} onClick={() => gerarPdf(faltam)}
                data-dica="PDF só com os que ainda não foram impressos e os que mudaram depois de impressos."
                className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileDown className="w-4 h-4 mr-2" />PDF dos que faltam: {qtdTexto(faltam.length)}
              </Button>
              <Button type="button" variant="outline" disabled={!escolhidos.length || !!aConfirmar || gerando} onClick={() => gerarPdf(escolhidos)}
                className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10 hover:text-white">
                PDF dos marcados: {qtdTexto(escolhidos.length)}
              </Button>
              <Button type="button" variant="outline" disabled={!imprimiveis(visiveis).length || !!aConfirmar || gerando} onClick={() => gerarPdf(visiveis)}
                data-dica="PDF com todos os que estão na lista abaixo (com os filtros), inclusive os já impressos."
                className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10 hover:text-white">
                PDF da lista: {qtdTexto(imprimiveis(visiveis).length)}
              </Button>
              <Button type="button" variant="outline" disabled={!escolhidos.length || !!aConfirmar || gerando}
                onClick={() => setAConfirmar({ itens: itensDe(escolhidos), pdf: false })}
                data-dica="Marcar os crachás marcados na lista como já impressos (por exemplo, o PDF foi impresso depois, por outra pessoa)."
                className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10 hover:text-white">
                <CheckCircle2 className="w-4 h-4 mr-2" />Marcar como impressos: {escolhidos.length}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 max-h-[52vh] overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs sticky top-0 bg-neutral-900">
                <tr>
                  <th className="px-3 py-2 w-8"><input type="checkbox" checked={todosVisiveisMarcados} onChange={alternarTodos} aria-label="Marcar todos da lista" /></th>
                  <th className="px-3 py-2 text-left">Nome no crachá</th>
                  <th className="px-3 py-2 text-left">Cor</th>
                  <th className="px-3 py-2 text-left">Nº</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!carregando && !visiveis.length && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-500">Ninguém nesta lista.</td></tr>
                )}
                {visiveis.map((p) => {
                  const c = dadosDoCracha(p);
                  const s = situacaoDoCracha(p);
                  return (
                    <tr key={chaveDe(p)} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-1.5"><input type="checkbox" checked={selecionados.has(chaveDe(p))} onChange={() => alternar(p)} aria-label={`Marcar ${p.nome}`} /></td>
                      <td className="px-3 py-1.5 text-gray-100">
                        {c.nome}
                        <EtiquetaArea p={p} />
                      </td>
                      <td className="px-3 py-1.5"><GrupoTrilhaTag grupo={c.grupo} className="text-[10px] px-2" /></td>
                      <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                        {c.numero ? <span className="text-white font-semibold">{c.numero}</span> : <span className="text-red-300">—</span>}
                        <span className="text-gray-500 text-xs ml-1">{ehEquipeDaTrilha(p) ? '' : (camisaNormalizada(p.camisa) || 'sem camisa')}</span>
                      </td>
                      <td className="px-3 py-1.5"><SeloSituacao p={p} /></td>
                      <td className="px-3 py-1.5">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setEditando(p)}
                            className="h-7 px-2 border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white">
                            <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                          </Button>
                          <Button size="sm" variant="outline" disabled={s === 'pendente' || !!aConfirmar || gerando} onClick={() => gerarPdf([p])}
                            data-dica="Gerar o PDF só deste crachá." aria-label={`PDF do crachá de ${p.nome}`}
                            className="h-7 px-2 border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white">
                            <FileDown className="w-3.5 h-3.5" />
                          </Button>
                          {p.impresso && (
                            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => desmarcar(p)}
                              data-dica="Voltar para “não impresso” (marcou sem querer ou o crachá se perdeu)." aria-label={`Desmarcar o crachá de ${p.nome}`}
                              className="h-7 px-2 border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white">
                              <Undo2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500">
            O PDF já sai no tamanho do modelo. Ao imprimir (ou mandar imprimir), use escala 100% / “Tamanho real” — nunca “Ajustar à página” — para o crachá caber no saquinho.
          </p>
        </DialogContent>
      </Dialog>

      {editando && (
        <EditarCracha
          pessoa={editando}
          vinc={vinc}
          onRealocar={onRealocar}
          onFechar={() => setEditando(null)}
          onSalvo={async () => { await Promise.all([carregar(), onAlterado?.()]); }}
          onGerarPdf={(p) => gerarPdf([p])}
        />
      )}
    </>
  );
};

export default CrachasDialog;
