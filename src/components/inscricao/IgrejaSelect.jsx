import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Seletor de igreja com busca embutida (por codigo ou por nome), usado no
// campo "Igreja Responsavel pela Inscricao" (formulario de acampante,
// AdminResponsavel.jsx) e "Igreja que frequenta" (formulario de
// equipante, InfoEclesiasticas.jsx). Antes era um <Select> comum, sem
// busca -- com a lista de igrejas grande (145 opcoes), ficava dificil
// achar a igreja certa rolando a lista manualmente. Pedido da usuaria em
// 2026-09-10, aprovado a partir de um mockup mostrado antes de
// implementar.
//
// Construido em cima do Popover (ja instalado no projeto, evita
// adicionar a dependencia cmdk so pra isso) em vez do <Select> do
// Radix, porque o Select nao da pra colocar um campo de texto livre
// dentro sem brigar com a navegacao por teclado dele.
//
// options: array de strings no formato "NN - Nome" (igual
// IGREJAS_PARCEIRAS). disabledOptions: Set opcional com as opcoes que
// devem aparecer desabilitadas (ex: igrejasEsgotadas).
const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const destacarTrecho = (texto, termo) => {
  if (!termo) return texto;
  const textoNormalizado = normalizar(texto);
  const termoNormalizado = normalizar(termo);
  const indice = textoNormalizado.indexOf(termoNormalizado);
  if (indice === -1) return texto;
  return (
    <>
      {texto.slice(0, indice)}
      <mark className="bg-yellow-400/40 text-inherit rounded-sm">
        {texto.slice(indice, indice + termo.length)}
      </mark>
      {texto.slice(indice + termo.length)}
    </>
  );
};

const IgrejaSelect = ({
  id,
  value,
  onChange,
  options,
  disabledOptions,
  placeholder = 'Selecione a igreja...',
  disabledSuffix = ' (limite atingido)'
}) => {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');

  const opcoesFiltradas = useMemo(() => {
    const termo = busca.trim();
    if (!termo) return options;
    const termoNormalizado = normalizar(termo);
    return options.filter(opcao => normalizar(opcao).includes(termoNormalizado));
  }, [options, busca]);

  const handleAbrirFechar = (proximoEstado) => {
    setOpen(proximoEstado);
    if (proximoEstado) setBusca('');
  };

  const handleSelecionar = (opcao) => {
    onChange(opcao);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleAbrirFechar}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white text-left"
        >
          <span className={`truncate ${value ? '' : 'text-white/50'}`}>{value || placeholder}</span>
          <ChevronDown className="h-4 w-4 text-white/60 shrink-0 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0 bg-neutral-900 border-white/20 text-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search className="h-4 w-4 text-white/45 shrink-0" />
          <input
            autoFocus
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por código ou nome..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none py-1"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1.5">
          {opcoesFiltradas.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-white/45">Nenhuma igreja encontrada.</p>
          ) : (
            opcoesFiltradas.map(opcao => {
              const desabilitada = !!disabledOptions?.has(opcao);
              const selecionada = opcao === value;
              const [codigo, ...resto] = opcao.split(' - ');
              const nome = resto.join(' - ');
              return (
                <button
                  key={opcao}
                  type="button"
                  disabled={desabilitada}
                  onClick={() => handleSelecionar(opcao)}
                  className={[
                    'flex w-full items-center rounded px-2.5 py-2 text-left text-sm',
                    desabilitada
                      ? 'cursor-not-allowed text-white/35'
                      : selecionada
                        ? 'bg-blue-500/20 text-white'
                        : 'text-gray-100 hover:bg-white/10'
                  ].join(' ')}
                >
                  <span className="mr-1 text-blue-300 tabular-nums shrink-0">{codigo} -</span>
                  <span className="truncate">{destacarTrecho(nome, busca)}</span>
                  {desabilitada && <span className="ml-2 shrink-0 text-xs text-red-300">{disabledSuffix}</span>}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-white/10 px-3 py-1.5 text-[11px] text-white/35">
          {busca ? `${opcoesFiltradas.length} de ${options.length} igrejas` : `${options.length} igrejas`}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default IgrejaSelect;
