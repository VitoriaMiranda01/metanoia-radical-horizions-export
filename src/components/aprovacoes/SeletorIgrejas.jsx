import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { casaBusca } from '@/utils/busca';
import { cn } from '@/lib/utils';

/**
 * Escolha de varias igrejas com busca (por codigo ou parte do nome, sem
 * diferenca de acento), no mesmo jeito do seletor de igreja da inscricao
 * (IgrejaSelect), mas marcando mais de uma. No pe da lista, "Selecionar todas
 * as igrejas". As escolhidas aparecem como etiquetas abaixo.
 *
 * A lista fica aberta DENTRO da janela, e nao num suspenso (Popover): dentro de
 * um Dialog o suspenso perdia o foco para o botao e nao deixava digitar a
 * busca.
 *
 * opcoes: [{ igreja, quantidade }]. selecionadas: array com o nome das igrejas.
 */
const SeletorIgrejas = ({ opcoes, selecionadas, onChange, rotuloQuantidade = 'inscrições' }) => {
  const [busca, setBusca] = useState('');

  const marcadas = useMemo(() => new Set(selecionadas), [selecionadas]);
  const filtradas = useMemo(
    () => opcoes.filter((o) => casaBusca(busca, [o.igreja])),
    [opcoes, busca]
  );
  const buscando = busca.trim() !== '';
  const todasMarcadas = opcoes.length > 0 && opcoes.every((o) => marcadas.has(o.igreja));
  const filtradasMarcadas = filtradas.length > 0 && filtradas.every((o) => marcadas.has(o.igreja));

  const alternar = (igreja) => {
    onChange(marcadas.has(igreja) ? selecionadas.filter((i) => i !== igreja) : [...selecionadas, igreja]);
  };

  const alternarTodas = () => onChange(todasMarcadas ? [] : opcoes.map((o) => o.igreja));

  // Com busca ativa, marca (ou desmarca) so as que aparecem na lista.
  const alternarEncontradas = () => {
    const nomes = new Set(filtradas.map((o) => o.igreja));
    onChange(filtradasMarcadas
      ? selecionadas.filter((i) => !nomes.has(i))
      : [...selecionadas, ...filtradas.map((o) => o.igreja).filter((i) => !marcadas.has(i))]);
  };

  const Caixa = ({ marcada }) => (
    <span className={cn(
      'mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
      marcada ? 'border-green-500 bg-green-600 text-white' : 'border-white/40'
    )}>
      {marcada && <Check className="h-3 w-3" />}
    </span>
  );

  return (
    <div className="min-w-0 space-y-2">
      <div className="overflow-hidden rounded-md border border-white/20 bg-white/5">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-white/45" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={opcoes.length ? 'Buscar por código ou nome da igreja...' : 'Nenhuma inscrição nesta aba'}
            disabled={opcoes.length === 0}
            className="flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/40"
          />
          {buscando && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpar a busca" className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-[200px] overflow-y-auto p-1.5">
          {filtradas.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-white/45">Nenhuma igreja encontrada.</p>
          ) : filtradas.map((o) => (
            <button
              key={o.igreja}
              type="button"
              onClick={() => alternar(o.igreja)}
              className={cn(
                'flex w-full items-center rounded px-2.5 py-2 text-left text-sm hover:bg-white/10',
                marcadas.has(o.igreja) ? 'bg-blue-500/20' : 'text-gray-100'
              )}
            >
              <Caixa marcada={marcadas.has(o.igreja)} />
              <span className="min-w-0 flex-1 truncate">{o.igreja}</span>
              <span className="ml-2 shrink-0 text-xs text-white/50 tabular-nums">{o.quantidade}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-white/10 p-1.5">
          {buscando && filtradas.length > 0 && (
            <button
              type="button"
              onClick={alternarEncontradas}
              className="flex w-full items-center rounded px-2.5 py-2 text-left text-sm text-gray-100 hover:bg-white/10"
            >
              <Caixa marcada={filtradasMarcadas} />
              Selecionar as {filtradas.length} encontradas
            </button>
          )}
          <button
            type="button"
            onClick={alternarTodas}
            disabled={opcoes.length === 0}
            className="flex w-full items-center rounded px-2.5 py-2 text-left text-sm font-medium text-green-300 hover:bg-white/10"
          >
            <Caixa marcada={todasMarcadas} />
            Selecionar todas as igrejas ({opcoes.length})
          </button>
        </div>
      </div>

      {selecionadas.length > 0 && !todasMarcadas && (
        <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
          {selecionadas.map((igreja) => {
            const o = opcoes.find((x) => x.igreja === igreja);
            return (
              <span key={igreja} className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/20 bg-white/10 py-0.5 pl-2.5 pr-1 text-xs text-white">
                <span className="truncate">{igreja}{o ? ` (${o.quantidade})` : ''}</span>
                <button
                  type="button"
                  onClick={() => alternar(igreja)}
                  aria-label={`Tirar ${igreja}`}
                  className="rounded-full p-0.5 text-white/60 hover:bg-white/20 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {selecionadas.length > 0 && (
        <p className="text-xs text-gray-500">
          {opcoes.filter((o) => marcadas.has(o.igreja)).reduce((t, o) => t + o.quantidade, 0)} {rotuloQuantidade} no total.
        </p>
      )}
    </div>
  );
};

export default SeletorIgrejas;
