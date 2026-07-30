import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export const useOrganizerAuth = () => {
  const { user, isAuthenticated } = useAuth();
  
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isParceiro, setIsParceiro] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkUserRole = async () => {
      // 1. Check basic authentication from context
      if (!isAuthenticated || !user) {
        setIsOrganizer(false);
        setIsParceiro(false);
        setVerifiedRole(null);
        setLoading(false);
        return;
      }

      // 2. Optimistic check: if context already has role
      if (user.role) {
         setIsOrganizer(user.role === 'organizador' || user.role === 'organizador-aprovador');
         setIsParceiro(user.role === 'parceiro');
         setVerifiedRole(user.role);
      }

      // 3. Organizer sessions come from organizadores_auth which has no email column.
      //    Trust the context role directly — no DB verification needed for organizers.
      if (user.role === 'organizador' || user.role === 'organizador-aprovador') {
        setIsOrganizer(true);
        setIsParceiro(false);
        setVerifiedRole(user.role);
        setLoading(false);
        return;
      }

      try {
        // 4. Verify against Supabase 'users' table for non-organizer roles (e.g. parceiro)
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('email', user.email)
          .single();

        if (error) {
          // Fallback to Context Role if DB check fails
          console.warn("User verified in AuthContext but failed Supabase role check", error);
          // Maintain optimistic values from context
        } else {
          const dbRole = data?.role;
          setVerifiedRole(dbRole);
          setIsOrganizer(dbRole === 'organizador' || dbRole === 'organizador-aprovador');
          setIsParceiro(dbRole === 'parceiro');
        }

      } catch (err) {
        console.error("Auth role check failed:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, [user, isAuthenticated]);

  return { 
    isOrganizerLoading: loading, 
    isOrganizer, 
    isParceiro,
    verifiedRole,
    error 
  };
};