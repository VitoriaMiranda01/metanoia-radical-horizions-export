import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const IgrejaProtectedRoute = ({ children }) => {
  const { igrejaUser, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p>Verificando autorização...</p>
      </div>
    );
  }

  // Allow either explicit igrejaUser login or standard user with parceiro role
  const isAuthorized = !!igrejaUser || user?.role === 'parceiro';

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default IgrejaProtectedRoute;