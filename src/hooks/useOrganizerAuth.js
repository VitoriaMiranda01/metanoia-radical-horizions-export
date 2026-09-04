import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const useOrganizerAuth = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isParceiro, setIsParceiro] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Wait for the primary auth context to finish loading before checking roles
    if (authLoading) return;

    let mounted = true;

    const checkUserRole = async () => {
      if (!isAuthenticated || !user) {
        if (mounted) {
          setIsOrganizer(false);
          setIsParceiro(false);
          setVerifiedRole(null);
          setLoading(false);
        }
        return;
      }

      // user.role já vem pronto do login (organizador/parceiro, ver
      // AuthContext.jsx) -- não há mais busca de role no banco (tabela
      // "users", removida em 2026-09-04): era usada só pelo login nativo do
      // Supabase Auth (e-mail/senha), recurso de login de acampante/
      // equipante que não existe mais na interface.
      if (mounted) {
        setIsOrganizer(user.role === 'organizador' || user.role === 'organizador-aprovador');
        setIsParceiro(user.role === 'parceiro');
        setVerifiedRole(user.role || null);
        setLoading(false);
      }
    };

    checkUserRole();

    return () => { mounted = false; };
  }, [user, isAuthenticated, authLoading]);

  return { 
    isOrganizerLoading: loading || authLoading, 
    isOrganizer, 
    isParceiro,
    verifiedRole,
    error 
  };
};