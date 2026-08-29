import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const OrganizerProtectedRoute = ({ children }) => {
  const { organizadorUser, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p>Verificando acesso organizador...</p>
      </div>
    );
  }

  const isAuthorized = !!organizadorUser || ['organizador', 'organizador-aprovador'].includes(user?.role);

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default OrganizerProtectedRoute;