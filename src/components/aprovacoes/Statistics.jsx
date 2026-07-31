import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

const Statistics = ({ pendentes, aprovadas, rejeitadas }) => {
  const stats = [
    { label: 'Pendentes', count: pendentes, icon: Clock, color: 'yellow' },
    { label: 'Aprovadas', count: aprovadas, icon: CheckCircle, color: 'green' },
    { label: 'Rejeitadas', count: rejeitadas, icon: XCircle, color: 'red' },
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

export default Statistics;