import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, ClipboardCheck } from 'lucide-react';

// Quatro quadros (Patrick, 07/10/2026):
//  - Equipantes inscritos: aprovados + pendentes + rejeitados -- o mesmo
//    universo da lista de equipantes logo abaixo, para os numeros baterem.
//  - Equipantes confirmados: os que a chamada da reuniao de escala confirmou.
//  - Acampantes.
//  - Total da edicao: acampantes + equipantes confirmados.
// confirmados = null quando a contagem nao veio (aparece "—").
const InscricoesStatsCards = ({ equipantesInscritos, equipantesConfirmados, acampantes }) => {
  const semConfirmados = equipantesConfirmados === null || equipantesConfirmados === undefined;
  const stats = [
    {
      label: 'Equipantes inscritos', count: equipantesInscritos, icon: UserCheck, color: 'blue',
      dica: 'Todas as inscrições de equipante desta edição: aprovadas, pendentes e rejeitadas.'
    },
    {
      label: 'Equipantes confirmados', count: semConfirmados ? '—' : equipantesConfirmados, icon: ClipboardCheck, color: 'amber',
      dica: 'Equipantes confirmados na chamada da reunião de escala (presentes, ou mantidos na área pela organização). Fica em 0 até a chamada acontecer.'
    },
    {
      label: 'Acampantes', count: acampantes, icon: UserCheck, color: 'purple',
      dica: 'Acampantes inscritos nesta edição.'
    },
    {
      label: 'Total da edição', count: acampantes + (semConfirmados ? 0 : equipantesConfirmados), icon: Users, color: 'green',
      dica: 'Acampantes + equipantes confirmados.'
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="glass-effect border-white/20" data-dica={stat.dica}>
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
