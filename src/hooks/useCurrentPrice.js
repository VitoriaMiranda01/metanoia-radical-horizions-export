import { useState, useEffect } from 'react';
import { fetchPricingConfig } from '@/services/organizerConfigService';
import { configPublicaSalva } from '@/services/publicDataService';

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

const calcularPreco = (data, tipo) => {
  // Determine base value based on type
  const baseValue = tipo === 'equipante' ? data.valor_equipante : data.valor_acampante;
  
  // Determine periods based on type
  const periods = tipo === 'equipante' ? data.equipante_pricing_periods : data.acampante_pricing_periods;

  let finalPrice = baseValue;

  // Check if there are active periods that override the base value
  if (periods && periods.length > 0) {
    const now = new Date();
    
    const activePeriod = periods.find(p => {
      const start = parseDate(p.start_date);
      const end = parseDate(p.end_date);
      if (!start || !end) return false;
      
      // start at beginning of day
      start.setHours(0, 0, 0, 0);
      // end at end of day
      end.setHours(23, 59, 59, 999);

      return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
    });

    if (activePeriod && activePeriod.value !== undefined && activePeriod.value !== null) {
      finalPrice = activePeriod.value;
    }
  }

  return finalPrice;
};

// Valor mostrado na hora com a ultima resposta guardada no aparelho (ver
// publicDataService.js); o servidor confirma logo depois.
const precoInicial = (tipo) => {
  const salva = configPublicaSalva();
  if (!salva) return null;
  return calcularPreco({
    acampante_pricing_periods: salva.acampante_pricing_periods || [],
    equipante_pricing_periods: salva.equipante_pricing_periods || []
  }, tipo);
};

// usarSalvo: so a pagina inicial pede (mostra o ultimo valor na hora). Os
// formularios esperam o servidor, porque ali o valor vira cobranca.
export function useCurrentPrice(tipo = 'acampante', edicao_numero = null, usarSalvo = false) {
  const [currentPrice, setCurrentPrice] = useState(() => (usarSalvo ? precoInicial(tipo) : null));
  const [loading, setLoading] = useState(() => !(usarSalvo && currentPrice !== null));
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchConfig = async () => {
      try {
        if (!usarSalvo) setLoading(true);
        const { data, error: err } = await fetchPricingConfig(edicao_numero);

        if (err) throw err;

        if (mounted && data) {
          const finalPrice = calcularPreco(data, tipo);

          setCurrentPrice(finalPrice);
        } else if (mounted) {
          // Default values if no config found
          setCurrentPrice(tipo === 'equipante' ? 0 : 0);
        }
      } catch (e) {
        console.error('Error fetching pricing:', e);
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchConfig();

    // Set up an interval to re-check the price in case a period changes while user is on page
    // So com a aba visivel (25/10/2026): formulario esquecido aberto nao
    // fica consultando o banco.
    const intervalId = setInterval(() => { if (!document.hidden) fetchConfig(); }, 60000); // Check every minute

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [tipo, edicao_numero]);

  return { currentPrice, loading, error };
}