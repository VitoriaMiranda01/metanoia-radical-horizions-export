import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Quatro quadros (Patrick, 07/10/2026):
//  - Equipantes inscritos: aprovados + pendentes + rejeitados -- o mesmo
//    universo da lista de equipantes, para os numeros baterem. Clicar abre a
//    lista de equipantes em "Todos".
//  - Equipantes confirmados: os que a chamada da reuniao de escala confirmou.
//    Clicar abre a lista de equipantes em "Presença confirmada".
//  - Acampantes. Clicar abre a aba de acampantes.
//  - Total da edicao: acampantes + equipantes confirmados. So visual (a lista
//    fica na aba "Total da edição").
// A descricao de cada quadro aparece ao parar o mouse (data-dica, DicasMouse).
// confirmados = null quando a contagem nao veio (aparece "—").
const InscricoesStatsCards = ({ equipantesInscritos, equipantesConfirmados, acampantes, onAbrir }) => {
  const semConfirmados = equipantesConfirmados === null || equipantesConfirmados === undefined;
  const stats = [
    {
      chave: 'inscritos', label: 'Equipantes inscritos', count: equipantesInscritos, icon: UserCheck, color: 'blue',
      dica: 'Todas as inscrições de equipante desta edição: aprovadas, pendentes e rejeitadas. Clique para ver a lista.'
    },
    {
      chave: 'confirmados', label: 'Equipantes confirmados', count: semConfirmados ? '—' : equipantesConfirmados,
      icon: ClipboardCheck, color: 'amber',
      dica: 'Equipantes confirmados na chamada da reunião de escala (presentes, ou mantidos na área pela organização). Fica em 0 até a chamada acontecer. Clique para ver a lista.'
    },
    {
      chave: 'acampantes', label: 'Acampantes', count: acampantes, icon: UserCheck, color: 'purple',
      dica: 'Acampantes inscritos nesta edição. Clique para ver a lista.'
    },
    {
      chave: null, label: 'Total da edição', count: acampantes + (semConfirmados ? 0 : equipantesConfirmados),
      icon: Users, color: 'green',
      dica: 'Acampantes + equipantes confirmados. A lista completa fica na aba "Total da edição".'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const clicavel = Boolean(stat.chave && onAbrir);
        return (
          <Card
            key={stat.label}
            data-dica={stat.dica}
            role={clicavel ? 'button' : undefined}
            tabIndex={clicavel ? 0 : undefined}
            onClick={clicavel ? () => onAbrir(stat.chave) : undefined}
            onKeyDown={clicavel ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(stat.chave); }
            } : undefined}
            className={cn(
              'glass-effect border-white/20',
              clicavel && 'cursor-pointer transition-colors hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className={`p-3 bg-${stat.color}-500/20 rounded-full`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-400`} />
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

export default InscricoesStatsCards;
