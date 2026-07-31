import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, User, UserCheck } from 'lucide-react';
import { getGroupColor, getGroupStats, GROUPS } from '@/lib/gruposTrailhaHelpers';
import { motion } from 'framer-motion';

const GroupCard = ({ name, data, onClick }) => {
  const stats = getGroupStats(data);
  const colors = getGroupColor(name);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={`cursor-pointer overflow-hidden backdrop-blur-sm transition-all duration-300 ${colors.bg} border ${colors.border} ${colors.hoverBorder}`}
        onClick={() => onClick(name, data)}
      >
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className={`text-xl font-bold ${colors.text} tracking-tight`}>{name}</h3>
            <div className={`p-2 rounded-full bg-black/20 ${colors.text}`}>
              <Users className="w-5 h-5" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Total
              </span>
              <span className="text-white font-bold text-lg">{stats.total}</span>
            </div>
            
            <div className="h-px bg-black/10 w-full" />
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex flex-col">
                <span className="text-blue-300 text-xs uppercase font-semibold">Homens</span>
                <span className="text-white font-bold">{stats.homens}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-pink-300 text-xs uppercase font-semibold">Mulheres</span>
                <span className="text-white font-bold">{stats.mulheres}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const GruposTrailhaCards = ({ groupsData, onGroupClick }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="h-px bg-white/10 flex-1" />
        <span className="text-gray-400 font-medium text-sm uppercase tracking-wider">Grupos de Trilha</span>
        <div className="h-px bg-white/10 flex-1" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {GROUPS.map((groupName) => (
          <GroupCard 
            key={groupName} 
            name={groupName} 
            data={groupsData[groupName] || []} 
            onClick={onGroupClick} 
          />
        ))}
      </div>
    </div>
  );
};

export default GruposTrailhaCards;