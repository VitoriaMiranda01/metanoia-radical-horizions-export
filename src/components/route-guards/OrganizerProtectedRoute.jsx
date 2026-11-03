import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissoes } from '@/hooks/usePermissoes';
import { PERMISSOES_DA_ESCALA } from '@/services/permissoesService';
import { Loader2 } from 'lucide-react';

// Telas do organizador na ordem em que a pessoa cai quando abre uma que nao
// pode (03/11/2026). Configuracoes fica por ultimo e sempre abre: para quem
// nao e Desenvolvedores ela mostra so "Trocar minha senha".
export const TELAS_DO_ORGANIZADOR = [
  { rota: '/gerenciar', permissao: 'gerenciar_inscricoes' },
  { rota: '/aprovacoes', permissao: 'aprovacao_equipe' },
  { rota: '/organizer/escalas', permissao: PERMISSOES_DA_ESCALA },
  { rota: '/pagamentos-pendentes', permissao: 'pagamentos' },
  { rota: '/organizer/configuracoes', permissao: null },
];

// permissao: chave, lista (basta uma) ou 'maximo' (so Desenvolvedores).
export const temPermissao = (perm, permissao) => {
  if (!permissao) return true;
  if (permissao === 'maximo') return perm.maximo;
  return Array.isArray(permissao) ? perm.podeAlgum(permissao) : perm.pode(permissao);
};

const Carregando = ({ texto }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    <p>{texto}</p>
  </div>
);

const OrganizerProtectedRoute = ({ children, permissao = null }) => {
  const { organizadorUser, user, loading } = useAuth();
  const perm = usePermissoes();

  if (loading) return <Carregando texto="Verificando acesso organizador..." />;

  const isAuthorized = !!organizadorUser || ['organizador', 'organizador-aprovador'].includes(user?.role);

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  if (permissao) {
    if (perm.carregando) return <Carregando texto="Verificando permissões..." />;
    if (!temPermissao(perm, permissao)) {
      const destino = TELAS_DO_ORGANIZADOR.find((t) => temPermissao(perm, t.permissao));
      return <Navigate to={destino?.rota || '/organizer/configuracoes'} replace />;
    }
  }

  return children;
};

export default OrganizerProtectedRoute;
