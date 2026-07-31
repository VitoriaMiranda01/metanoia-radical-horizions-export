import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { fetchRelatoriosRapidos } from '@/lib/organizerHelpers';
import { motion } from 'framer-motion';

const MetricCard = ({ title, total, confirmed, loading }) => (
  <Card className="bg-white/10 border-white/10 overflow-hidden relative group hover:bg-white/15 transition-all duration-300">
    <CardContent className="p-6">
      <div className="flex flex-col space-y-2">
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        {loading ? (
          <div className="h-10 w-24 bg-white/5 animate-pulse rounded" />
        ) : (
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold text-white tracking-tight">{total}</span>
            <span className="text-sm text-gray-400 font-medium">/{confirmed} confirmados</span>
          </div>
        )}
      </div>
      {/* Decorative gradient blob */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:from-white/10 transition-colors" />
    </CardContent>
  </Card>
);

const ShirtCard = ({ size, count, loading }) => (
  <div className="bg-white/10 border border-white/10 rounded-xl p-4 flex flex-col items-start justify-between hover:bg-white/15 transition-colors min-h-[100px]">
    <span className="text-sm font-bold text-gray-400">{size}</span>
    {loading ? (
      <div className="h-8 w-12 bg-white/5 animate-pulse rounded mt-2" />
    ) : (
      <span className="text-3xl font-bold text-white mt-2">{count}</span>
    )}
  </div>
);

const RelatoriosRapidos = ({ edicaoId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const stats = await fetchRelatoriosRapidos(edicaoId);
      setData(stats);
    } catch (error) {
      console.error("Failed to load reports", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [edicaoId]);

  return (
    <div className="w-full space-y-8 my-8">
      {/* Level 1 Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Homens" 
          total={data?.homens.total || 0} 
          confirmed={data?.homens.confirmados || 0} 
          loading={loading}
        />
        <MetricCard 
          title="Mulheres" 
          total={data?.mulheres.total || 0} 
          confirmed={data?.mulheres.confirmados || 0} 
          loading={loading}
        />
        <MetricCard 
          title="Problemas de Saúde" 
          total={data?.saude.total || 0} 
          confirmed={data?.saude.confirmados || 0} 
          loading={loading}
        />
        <MetricCard 
          title="Uso de Medicamentos" 
          total={data?.medicamentos.total || 0} 
          confirmed={data?.medicamentos.confirmados || 0} 
          loading={loading}
        />
      </div>

      {/* Shirt Report - Removed specific sizes */}
      {/* This section is removed as per user request to filter out PP, P, M, G, GG, XG, XGG sizes.
          The AcampantesStatsCards component now handles detailed shirt size statistics. */}
      {/* 
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-gray-400 font-medium text-sm uppercase tracking-wider">Relatório de camisas</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'].map((size) => (
            <ShirtCard 
              key={size} 
              size={size} 
              count={data?.camisas[size] || 0} 
              loading={loading} 
            />
          ))}
        </div>
      </div> 
      */}
    </div>
  );
};

export default RelatoriosRapidos;