import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Tela de cada area de apoio. Conta antiga sem area = saude.
export const rotaDoApoio = (apoio) => (apoio?.area === 'portaria' ? '/portaria' : '/saude');

/**
 * Telas de apoio: /saude (lider da saude) e /portaria (24/10/2026). Entra o
 * login de apoio DA AREA -- quem e de outra area vai para a propria tela -- e
 * o organizador tambem, para conferir o que eles veem. O banco confere de
 * novo (saude_acampantes, portaria_lista...): esconder a rota e so conforto.
 */
const ApoioProtectedRoute = ({ children, area = 'saude' }) => {
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

  const apoio = apoioUser || (user?.role === 'apoio' ? user : null);
  if (apoio && (apoio.area || 'saude') !== area) {
    return <Navigate to={rotaDoApoio(apoio)} replace />;
  }

  return children;
};

export default ApoioProtectedRoute;
