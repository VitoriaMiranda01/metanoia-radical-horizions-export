import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Search, Table2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  MODOS_RELACAO, montarLinhasRelacao, agruparRelacao, exportarRelacaoPdf, exportarRelacaoExcel
} from '@/utils/relacaoNominal';
import { montarEscalaOficial } from '@/utils/escalaOficial';
import { montarEquipeTrilha, ehAreaDaTrilha } from '@/utils/equipeTrilha';
import { cn } from '@/lib/utils';

/**
 * Exportar da Geracao de Escalas (17/10/2026, Patrick): a RELAÇÃO NOMINAL no
 * modelo da planilha oficial (Nome / Igreja / Área), de 3 jeitos -- geral, por
 * igreja e por área --, cada um em PDF ou Excel. Por igreja e por area, antes
 * de gerar, escolhe-se quais igrejas/areas entram (com "Selecionar todas").
 * A planilha detalhada antiga (uma aba por área, com as 3 opções da inscrição)
 * continua no fim do menu.
 */
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ExportarRelacaoMenu = ({ allocations, atuacoesPorArea, onPlanilhaDetalhada, disabled }) => {
  const { toast } = useToast();
  const [gerando, setGerando] = useState(null);
  // { modo, formato } enquanto escolhe as igrejas/areas
  const [escolhendo, setEscolhendo] = useState(null);

  const gruposDe = (modo) => {
    const linhas = montarLinhasRelacao(allocations);
    if (linhas.length === 0) throw new Error('Ninguém escalado para exportar.');
    return modo === 'oficial' ? montarEscalaOficial(linhas, atuacoesPorArea) : agruparRelacao(linhas, modo);
  };

  // Por área: as áreas da Equipe de Trilha marcadas saem num arquivo próprio,
  // no modelo da planilha "Equipe de trilha" (equipeTrilha.js); as demais, na
  // relação por área de sempre.
  const gerar = async (modo, formato, grupos) => {
    setGerando(`${modo}-${formato}`);
    try {
      const daTrilha = modo === 'area' ? grupos.filter((g) => ehAreaDaTrilha(g.titulo)) : [];
      const outros = grupos.filter((g) => !daTrilha.includes(g));
      let total = 0;
      if (daTrilha.length) {
        const t = await import('@/utils/equipeTrilha');
        const itens = montarEquipeTrilha(daTrilha.flatMap((g) => g.linhas), atuacoesPorArea);
        total += formato === 'pdf' ? await t.exportarTrilhaPdf(itens) : await t.exportarTrilhaExcel(itens);
      }
      if (outros.length) {
        total += formato === 'pdf'
          ? await exportarRelacaoPdf(outros, modo)
          : await exportarRelacaoExcel(outros, modo);
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
      const grupos = gruposDe(modo);
      if (modo === 'geral' || modo === 'oficial') gerar(modo, formato, grupos);
      else setEscolhendo({ modo, formato, grupos });
    } catch (e) {
      toast({ title: 'Não foi possível exportar', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button data-dica="Baixar a escala oficial, a escala nominal, por igreja ou por área, em PDF ou Excel." disabled={disabled || !!gerando}
            variant="outline" className="bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/40 hover:text-green-300">
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 bg-zinc-950 border-white/10 text-gray-100">
          <DropdownMenuLabel className="text-xs text-gray-400 font-normal">
            Oficial no modelo da planilha; as demais em ordem alfabética
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
        <EscolherGrupos
          modo={escolhendo.modo} formato={escolhendo.formato} grupos={escolhendo.grupos}
          onClose={() => setEscolhendo(null)}
          onGerar={(selecionados) => {
            const { modo, formato } = escolhendo;
            setEscolhendo(null);
            gerar(modo, formato, selecionados);
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
    <span className="text-xs text-gray-400 shrink-0">{g.linhas.length}</span>
  </label>
);

// Quais igrejas (ou areas) entram na relacao.
const EscolherGrupos = ({ modo, formato, grupos, onClose, onGerar }) => {
  const [marcados, setMarcados] = useState(() => new Set());
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca.trim());
  const mostrados = useMemo(() => grupos.filter((g) => !termo || semAcento(g.titulo).includes(termo)), [grupos, termo]);
  const todos = marcados.size === grupos.length;
  const pessoas = grupos.filter((g) => marcados.has(g.titulo)).reduce((n, g) => n + g.linhas.length, 0);
  // Subcategoria "Equipe de Trilha" (só no Por área): Guia, Inimigo, Espírito
  // Santo, Invisível, Marcador e Pastor Invisível, com um "marcar toda a equipe".
  const trilha = useMemo(
    () => (modo === 'area' ? grupos.filter((g) => ehAreaDaTrilha(g.titulo)).map((g) => g.titulo) : []),
    [grupos, modo]
  );
  const trilhaMostrada = mostrados.filter((g) => trilha.includes(g.titulo));
  const demaisMostradas = mostrados.filter((g) => !trilha.includes(g.titulo));
  const trilhaMarcadas = trilha.filter((t) => marcados.has(t)).length;
  const pessoasTrilha = grupos.filter((g) => trilha.includes(g.titulo)).reduce((n, g) => n + g.linhas.length, 0);
  const alternarTrilha = (marcar) => setMarcados((m) => {
    const n = new Set(m);
    trilha.forEach((t) => (marcar ? n.add(t) : n.delete(t)));
    return n;
  });
  const nome = modo === 'igreja' ? { um: 'igreja', varios: 'igrejas', todas: 'Selecionar todas' } : { um: 'área', varios: 'áreas', todas: 'Selecionar todas' };

  const alternar = (titulo) => setMarcados((m) => {
    const n = new Set(m);
    if (n.has(titulo)) n.delete(titulo); else n.add(titulo);
    return n;
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-zinc-950 border border-white/10 rounded-lg shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 p-4 border-b border-white/10">
          <div className="flex-1">
            <h3 className="text-white font-semibold">
              {MODOS_RELACAO[modo].rotulo} · {formato === 'pdf' ? 'PDF' : 'Excel'}
            </h3>
            <p className="text-sm text-gray-400">Marque quais {nome.varios} entram na relação.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${nome.um}`}
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer px-1">
            <input type="checkbox" className="h-4 w-4 accent-green-500" checked={todos}
              onChange={(e) => setMarcados(e.target.checked ? new Set(grupos.map((g) => g.titulo)) : new Set())} />
            {nome.todas} ({grupos.length})
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
          {demaisMostradas.map((g) => (
            <ItemGrupo key={g.titulo} g={g} marcado={marcados.has(g.titulo)} onAlternar={() => alternar(g.titulo)} />
          ))}
          {mostrados.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Nada encontrado.</p>}
        </div>
        <div className="p-3 border-t border-white/10 flex items-center gap-3">
          <p className="flex-1 text-sm text-gray-300">
            {marcados.size === 0 ? `Nenhuma ${nome.um} marcada.`
              : `${marcados.size} ${marcados.size === 1 ? nome.um : nome.varios} · ${pessoas} ${pessoas === 1 ? 'linha' : 'linhas'}`}
          </p>
          <Button disabled={marcados.size === 0} onClick={() => onGerar(grupos.filter((g) => marcados.has(g.titulo)))}
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
