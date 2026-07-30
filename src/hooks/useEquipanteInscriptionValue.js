import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook to fetch and calculate the current equipante inscription value
 * based on date-range pricing periods stored in the database
 * 
 * @returns {Object} { value: number, loading: boolean, error: string|null }
 */
export const useEquipanteInscriptionValue = () => {
  const [value, setValue] = useState(200.00); // Default fallback
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPricingConfiguration = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('configuracoes')
          .select('equipante_pricing_periods')
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error('[useEquipanteInscriptionValue] Database query error:', fetchError);
          setError(fetchError.message);
          setValue(200.00); // Fallback to default
          return;
        }

        if (!data || !data.equipante_pricing_periods) {
          console.warn('[useEquipanteInscriptionValue] No pricing configuration found, using default value');
          setValue(200.00);
          return;
        }

        const pricingPeriods = data.equipante_pricing_periods;

        if (!Array.isArray(pricingPeriods) || pricingPeriods.length === 0) {
          console.warn('[useEquipanteInscriptionValue] Invalid pricing periods format, using default value');
          setValue(200.00);
          return;
        }

        // Parses DD/MM/YYYY or YYYY-MM-DD or MM/DD/YYYY into a Date object
        const parsePeriodDate = (str) => {
          if (!str) return null;
          const parts = str.split('/');
          if (parts.length === 3) {
            // DD/MM/YYYY (Brazilian format used by PricingPeriodsManager)
            const [d, m, y] = parts;
            return new Date(Number(y), Number(m) - 1, Number(d));
          }
          // Fallback: let the browser parse it (ISO format, etc.)
          const d = new Date(str);
          return isNaN(d.getTime()) ? null : d;
        };

        // Get current date (normalized to midnight for consistent comparison)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentTimestamp = today.getTime();

        // Find the active pricing period
        let activePeriod = null;

        for (const period of pricingPeriods) {
          // Support both snake_case (start_date/end_date) and camelCase (startDate/endDate)
          const startDateRaw = period.start_date || period.startDate;
          const endDateRaw = period.end_date || period.endDate;

          if (!startDateRaw || !endDateRaw || period.value === undefined) {
            console.warn('[useEquipanteInscriptionValue] Skipping invalid period:', period);
            continue;
          }

          const startDate = parsePeriodDate(startDateRaw);
          const endDate = parsePeriodDate(endDateRaw);

          if (!startDate || !endDate) {
            console.warn('[useEquipanteInscriptionValue] Could not parse dates for period:', period);
            continue;
          }

          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999); // Include entire end date

          const startTimestamp = startDate.getTime();
          const endTimestamp = endDate.getTime();

          if (currentTimestamp >= startTimestamp && currentTimestamp <= endTimestamp) {
            activePeriod = period;
            break;
          }
        }

        if (activePeriod) {
          const periodValue = parseFloat(activePeriod.value);
          if (isNaN(periodValue) || periodValue < 0) {
            console.warn('[useEquipanteInscriptionValue] Invalid value in active period, using default');
            setValue(200.00);
          } else {
            console.log('[useEquipanteInscriptionValue] Active period found:', activePeriod);
            setValue(periodValue);
          }
        } else {
          console.warn('[useEquipanteInscriptionValue] No active period found for current date, using default value');
          setValue(200.00);
        }

      } catch (err) {
        console.error('[useEquipanteInscriptionValue] Unexpected error:', err);
        setError(err.message);
        setValue(200.00); // Fallback to default
      } finally {
        setLoading(false);
      }
    };

    fetchPricingConfiguration();
  }, []);

  return { value, loading, error };
};