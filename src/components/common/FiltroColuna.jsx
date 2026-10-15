import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Filtro por coluna, no estilo do Excel (15/10/2026): no titulo de cada
 * coluna, um funil abre "ordenar" e a lista dos valores daquela coluna para
 * marcar/desmarcar (com busca). Usado em Configuracoes ("Todas as igrejas
 * cadastradas" e "Pastores Parceiros").
 *
 * colunas: [{ chave, rotulo, valor: (linha) => texto|numero, numerica? }]
 *
 *   const f = useFiltrosColunas(linhas, colunas);
 *   <th><CabecalhoFiltro coluna={col} f={f} /></th>
 *   f.linhas -> as linhas filtradas e ordenadas
 */
const VAZIO = '(vazio)';

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const texto = (coluna, linha) => {
  const v = coluna.valor(linha);
  return v === null || v === undefined || v === '' ? VAZIO : String(v);
};

// Numeros como numeros; texto em ordem alfabetica (com "2" antes de "10");
// vazio sempre por ultimo.
const comparar = (a, b) => {
  const va = a === null || a === undefined || a === '' || a === VAZIO;
  const vb = b === null || b === undefined || b === '' || b === VAZIO;
  if (va || vb) return va === vb ? 0 : va ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
};

export const useFiltrosColunas = (linhas, colunas) => {
  const [ordem, setOrdem] = useState(null);      // { chave, dir: 1 | -1 }
  const [filtros, setFiltros] = useState({});    // chave -> Set dos valores marcados

  const passa = (linha, exceto) => colunas.every((c) =>
    c.chave === exceto || !filtros[c.chave] || filtros[c.chave].has(texto(c, linha)));

  const resultado = useMemo(() => {
    const r = linhas.filter((l) => passa(l));
    const col = ordem && colunas.find((c) => c.chave === ordem.chave);
    if (!col) return r;
    return [...r].sort((a, b) => {
      const va = col.valor(a); const vb = col.valor(b);
      const vazioA = va === null || va === undefined || va === '';
      const vazioB = vb === null || vb === undefined || vb === '';
      if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1; // vazio no fim, nos dois sentidos
      return comparar(va, vb) * ordem.dir;
    });
  }, [linhas, colunas, filtros, ordem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Os valores que a coluna mostra na lista: so das linhas que passam nos
  // OUTROS filtros (como no Excel), sem repetir e em ordem.
  const valoresDe = (chave) => {
    const col = colunas.find((c) => c.chave === chave);
    const vistos = new Map();
    linhas.filter((l) => passa(l, chave)).forEach((l) => {
      const t = texto(col, l);
      if (!vistos.has(t)) vistos.set(t, col.valor(l));
    });
    return [...vistos.entries()].sort((a, b) => comparar(a[1] ?? a[0], b[1] ?? b[0])).map(([t]) => t);
  };

  const definirFiltro = (chave, marcados, todos) => setFiltros((atual) => {
    const novo = { ...atual };
    if (!marcados || marcados.size === todos.length) delete novo[chave];
    else novo[chave] = new Set(marcados);
    return novo;
  });

  const ativos = Object.keys(filtros).length;
  const limparTudo = () => { setFiltros({}); setOrdem(null); };

  return { linhas: resultado, ordem, setOrdem, filtros, valoresDe, definirFiltro, ativos, limparTudo };
};

export const CabecalhoFiltro = ({ coluna, f, alinharDireita = false }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const filtrada = !!f.filtros[coluna.chave];
  const ordenada = f.ordem?.chave === coluna.chave ? f.ordem.dir : 0;

  const valores = aberto ? f.valoresDe(coluna.chave) : [];
  const marcados = f.filtros[coluna.chave] || new Set(valores);
  const termo = semAcento(busca.trim());
  const visiveis = termo ? valores.filter((v) => semAcento(v).includes(termo)) : valores;

  const alternar = (v) => {
    const novo = new Set(marcados);
    if (novo.has(v)) novo.delete(v); else novo.add(v);
    f.definirFiltro(coluna.chave, novo, valores);
  };
  // "Selecionar todos" vale para o que a busca mostra.
  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((v) => marcados.has(v));
  const marcarVisiveis = () => {
    const novo = new Set(marcados);
    visiveis.forEach((v) => (todosVisiveisMarcados ? novo.delete(v) : novo.add(v)));
    f.definirFiltro(coluna.chave, novo, valores);
  };
  const somenteVisiveis = () => f.definirFiltro(coluna.chave, new Set(visiveis), valores);

  // Clicar no titulo (setinhas, igual as tabelas da escala): crescente ->
  // decrescente -> volta a ordem padrao.
  const clicarTitulo = () => f.setOrdem(
    ordenada === 0 ? { chave: coluna.chave, dir: 1 }
      : ordenada === 1 ? { chave: coluna.chave, dir: -1 } : null);
  const Seta = ordenada === 1 ? ArrowUp : ordenada === -1 ? ArrowDown : ArrowUpDown;

  const crescente = coluna.numerica ? 'Menor → maior' : 'A → Z';
  const decrescente = coluna.numerica ? 'Maior → menor' : 'Z → A';

  return (
    <span className={cn('inline-flex items-center gap-1', alinharDireita && 'justify-end w-full')}>
      <button type="button" onClick={clicarTitulo}
        data-dica="Ordenar por esta coluna (clique de novo para inverter; a terceira vez volta à ordem padrão)."
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-white', ordenada && 'text-white')}>
        {coluna.rotulo}
        <Seta className={cn('w-3 h-3 shrink-0', ordenada ? 'opacity-100' : 'opacity-40')} />
      </button>
      <Popover open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setBusca(''); }}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`Filtrar a coluna ${coluna.rotulo}`}
            data-dica={`Ordenar ou filtrar por ${coluna.rotulo}`}
            className={cn('rounded p-0.5 hover:bg-white/10 normal-case',
              filtrada ? 'text-sky-300' : 'text-gray-500 hover:text-gray-200')}>
            <Filter className="w-3 h-3" fill={filtrada ? 'currentColor' : 'none'} />
          </button>
        </PopoverTrigger>
        <PopoverContent align={alinharDireita ? 'end' : 'start'}
          className="w-64 p-0 bg-neutral-900 border-white/20 text-white shadow-xl normal-case tracking-normal font-normal">
          <div className="p-1.5 border-b border-white/10">
            {[[1, crescente, ArrowUp], [-1, decrescente, ArrowDown]].map(([dir, rotulo, Icone]) => (
              <button key={dir} type="button"
                onClick={() => f.setOrdem(ordenada === dir ? null : { chave: coluna.chave, dir })}
                className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                  ordenada === dir ? 'bg-sky-500/20 text-sky-200' : 'text-gray-200 hover:bg-white/10')}>
                <Icone className="w-3.5 h-3.5" /> Ordenar {rotulo}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-white/45 shrink-0" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nesta coluna..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-white/40 outline-none py-1" />
          </div>
          <div className="px-1.5 pt-1.5">
            <label className="flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10 cursor-pointer">
              <input type="checkbox" checked={todosVisiveisMarcados} onChange={marcarVisiveis} className="accent-sky-500" />
              {termo ? 'Selecionar todos da busca' : 'Selecionar todos'}
            </label>
          </div>
          <div className="max-h-56 overflow-y-auto px-1.5 pb-1.5">
            {visiveis.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-white/45">Nada encontrado.</p>
            ) : visiveis.map((v) => (
              <label key={v} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-100 hover:bg-white/10 cursor-pointer">
                <input type="checkbox" checked={marcados.has(v)} onChange={() => alternar(v)} className="accent-sky-500 shrink-0" />
                <span className={cn('truncate', v === VAZIO && 'italic text-gray-500')}>{v}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/10 p-1.5">
            {termo ? (
              <button type="button" onClick={somenteVisiveis} className="rounded px-2 py-1 text-xs text-sky-300 hover:bg-white/10">
                Só os da busca
              </button>
            ) : <span />}
            <button type="button" disabled={!filtrada}
              onClick={() => f.definirFiltro(coluna.chave, null, valores)}
              className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40">
              Limpar filtro
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
};
