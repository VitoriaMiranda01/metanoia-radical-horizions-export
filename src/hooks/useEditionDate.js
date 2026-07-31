import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useEditionDate = () => {
  const [dateInfo, setDateInfo] = useState({
    diaInicio: null,
    diaFim: null,
    mes: null,
    ano: null,
    formattedDate: "Data não configurada"
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const formatData = (data) => {
      if (data && data.data_edicao_dia_inicio && data.data_edicao_dia_fim && data.data_edicao_mes && data.data_edicao_ano) {
        return {
          diaInicio: data.data_edicao_dia_inicio,
          diaFim: data.data_edicao_dia_fim,
          mes: data.data_edicao_mes,
          ano: data.data_edicao_ano,
          formattedDate: `${data.data_edicao_dia_inicio} a ${data.data_edicao_dia_fim} de ${data.data_edicao_mes} de ${data.data_edicao_ano}`
        };
      }
      return {
        diaInicio: null, 
        diaFim: null, 
        mes: null, 
        ano: null,
        formattedDate: "Data não configurada"
      };
    };

    const fetchDate = async () => {
      try {
        setLoading(true);
        // Query directly from organizadores table as requested
        const { data, error: err } = await supabase
          .from('organizadores')
          .select('data_edicao_dia_inicio, data_edicao_dia_fim, data_edicao_mes, data_edicao_ano')
          .limit(1)
          .maybeSingle();

        if (err) throw err;

        if (isMounted) {
          setDateInfo(formatData(data));
          setError(null);
        }
      } catch (err) {
        if (isMounted) setError(err);
        console.error("Error fetching edition date from organizadores:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDate();

    // Set up real-time subscription for the organizadores table
    const channel = supabase.channel('organizadores-date-changes')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'organizadores' }, 
        (payload) => {
          if (payload.new) {
            setDateInfo(formatData(payload.new));
          } else {
            fetchDate();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { ...dateInfo, loading, error };
};