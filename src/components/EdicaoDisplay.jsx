import React, { useState, useEffect } from 'react';
import { useEdicaoAtual } from '@/hooks/useEdicaoAtual';
import { fetchConfiguracoes } from '@/lib/organizerHelpers';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const EdicaoDisplay = ({ size = 'medium', showFullText = true, className = '' }) => {
  // 1. All hooks at the very top (Rule of Hooks)
  const { edicaoAtual, loading: edicaoLoading } = useEdicaoAtual();
  const [dateConfig, setDateConfig] = useState(null);
  const [loadingDates, setLoadingDates] = useState(true);
  
  // Call useAuth unconditionally at the top
  const authContext = useAuth() || {};
  const { organizadorId, organizadorUser, user } = authContext;
  const targetId = organizadorId || organizadorUser?.id || user?.id;

  // 2. useEffect after other hooks, unconditionally
  useEffect(() => {
    let isMounted = true;

    const loadDates = async () => {
      setLoadingDates(true);
      try {
        const config = await fetchConfiguracoes(targetId);
        
        if (isMounted) {
          setDateConfig({
            data_edicao_dia_inicio: config?.data_edicao_dia_inicio,
            data_edicao_dia_fim: config?.data_edicao_dia_fim,
            data_edicao_mes: config?.data_edicao_mes,
            data_edicao_ano: config?.data_edicao_ano,
          });
        }
      } catch (error) {
        console.error("Error loading edition dates in EdicaoDisplay:", error);
      } finally {
        if (isMounted) {
          setLoadingDates(false);
        }
      }
    };
    
    loadDates();

    // Subscribe to realtime changes on the organizadores table
    const sub = supabase
      .channel('organizadores_dates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'organizadores' }, payload => {
        if (isMounted && payload.new) {
          setDateConfig(prev => ({
            ...prev,
            data_edicao_dia_inicio: payload.new.data_edicao_dia_inicio,
            data_edicao_dia_fim: payload.new.data_edicao_dia_fim,
            data_edicao_mes: payload.new.data_edicao_mes,
            data_edicao_ano: payload.new.data_edicao_ano,
          }));
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(sub);
    };
  }, [targetId]);

  // 3. Conditional logic placed AFTER all hooks
  const loading = edicaoLoading || loadingDates;

  const getSizeClasses = () => {
    switch (size) {
      case 'small': return 'text-sm';
      case 'large': return 'text-2xl md:text-3xl font-bold';
      case 'medium': 
      default: return 'text-base font-medium';
    }
  };

  if (loading) {
    return (
      <span className={`inline-flex items-center ${getSizeClasses()} ${className}`}>
        ??ª Edição <Loader2 className="w-4 h-4 animate-spin ml-2 text-white/50" />
      </span>
    );
  }

  let text = '';
  
  if (dateConfig?.data_edicao_dia_inicio && dateConfig?.data_edicao_dia_fim && dateConfig?.data_edicao_mes && dateConfig?.data_edicao_ano) {
    // If all date fields exist, use the formatted date string instead
    text = `${dateConfig.data_edicao_dia_inicio} a ${dateConfig.data_edicao_dia_fim} de ${dateConfig.data_edicao_mes} de ${dateConfig.data_edicao_ano}`;
  } else {
    // Fallback to edition number if dates are incomplete
    const editionNumber = edicaoAtual || '??';
    text = showFullText 
      ? `${editionNumber}ª Edição Metanoia Radical Serra`
      : `${editionNumber}ª Edição`;
  }

  return (
    <span className={`inline-flex items-center ${getSizeClasses()} ${className}`}>
      {text}
    </span>
  );
};

export default EdicaoDisplay;