import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const IgrejaProtectedRoute = ({ children }) => {
  const { igrejaUser, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black text-white">Carregando...</div>;
  }

  if (!igrejaUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default IgrejaProtectedRoute;