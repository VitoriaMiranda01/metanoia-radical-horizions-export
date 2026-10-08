import React, { useMemo } from 'react';
import { Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Cupons usados, na aba Pagos (Patrick, 08/10/2026): quantas vezes cada cupom
 * foi usado e quanto descontou -- para conferir e pegar cupom usado
 * indevidamente. Respeita o filtro Todos / Acampantes / Equipantes da tela.
 * Clicar num cupom filtra a lista por ele (de novo, tira o filtro).
 *
 * Os quadros de total arrecadado / PIX / em maos / isentos sairam a pedido do
 * Patrick no mesmo dia.
 */
const formatarValor = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

const ResumoPagamentos = ({ pagos, cupomFiltrado, onFiltrarCupom }) => {
  const { cupons, comCupom } = useMemo(() => {
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
      cupons: [...porCupom.values()].sort((a, b) => b.usos - a.usos),
      comCupom: pagos.filter((i) => i.cupom_usado).length,
    };
  }, [pagos]);

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  return (
    <div className="px-4 md:px-6 pb-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-medium text-white">Cupons usados</span>
          <span className="text-xs text-gray-500">
            {comCupom > 0 ? `${plural(comCupom, 'pagamento', 'pagamentos')} com cupom · clique para ver quem usou` : 'nenhum pagamento com cupom registrado'}
          </span>
        </div>
        {cupons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cupons.map((c) => (
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
