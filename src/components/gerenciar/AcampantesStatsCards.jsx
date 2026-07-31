import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, HeartPulse, Pill, Shirt } from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ title, count, icon: Icon, color, onClick, loading }) => (
  <motion.div whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}>
    <Card 
      className={`cursor-pointer overflow-hidden backdrop-blur-sm border-l-4 ${color.border} bg-white/5 border-y-white/5 border-r-white/5 hover:bg-white/10 transition-all ${loading ? 'opacity-70 pointer-events-none' : ''}`}
      onClick={!loading ? onClick : undefined}
    >
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-white/10 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold text-white mt-1">{count}</p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color.bg} ${color.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const ShirtCard = ({ size, count, onClick, loading }) => (
  <motion.div whileHover={!loading ? { scale: 1.05 } : {}} whileTap={!loading ? { scale: 0.95 } : {}}>
    <div 
      className={`cursor-pointer bg-white/5 border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors h-full flex flex-col justify-center items-center ${loading ? 'opacity-70 pointer-events-none' : ''}`}
      onClick={!loading ? onClick : undefined}
    >
      <div className="flex justify-center mb-1 text-purple-400 opacity-80">
        <Shirt className="w-4 h-4" />
      </div>
      <div className="text-lg font-bold text-white">{size}</div>
      {loading ? (
         <div className="h-4 w-8 bg-white/10 animate-pulse rounded mt-1 mx-auto" />
      ) : (
         <div className="text-xs text-gray-400">{count}</div>
      )}
    </div>
  </motion.div>
);

const AcampantesStatsCards = ({ acampantes = [], onCardClick, loading = false }) => {
  const stats = useMemo(() => {
    // Helper to normalize strings for comparison
    const normalize = (str) => str?.toLowerCase().trim() || '';
    const hasValue = (str) => str && str.trim().length > 0 && normalize(str) !== 'não' && normalize(str) !== 'nao';

    const homens = acampantes.filter(a => normalize(a.genero) === 'masculino');
    const mulheres = acampantes.filter(a => normalize(a.genero) === 'feminino');
    
    // Check specific health fields - using both boolean flags and text fields for robustness
    const problemasSaude = acampantes.filter(a => a.tem_problema_saude === true || hasValue(a.condicoes_medicas));
    const medicamentos = acampantes.filter(a => a.usa_medicamento === true || hasValue(a.medicamentos));

    const sizes = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
    const shirts = sizes.map(size => ({
      size,
      // Fixed: Use 'tamanho_camisa' which matches the Supabase DB column (snake_case)
      // instead of 'tamanho_camiseta' which was undefined
      list: acampantes.filter(a => normalize(a.tamanho_camisa) === normalize(size))
    }));

    return { homens, mulheres, problemasSaude, medicamentos, shirts };
  }, [acampantes]);

  return (
    <div className="space-y-6">
       <div className="flex items-center space-x-4">
        <div className="h-px bg-white/10 flex-1" />
        <span className="text-gray-400 font-medium text-sm uppercase tracking-wider">Métricas da Edição</span>
        <div className="h-px bg-white/10 flex-1" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Homens" 
          count={stats.homens.length} 
          icon={Users} 
          loading={loading}
          color={{ border: 'border-l-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400' }}
          onClick={() => onCardClick('Homens', stats.homens)}
        />
        <StatCard 
          title="Mulheres" 
          count={stats.mulheres.length} 
          icon={Users} 
          loading={loading}
          color={{ border: 'border-l-pink-500', bg: 'bg-pink-500/20', text: 'text-pink-400' }}
          onClick={() => onCardClick('Mulheres', stats.mulheres)}
        />
        <StatCard 
          title="Problemas de Saúde" 
          count={stats.problemasSaude.length} 
          icon={HeartPulse} 
          loading={loading}
          color={{ border: 'border-l-red-500', bg: 'bg-red-500/20', text: 'text-red-400' }}
          onClick={() => onCardClick('Problemas de Saúde', stats.problemasSaude)}
        />
        <StatCard 
          title="Uso de Medicamentos" 
          count={stats.medicamentos.length} 
          icon={Pill} 
          loading={loading}
          color={{ border: 'border-l-amber-500', bg: 'bg-amber-500/20', text: 'text-amber-400' }}
          onClick={() => onCardClick('Uso de Medicamentos', stats.medicamentos)}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {stats.shirts.map(({ size, list }) => (
          <ShirtCard 
            key={size} 
            size={size} 
            count={list.length} 
            loading={loading}
            onClick={() => onCardClick(`Camiseta ${size}`, list)}
          />
        ))}
      </div>
    </div>
  );
};

export default AcampantesStatsCards;