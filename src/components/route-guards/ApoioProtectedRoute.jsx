import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Tela da lider da saude (/saude). Entra o login de apoio -- e o organizador
 * tambem, para conferir o que ela ve. O banco confere de novo
 * (saude_acampantes): esconder a rota e so conforto.
 */
const ApoioProtectedRoute = ({ children }) => {
  const { apoioUser, organizadorUser, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p>Verificando acesso...</p>
      </div>
    );
  }

  const isAuthorized = !!apoioUser || !!organizadorUser
    || ['apoio', 'organizador', 'organizador-aprovador'].includes(user?.role);

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ApoioProtectedRoute;
