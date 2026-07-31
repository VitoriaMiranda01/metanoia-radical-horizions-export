import { useState, useEffect } from 'react';
import { fetchInscricoesStatus } from '@/lib/organizerHelpers';

export const useInscricoesStatus = () => {
  const [status, setStatus] = useState({
    equipantesAbertos: true,
    acampantesAbertos: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkStatus = async (retryCount = 0) => {
    setLoading(true);
    try {
      const data = await fetchInscricoesStatus();
      if (data) {
        setStatus({
          equipantesAbertos: data.inscricoes_equipantes ?? true,
          acampantesAbertos: data.inscricoes_acampantes ?? true
        });
        setError(null);
      }
    } catch (err) {
      console.error(`Hook error fetching status (attempt ${retryCount + 1}):`, err);
      
      // Retry logic for network errors
      if (retryCount < 2) {
        setTimeout(() => {
          checkStatus(retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s
        return;
      }

      setError(err);
      // Fallback to open on error to prevent lockout
      setStatus({
        equipantesAbertos: true,
        acampantesAbertos: true
      });
    } finally {
      // Only set loading to false if we are not retrying
      if (retryCount >= 2 || !error) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return { 
    ...status, 
    loading, 
    error,
    refetch: () => checkStatus(0) 
  };
};