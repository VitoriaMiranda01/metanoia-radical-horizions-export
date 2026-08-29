import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck } from 'lucide-react';

const InscricoesStatsCards = ({ equipantes, acampantes, total }) => {
  const stats = [
    { label: 'Equipantes', count: equipantes, icon: UserCheck, color: 'blue' },
    { label: 'Acampantes', count: acampantes, icon: UserCheck, color: 'purple' },
    { label: 'Total de Inscrições', count: total, icon: Users, color: 'green' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="glass-effect border-white/20">
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