import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

// Os tres cartoes de cima sao o mesmo recorte das abas de baixo -- quem le
// "1 Aprovadas" quer ver essa uma. Antes eram so quadros; agora trocam a aba,
// e o cartao da aba aberta fica marcado para nao restar duvida de qual lista
// esta na tela.
//
// abaAtiva/onSelecionar sao opcionais: sem eles os cartoes voltam a ser so
// informacao (nenhuma tela usa assim hoje, mas o componente nao quebra).
const AprovacoesStatsCards = ({ pendentes, aprovadas, rejeitadas, abaAtiva, onSelecionar }) => {
  const stats = [
    { valor: 'pendentes', label: 'Pendentes', count: pendentes, icon: Clock, cor: 'yellow' },
    { valor: 'aprovadas', label: 'Aprovadas', count: aprovadas, icon: CheckCircle, cor: 'green' },
    { valor: 'rejeitadas', label: 'Rejeitadas', count: rejeitadas, icon: XCircle, cor: 'red' },
  ];

  // Classes escritas por extenso porque o Tailwind so enxerga nomes completos
  // no codigo -- `bg-${cor}-500/20` seria descartado na hora de gerar o CSS.
  const estilos = {
    yellow: { fundo: 'bg-yellow-500/20', icone: 'text-yellow-400', borda: 'border-yellow-500/60', brilho: 'shadow-yellow-900/20' },
    green:  { fundo: 'bg-green-500/20',  icone: 'text-green-400',  borda: 'border-green-500/60',  brilho: 'shadow-green-900/20' },
    red:    { fundo: 'bg-red-500/20',    icone: 'text-red-400',    borda: 'border-red-500/60',    brilho: 'shadow-red-900/20' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const e = estilos[stat.cor];
        const clicavel = typeof onSelecionar === 'function';
        const ativo = clicavel && abaAtiva === stat.valor;

        return (
          <Card
            key={stat.label}
            onClick={clicavel ? () => onSelecionar(stat.valor) : undefined}
            role={clicavel ? 'button' : undefined}
            tabIndex={clicavel ? 0 : undefined}
            aria-pressed={clicavel ? ativo : undefined}
            onKeyDown={clicavel ? (ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelecionar(stat.valor); }
            } : undefined}
            className={`glass-effect transition-all duration-200 ${
              ativo ? `${e.borda} shadow-lg ${e.brilho}` : 'border-white/20'
            } ${clicavel ? 'cursor-pointer hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40' : ''}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className={`p-3 ${e.fundo} rounded-full`}>
                  <Icon className={`w-6 h-6 ${e.icone}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.count}</p>
                  <p className="text-blue-200">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AprovacoesStatsCards;
