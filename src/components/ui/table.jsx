import { cn } from '@/lib/utils';
import React from 'react';

// cabecalhoFixo: a linha de titulos (Nome, CPF, Igreja...) fica presa no topo
// ao rolar a lista. Como a tabela tambem rola para o lado, quem rola para
// baixo precisa ser a propria moldura (altura da tela), nao a pagina -- o
// sticky so gruda no primeiro ancestral que rola. As celulas fixas nas laterais
// (Nome a esquerda, Acoes a direita) ficam por cima das outras do cabecalho.
// Altura pelo tamanho da pagina (19/10/2026, Patrick): com porPagina ate 25 a
// tabela cresce para baixo, sem barra de rolagem; com 50 ou 100 a moldura mostra
// 25 linhas e o resto rola por dentro (o cabecalho continua preso). Sem
// porPagina, vale a regra antiga: 50% da altura da tela.
const LINHAS_ANTES_DE_ROLAR = 25;

const Table = React.forwardRef(({ className, cabecalhoFixo = false, porPagina = null, ...props }, ref) => {
  const moldura = React.useRef(null);
  const [altura, setAltura] = React.useState(null);
  const rolaPorDentro = cabecalhoFixo && porPagina !== null && porPagina > LINHAS_ANTES_DE_ROLAR;

  // Mede ate o fim da 25a linha (as linhas tem alturas diferentes).
  React.useLayoutEffect(() => {
    if (!rolaPorDentro) { setAltura(null); return undefined; }
    const div = moldura.current;
    const medir = () => {
      const tabela = div?.querySelector('table');
      const linhas = tabela?.tBodies?.[0]?.rows;
      if (!linhas || linhas.length <= LINHAS_ANTES_DE_ROLAR) { setAltura(null); return; }
      const ultima = linhas[LINHAS_ANTES_DE_ROLAR - 1];
      setAltura(ultima.offsetTop + ultima.offsetHeight + 1);
    };
    medir();
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (obs && div?.querySelector('table')) obs.observe(div.querySelector('table'));
    return () => obs?.disconnect();
  });

  return (
    // 19/10/2026: sem "prender" a rolagem -- ao chegar no fim da tabela a roda
    // do mouse volta a rolar a pagina.
    <div ref={moldura}
      className={cn('relative w-full overflow-auto', cabecalhoFixo && porPagina === null && 'max-h-[50dvh]')}
      style={rolaPorDentro && altura ? { maxHeight: altura } : undefined}>
      <table
        ref={ref}
        className={cn(
          'w-full caption-bottom text-sm',
          cabecalhoFixo && '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th]:bg-neutral-900 [&_thead_th.left-0]:z-30 [&_thead_th.right-0]:z-30 [&_thead_th]:shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]',
          className
        )}
        {...props}
      />
    </div>
  );
});
Table.displayName = 'Table';

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('bg-primary font-medium text-primary-foreground', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
};