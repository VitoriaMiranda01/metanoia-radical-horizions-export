import { useState, useEffect, useCallback } from 'react';
import { fetchConfiguracoes } from '@/lib/organizerHelpers';

// Simple in-memory cache
const cache = {
  data: null,
  timestamp: null,
  TTL: 5 * 60 * 1000 // 5 minutes
};

export const useEdicaoAtual = () => {
  const [edicaoAtual, setEdicaoAtual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      
      if (!force && cache.data !== null && cache.timestamp && (now - cache.timestamp < cache.TTL)) {
        setEdicaoAtual(cache.data);
        setLoading(false);
        return;
      }

      const config = await fetchConfiguracoes();
      if (!config) throw new Error("Failed to load configuration");

      const edicao = config.edicao_numero || 0;
      
      cache.data = edicao;
      cache.timestamp = now;
      
      setEdicaoAtual(edicao);
    } catch (err) {
      console.error("Erro ao buscar edição atual:", err);
      setError(err);
      setEdicaoAtual(cache.data !== null ? cache.data : 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { edicaoAtual, loading, error, refetch: () => fetchData(true) };
};