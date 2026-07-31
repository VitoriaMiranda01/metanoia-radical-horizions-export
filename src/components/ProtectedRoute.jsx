import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
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
      // Redireciona para a página principal baseada na role do usuário
      if (user.role === 'organizador') {
        return <Navigate to="/gerenciar" replace />;
      }
      if (user.role === 'organizador-aprovador') {
        return <Navigate to="/aprovacoes" replace />;
      }
      if (user.role === 'acampante') {
        return <Navigate to="/acampante" replace />;
      }
      if (user.role === 'equipante') {
        return <Navigate to="/equipante" replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;