import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserRole } from '@/services/authService';

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

      if (user.role) {
         if (mounted) {
           setIsOrganizer(user.role === 'organizador' || user.role === 'organizador-aprovador');
           setIsParceiro(user.role === 'parceiro');
           setVerifiedRole(user.role);
         }
      }

      if (user.role === 'organizador' || user.role === 'organizador-aprovador') {
        if (mounted) {
          setIsOrganizer(true);
          setIsParceiro(false);
          setVerifiedRole(user.role);
          setLoading(false);
        }
        return;
      }

      // Check DB if email is available and it's not a pre-configured role
      if (user.email) {
        try {
          const { data, error } = await fetchUserRole(user.email);

          if (error) throw error;
          
          if (mounted && data) {
            const dbRole = data.role;
            setVerifiedRole(dbRole);
            setIsOrganizer(dbRole === 'organizador' || dbRole === 'organizador-aprovador');
            setIsParceiro(dbRole === 'parceiro');
          }
        } catch (err) {
          console.error('useOrganizerAuth - checkUserRole', err, { email: user.email });
          if (mounted) setError(err);
        }
      }

      if (mounted) setLoading(false);
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