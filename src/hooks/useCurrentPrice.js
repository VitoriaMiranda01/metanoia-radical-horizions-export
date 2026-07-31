import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

export function useCurrentPrice() {
  const [periods, setPeriods] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch from DB
  useEffect(() => {
    let mounted = true;
    
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from('configuracoes')
          .select('acampante_pricing_periods')
          .limit(1)
          .maybeSingle();

        if (err) throw err;

        if (mounted && data?.acampante_pricing_periods) {
          setPeriods(data.acampante_pricing_periods);
        }
      } catch (e) {
        console.error('Error fetching pricing:', e);
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchConfig();

    return () => {
      mounted = false;
    };
  }, []);

  // Calculate current price based on periods and date
  useEffect(() => {
    const calculatePrice = () => {
      if (!periods || periods.length === 0) {
        setCurrentPrice(null);
        return;
      }

      const now = new Date();
      
      const active = periods.find(p => {
        const start = parseDate(p.start_date);
        const end = parseDate(p.end_date);
        if (!start || !end) return false;
        
        // start at beginning of day
        start.setHours(0, 0, 0, 0);
        // end at end of day
        end.setHours(23, 59, 59, 999);

        return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
      });

      setCurrentPrice(active ? active.value : null);
    };

    calculatePrice();

    // Re-check periodically to handle date changes if user leaves page open
    const intervalId = setInterval(calculatePrice, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [periods]);

  return { currentPrice, loading, error };
}