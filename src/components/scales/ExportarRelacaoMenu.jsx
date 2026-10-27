import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Search, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  MODOS_RELACAO, COLUNAS_EXTRAS, montarLinhasRelacao, agruparRelacao, exportarRelacaoPdf, exportarRelacaoExcel
} from '@/utils/relacaoNominal';
import { montarEscalaOficial } from '@/utils/escalaOficial';
import { montarEquipeTrilha, ehAreaDaTrilha } from '@/utils/equipeTrilha';
import { cn } from '@/lib/utils';
import { AREA_SO_DOMINGO } from '@/components/common/TagSoDomingo';

/**
 * Exportar da Geracao de Escalas (17/10/2026, Patrick): a RELAÇÃO NOMINAL no
 * modelo da planilha oficial (Nome / Igreja / Área), de 3 jeitos -- geral, por
 * igreja e por área --, cada um em PDF ou Excel. 27/10/2026: toda exportacao
 * abre antes uma tela de FILTROS (nome, igrejas, areas) e de COLUNAS EXTRAS
 * (WhatsApp, idade, nascimento, atuacao, cor), todas opcionais.
 * A planilha detalhada antiga (uma aba por área, com as 3 opções da inscrição)
 * continua no fim do menu.
 */
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// soDomingo (20261025c): aprovados que vao so no domingo. Nao estao na escala
// -- entram SO no "Por área", como a area "Vão somente no domingo".
const ExportarRelacaoMenu = ({ allocations, atuacoesPorArea, soDomingo = [], onPlanilhaDetalhada, disabled }) => {
  const { toast } = useToast();
  const [gerando, setGerando] = useState(null);
  // { modo, formato, linhas } enquanto escolhe os filtros
  const [escolhendo, setEscolhendo] = useState(null);

  const linhasDe = (modo) => {
    const domingo = modo === 'area'
      ? soDomingo.map((p) => ({ ...p, allocatedArea: AREA_SO_DOMINGO, cor: null, atuacao: null }))
      : [];
    const linhas = montarLinhasRelacao([...(allocations || []), ...domingo], atuacoesPorArea);
    if (linhas.length === 0) throw new Error('Ninguém escalado para exportar.');
    return linhas;
  };

  // Por área: as áreas da Equipe de Trilha marcadas saem num arquivo próprio,
  // no modelo da planilha "Equipe de trilha" (equipeTrilha.js); as demais, na
  // relação por área de sempre.
  const gerar = async (modo, formato, linhas, extras) => {
    setGerando(`${modo}-${formato}`);
    try {
      const grupos = modo === 'oficial' ? montarEscalaOficial(linhas, atuacoesPorArea) : agruparRelacao(linhas, modo);
      const daTrilha = modo === 'area' ? grupos.filter((g) => ehAreaDaTrilha(g.titulo)) : [];
      const outros = grupos.filter((g) => !daTrilha.includes(g));
      let total = 0;
      if (daTrilha.length) {
        const t = await import('@/utils/equipeTrilha');
        const itens = montarEquipeTrilha(daTrilha.flatMap((g) => g.linhas), atuacoesPorArea, extras);
        total += formato === 'pdf' ? await t.exportarTrilhaPdf(itens, extras) : await t.exportarTrilhaExcel(itens, extras);
      }
      if (outros.length) {
        total += formato === 'pdf'
          ? await exportarRelacaoPdf(outros, modo, extras)
          : await exportarRelacaoExcel(outros, modo, extras);
      }
      toast({
        title: `${MODOS_RELACAO[modo].rotulo} em ${formato === 'pdf' ? 'PDF' : 'Excel'} gerado`,
        description: `${total} ${total === 1 ? 'linha' : 'linhas'}.`,
        className: 'bg-green-600 text-white'
      });
    } catch (e) {
      toast({ title: 'Não foi possível exportar', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  const escolher = (modo, formato) => {
    try {
      setEscolhendo({ modo, formato, linhas: linhasDe(modo) });
    } catch (e) {
      toast({ title: 'Não foi possível exportar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button data-dica="Baixar a escala oficial, a escala nominal, por igreja ou por área, em PDF ou Excel. Antes de gerar, dá para filtrar por nome, igreja e área e incluir WhatsApp, idade e outras colunas." disabled={disabled || !!gerando}
            variant="outline" className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/40 hover:text-green-300">
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 bg-zinc-950 border-white/10 text-gray-100">
          <DropdownMenuLabel className="text-xs text-gray-400 font-normal">
            Oficial no modelo da planilha; as demais em ordem alfabética. Você escolhe os filtros antes de gerar.
          </DropdownMenuLabel>
          {Object.entries(MODOS_RELACAO).map(([modo, info], i) => (
            <React.Fragment key={modo}>
              {i > 0 && <DropdownMenuSeparator className="bg-white/10" />}
              <DropdownMenuLabel className="text-sm text-white">{i + 1}. {info.rotulo}</DropdownMenuLabel>
              <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                <DropdownMenuItem onSelect={() => escolher(modo, 'pdf')}
                  className="cursor-pointer justify-center gap-1.5 border border-white/10 focus:bg-red-500/15">
                  <FileText className="h-4 w-4 text-red-300" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => escolher(modo, 'excel')}
                  className="cursor-pointer justify-center gap-1.5 border border-white/10 focus:bg-green-500/15">
                  <FileSpreadsheet className="h-4 w-4 text-green-300" /> Excel
                </DropdownMenuItem>
              </div>
            </React.Fragment>
          ))}
          {onPlanilhaDetalhada && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onSelect={onPlanilhaDetalhada} className="cursor-pointer gap-2 text-gray-300">
                <Table2 className="h-4 w-4" /> Planilha detalhada (uma aba por área, com as 3 opções)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {escolhendo && (
        <FiltrosExportacao
          modo={escolhendo.modo} formato={escolhendo.formato} linhas={escolhendo.linhas}
          onClose={() => setEscolhendo(null)}
          onGerar={(linhas, extras) => {
            const { modo, formato } = escolhendo;
            setEscolhendo(null);
            gerar(modo, formato, linhas, extras);
          }} />
      )}
    </>
  );
};

const ItemGrupo = ({ g, marcado, onAlternar }) => (
  <label
    className={cn('flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm',
      marcado ? 'border-green-500/50 bg-green-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10')}>
    <input type="checkbox" className="h-4 w-4 accent-green-500" checked={marcado} onChange={onAlternar} />
    <span className="flex-1 min-w-0 truncate">{g.titulo}</span>
    <span className="text-xs text-gray-400 shrink-0">{g.n}</span>
  </label>
);

// Lista recolhivel de igrejas (ou areas), com busca e "Selecionar todas". Tudo
// vem marcado; o organizador desmarca o que nao quer. Nas areas, as da Equipe
// de Trilha ficam numa subcategoria com "selecionar toda a equipe".
const ListaFiltro = ({ rotulo, nomeUm, itens, marcados, setMarcados, trilha = [] }) => {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca.trim());
  const mostrados = useMemo(() => itens.filter((g) => !termo || semAcento(g.titulo).includes(termo)), [itens, termo]);
  const todos = marcados.size === itens.length;
  const trilhaMostrada = mostrados.filter((g) => trilha.includes(g.titulo));
  const demais = mostrados.filter((g) => !trilha.includes(g.titulo));
  const trilhaMarcadas = trilha.filter((t) => marcados.has(t)).length;
  const pessoasTrilha = itens.filter((g) => trilha.includes(g.titulo)).reduce((n, g) => n + g.n, 0);

  const alternar = (titulo) => setMarcados((m) => {
    const n = new Set(m);
    if (n.has(titulo)) n.delete(titulo); else n.add(titulo);
    return n;
  });
  const alternarTrilha = (marcar) => setMarcados((m) => {
    const n = new Set(m);
    trilha.forEach((t) => (marcar ? n.add(t) : n.delete(t)));
    return n;
  });

  return (
    <div className="rounded-md border border-white/10">
      <button type="button" onClick={() => setAberta((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white">
        {aberta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 text-left font-medium">{rotulo}</span>
        <span className={cn('text-xs', todos ? 'text-gray-400' : 'text-green-300')}>
          {todos ? 'Todas' : `${marcados.size} de ${itens.length}`}
        </span>
      </button>
      {aberta && (
        <div className="border-t border-white/10 p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${nomeUm}`}
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer px-1">
            <input type="checkbox" className="h-4 w-4 accent-green-500" checked={todos}
              onChange={(e) => setMarcados(e.target.checked ? new Set(itens.map((g) => g.titulo)) : new Set())} />
            Selecionar todas ({itens.length})
          </label>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {trilhaMostrada.length > 0 && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-1.5 space-y-1 mb-2">
                <label className="flex items-center gap-2 px-1.5 py-1 cursor-pointer text-sm font-semibold text-white">
                  <input type="checkbox" className="h-4 w-4 accent-green-500"
                    checked={trilhaMarcadas === trilha.length}
                    ref={(el) => { if (el) el.indeterminate = trilhaMarcadas > 0 && trilhaMarcadas < trilha.length; }}
                    onChange={(e) => alternarTrilha(e.target.checked)} />
                  <span className="flex-1">Equipe de Trilha <span className="font-normal text-gray-400">· selecionar toda a equipe</span></span>
                  <span className="text-xs text-gray-400 shrink-0">{pessoasTrilha}</span>
                </label>
                <div className="pl-4 space-y-1">
                  {trilhaMostrada.map((g) => (
                    <ItemGrupo key={g.titulo} g={g} marcado={marcados.has(g.titulo)} onAlternar={() => alternar(g.titulo)} />
                  ))}
                </div>
              </div>
            )}
            {demais.map((g) => (
              <ItemGrupo key={g.titulo} g={g} marcado={marcados.has(g.titulo)} onAlternar={() => alternar(g.titulo)} />
            ))}
            {mostrados.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const contar = (linhas, chave) => {
  const m = new Map();
  linhas.forEach((l) => { const k = chave(l); m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })).map(([titulo, n]) => ({ titulo, n }));
};

// Tela de filtros da exportacao (27/10/2026): nome, igrejas, areas e colunas extras.
const FiltrosExportacao = ({ modo, formato, linhas, onClose, onGerar }) => {
  const igrejas = useMemo(() => contar(linhas, (l) => l.igreja || 'SEM IGREJA'), [linhas]);
  const areas = useMemo(() => contar(linhas, (l) => l.areaBase), [linhas]);
  const trilha = useMemo(() => areas.filter((a) => ehAreaDaTrilha(a.titulo)).map((a) => a.titulo), [areas]);
  const [nome, setNome] = useState('');
  const [igrejasSel, setIgrejasSel] = useState(() => new Set(igrejas.map((i) => i.titulo)));
  const [areasSel, setAreasSel] = useState(() => new Set(areas.map((a) => a.titulo)));
  const [extrasSel, setExtrasSel] = useState(() => new Set());

  const filtradas = useMemo(() => {
    const termo = semAcento(nome.trim());
    return linhas.filter((l) => (!termo || semAcento(l.nome).includes(termo))
      && igrejasSel.has(l.igreja || 'SEM IGREJA') && areasSel.has(l.areaBase));
  }, [linhas, nome, igrejasSel, areasSel]);
  const extras = COLUNAS_EXTRAS.filter((c) => extrasSel.has(c.id));
  const alternarExtra = (id) => setExtrasSel((m) => {
    const n = new Set(m);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-zinc-950 border border-white/10 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 border-b border-white/10">
          <div className="flex-1">
            <h3 className="text-white font-semibold">
              {MODOS_RELACAO[modo].rotulo} · {formato === 'pdf' ? 'PDF' : 'Excel'}
            </h3>
            <p className="text-sm text-gray-400">Filtre quem entra e escolha as colunas. Sem filtro, sai todo mundo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Filtrar por nome"
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          <ListaFiltro rotulo="Igrejas" nomeUm="igreja" itens={igrejas} marcados={igrejasSel} setMarcados={setIgrejasSel} />
          <ListaFiltro rotulo="Áreas" nomeUm="área" itens={areas} marcados={areasSel} setMarcados={setAreasSel} trilha={trilha} />
          <div className="rounded-md border border-white/10 p-3">
            <p className="text-sm font-medium text-white mb-1">Colunas extras</p>
            <p className="text-xs text-gray-400 mb-2">Entram depois de Nome, Igreja e Área. Dados pessoais: use só para a organização.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COLUNAS_EXTRAS.map((c) => (
                <label key={c.id}
                  className={cn('flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm capitalize',
                    extrasSel.has(c.id) ? 'border-green-500/50 bg-green-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10')}>
                  <input type="checkbox" className="h-4 w-4 accent-green-500" checked={extrasSel.has(c.id)} onChange={() => alternarExtra(c.id)} />
                  {c.rotulo.toLocaleLowerCase('pt-BR')}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-white/10 flex items-center gap-3">
          <p className="flex-1 text-sm text-gray-300">
            {filtradas.length === 0 ? 'Nenhuma linha com esses filtros.'
              : `${filtradas.length} ${filtradas.length === 1 ? 'linha' : 'linhas'}${extras.length ? ` · ${extras.length} ${extras.length === 1 ? 'coluna extra' : 'colunas extras'}` : ''}`}
          </p>
          <Button disabled={filtradas.length === 0} onClick={() => onGerar(filtradas, extras)}
            className="bg-green-600 hover:bg-green-700 text-white">
            {formato === 'pdf' ? <FileText className="h-4 w-4 mr-1.5" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
            Gerar {formato === 'pdf' ? 'PDF' : 'Excel'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExportarRelacaoMenu;
