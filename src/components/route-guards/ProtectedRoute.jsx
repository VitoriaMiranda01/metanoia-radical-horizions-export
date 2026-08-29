import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
        <p>Carregando perfil...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const hasRequiredRole = Array.isArray(requiredRole) 
      ? requiredRole.includes(user.role)
      : user.role === requiredRole;

    if (!hasRequiredRole) {
      if (user.role === 'organizador') return <Navigate to="/gerenciar" replace />;
      if (user.role === 'organizador-aprovador') return <Navigate to="/aprovacoes" replace />;
      if (user.role === 'acampante') return <Navigate to="/acampante" replace />;
      if (user.role === 'equipante') return <Navigate to="/equipante" replace />;
      
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;