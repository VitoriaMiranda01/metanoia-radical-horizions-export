import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Inscricao = () => {
  const { user } = useAuth();
  
  if (user?.role === 'acampante') return <Navigate to="/acampante" replace />;
  if (user?.role === 'equipante') return <Navigate to="/equipante" replace />;
  
  return <Navigate to="/login" replace />;
};

export default Inscricao;