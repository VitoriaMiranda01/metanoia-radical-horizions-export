import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Paginacao das listagens.
 *
 * POR QUE EXISTE
 * --------------
 * As telas desenhavam a lista inteira de uma vez. Num teste com 695
 * acampantes isso gerou quase 1.400 botoes no HTML da pagina -- funcionou em
 * computador (1,6s), mas e justamente o tipo de coisa que trava celular mais
 * simples, que e onde a equipe vai usar no dia do evento.
 *
 * Padrao de 50 por pagina, com opcao de 100. A busca e os filtros continuam
 * valendo sobre a lista TODA, nao so sobre a pagina aberta -- quem procura um
 * nome encontra, esteja ele na primeira pagina ou na ultima.
 */

export const OPCOES_POR_PAGINA = [50, 100];

/**
 * Recebe a lista ja filtrada e devolve a fatia da pagina atual.
 * Volta para a primeira pagina sempre que a lista muda (ex.: ao digitar na
 * busca) -- senao a pessoa ficaria olhando uma pagina 7 que nao existe mais.
 */
export const usePaginacao = (itens, tamanhoInicial = 50) => {
  const [porPagina, setPorPagina] = useState(tamanhoInicial);
  const [pagina, setPagina] = useState(1);

  const total = itens?.length || 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  useEffect(() => {
    setPagina(1);
  }, [total, porPagina]);

  const paginaSegura = Math.min(pagina, totalPaginas);

  const itensDaPagina = useMemo(() => {
    const inicio = (paginaSegura - 1) * porPagina;
    return (itens || []).slice(inicio, inicio + porPagina);
  }, [itens, paginaSegura, porPagina]);

  return {
    itensDaPagina,
    pagina: paginaSegura,
    setPagina,
    porPagina,
    setPorPagina,
    totalPaginas,
    total,
    primeiro: total === 0 ? 0 : (paginaSegura - 1) * porPagina + 1,
    ultimo: Math.min(paginaSegura * porPagina, total),
  };
};

const Paginacao = ({ pagina, setPagina, porPagina, setPorPagina, totalPaginas, total, primeiro, ultimo }) => {
  // Com uma pagina so e sem opcao de mudar o tamanho, nao ha o que mostrar.
  if (total <= OPCOES_POR_PAGINA[0]) return null;

  const irPara = (n) => setPagina(Math.min(Math.max(1, n), totalPaginas));

  // Mostra no maximo 5 numeros, centrados na pagina atual.
  const numeros = [];
  const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
  for (let n = inicio; n <= Math.min(totalPaginas, inicio + 4); n++) numeros.push(n);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/10 bg-white/5">
      <p className="text-sm text-gray-400 order-2 md:order-1">
        Mostrando <span className="text-white font-medium">{primeiro}</span>–
        <span className="text-white font-medium">{ultimo}</span> de{' '}
        <span className="text-white font-medium">{total}</span>
      </p>

      <div className="flex items-center gap-2 order-1 md:order-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => irPara(pagina - 1)}
          disabled={pagina === 1}
          className="h-9 px-2 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {numeros.map((n) => (
          <Button
            key={n}
            size="sm"
            onClick={() => irPara(n)}
            className={`h-9 w-9 p-0 ${
              n === pagina
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-transparent border border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
            }`}
            aria-current={n === pagina ? 'page' : undefined}
          >
            {n}
          </Button>
        ))}

        <Button
          size="sm"
          variant="outline"
          onClick={() => irPara(pagina + 1)}
          disabled={pagina === totalPaginas}
          className="h-9 px-2 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 order-3">
        <span className="text-sm text-gray-400">Por página:</span>
        {OPCOES_POR_PAGINA.map((n) => (
          <Button
            key={n}
            size="sm"
            onClick={() => setPorPagina(n)}
            className={`h-9 px-3 ${
              n === porPagina
                ? 'bg-white/15 text-white border border-white/20'
                : 'bg-transparent border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Paginacao;
