import { useEffect } from 'react';
import { useEdicaoAtual } from './useEdicaoAtual';

/**
 * Hook to listen for edition changes.
 * When edition changes, it clears relevant localStorage keys and triggers a callback.
 */
export const useEdicaoListener = (onEditionChange) => {
  const { edicaoAtual, loading } = useEdicaoAtual();

  useEffect(() => {
    if (loading || !edicaoAtual) return;

    const storedEdition = localStorage.getItem('last_seen_edition');

    if (storedEdition && parseInt(storedEdition) !== edicaoAtual) {
      // Edition changed
      localStorage.removeItem('equipante_cpf_verified');
      localStorage.removeItem('acampante_cpf_verified');
      localStorage.removeItem('temp_inscricao_id');
      
      if (onEditionChange) {
        onEditionChange(edicaoAtual);
      }
    }

    // Update stored edition
    localStorage.setItem('last_seen_edition', edicaoAtual);
  }, [edicaoAtual, loading, onEditionChange]);

  return { edicaoAtual, loading };
};