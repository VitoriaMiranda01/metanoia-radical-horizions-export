import { useState, useEffect } from 'react';
import { fetchInscricoesStatus } from '@/services/inscricoesStatusService';

const TUDO_ABERTO = {
  equipantesAbertos: true,
  acampantesAbertos: true,
  equipantesLigados: true,
  acampantesLigados: true,
  loteEquipanteHoje: true,
  loteAcampanteHoje: true
};

export const useInscricoesStatus = () => {
  // *Abertos = o que o publico enxerga: chave ligada E lote de preco hoje
  // (20261104e). *Ligados = so a chave, para a tela de Configuracoes.
  const [status, setStatus] = useState(TUDO_ABERTO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkStatus = async (retryCount = 0) => {
    setLoading(true);
    try {
      const data = await fetchInscricoesStatus();
      if (data) {
        const eqLigado = data.inscricoes_equipantes ?? true;
        const acLigado = data.inscricoes_acampantes ?? true;
        const eqLote = data.lote_equipante_hoje !== false;
        const acLote = data.lote_acampante_hoje !== false;
        setStatus({
          equipantesAbertos: eqLigado && eqLote,
          acampantesAbertos: acLigado && acLote,
          equipantesLigados: eqLigado,
          acampantesLigados: acLigado,
          loteEquipanteHoje: eqLote,
          loteAcampanteHoje: acLote
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
      setStatus(TUDO_ABERTO);
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