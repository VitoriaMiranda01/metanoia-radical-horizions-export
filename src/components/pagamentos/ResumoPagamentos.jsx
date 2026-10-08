import React, { useMemo } from 'react';
import { Banknote, QrCode, Wallet, Gift, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Resumo da aba Pagos (Patrick, 08/10/2026): quanto entrou, por onde, e o uso
 * de cada cupom -- para conferir e pegar cupom usado indevidamente. Respeita
 * o filtro Todos / Acampantes / Equipantes da tela. Clicar num cupom filtra a
 * lista por ele (de novo, tira o filtro).
 *
 * Pagamentos antigos sem valor registrado (em maos antes de 08/10/2026)
 * entram na contagem, mas nao na soma -- e o quadro avisa quantos sao.
 */
const formatarValor = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

// Classes por extenso (o Tailwind nao enxerga classe montada com variavel).
const CORES = {
  emerald: { fundo: 'bg-emerald-500/15', icone: 'text-emerald-400' },
  blue: { fundo: 'bg-blue-500/15', icone: 'text-blue-400' },
  amber: { fundo: 'bg-amber-500/15', icone: 'text-amber-400' },
  purple: { fundo: 'bg-purple-500/15', icone: 'text-purple-400' },
};

const Quadro = ({ icone: Icone, cor, titulo, valor, detalhe, dica }) => (
  <div className="rounded-lg border border-white/10 bg-white/5 p-4 flex items-center gap-3 min-w-0" data-dica={dica}>
    <div className={`p-2.5 rounded-full shrink-0 ${CORES[cor].fundo}`}>
      <Icone className={`w-5 h-5 ${CORES[cor].icone}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-white leading-tight">{valor}</p>
      <p className="text-sm text-gray-300">{titulo}</p>
      {detalhe && <p className="text-xs text-gray-500 mt-0.5">{detalhe}</p>}
    </div>
  </div>
);

const ResumoPagamentos = ({ pagos, cupomFiltrado, onFiltrarCupom }) => {
  const r = useMemo(() => {
    const soma = (lista) => lista.reduce((t, i) => t + (Number(i.valor_pago) || 0), 0);
    const forma = (i) => String(i.metodo_pagamento || '').toLowerCase();
    const comValor = pagos.filter((i) => i.valor_pago !== null && i.valor_pago !== undefined);
    const pix = pagos.filter((i) => forma(i) === 'pix');
    const maos = pagos.filter((i) => forma(i) !== 'pix' && forma(i) !== 'isento');
    const isentos = pagos.filter((i) => forma(i) === 'isento');
    const porCupom = new Map();
    pagos.forEach((i) => {
      if (!i.cupom_usado) return;
      const c = porCupom.get(i.cupom_usado) || { codigo: i.cupom_usado, usos: 0, desconto: 0, acampantes: 0, equipantes: 0 };
      c.usos += 1;
      c.desconto += Number(i.desconto) || 0;
      if (i.tipo === 'acampante') c.acampantes += 1; else c.equipantes += 1;
      porCupom.set(i.cupom_usado, c);
    });
    return {
      total: soma(comValor),
      semValor: pagos.length - comValor.length,
      pix: { n: pix.length, soma: soma(pix) },
      maos: { n: maos.length, soma: soma(maos), semValor: maos.filter((i) => i.valor_pago === null || i.valor_pago === undefined).length },
      isentos: isentos.length,
      cupons: [...porCupom.values()].sort((a, b) => b.usos - a.usos),
      comCupom: pagos.filter((i) => i.cupom_usado).length,
    };
  }, [pagos]);

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  return (
    <div className="px-4 md:px-6 pb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Quadro
          icone={Banknote} cor="emerald" titulo="Total arrecadado" valor={formatarValor(r.total)}
          detalhe={r.semValor > 0 ? `${plural(r.semValor, 'pagamento', 'pagamentos')} sem valor registrado` : plural(pagos.length, 'pagamento', 'pagamentos')}
          dica="Soma do que foi pago (PIX + em mãos). Pagamentos em mãos confirmados antes de 08/10/2026 não têm valor registrado e ficam fora da soma."
        />
        <Quadro
          icone={QrCode} cor="blue" titulo="PIX" valor={formatarValor(r.pix.soma)}
          detalhe={plural(r.pix.n, 'pagamento', 'pagamentos')}
          dica="Pagamentos feitos pelo PIX do site."
        />
        <Quadro
          icone={Wallet} cor="amber" titulo="Em mãos" valor={formatarValor(r.maos.soma)}
          detalhe={`${plural(r.maos.n, 'pagamento', 'pagamentos')}${r.maos.semValor ? ` · ${r.maos.semValor} sem valor` : ''}`}
          dica="Pagamentos recebidos em mãos (dinheiro, cartão, depósito) e confirmados por um organizador."
        />
        <Quadro
          icone={Gift} cor="purple" titulo="Isentos" valor={r.isentos}
          detalhe="dispensados da taxa"
          dica="Inscrições isentadas por um organizador."
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-medium text-white">Cupons usados</span>
          <span className="text-xs text-gray-500">
            {r.comCupom > 0 ? `${plural(r.comCupom, 'pagamento', 'pagamentos')} com cupom · clique para ver quem usou` : 'nenhum pagamento com cupom registrado'}
          </span>
        </div>
        {r.cupons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.cupons.map((c) => (
              <button
                key={c.codigo} type="button"
                onClick={() => onFiltrarCupom(cupomFiltrado === c.codigo ? null : c.codigo)}
                aria-pressed={cupomFiltrado === c.codigo}
                data-dica={`${c.acampantes} acampante(s) e ${c.equipantes} equipante(s) usaram ${c.codigo}. Clique para filtrar a lista.`}
                className={cn(
                  'h-9 px-3 rounded-md border text-sm transition-colors',
                  cupomFiltrado === c.codigo
                    ? 'border-pink-500/60 bg-pink-500/15 text-white'
                    : 'border-white/10 bg-black/20 text-gray-300 hover:bg-white/10'
                )}
              >
                <span className="font-semibold">{c.codigo}</span>
                <span className="text-gray-400"> · {plural(c.usos, 'uso', 'usos')} · −{formatarValor(c.desconto)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumoPagamentos;
