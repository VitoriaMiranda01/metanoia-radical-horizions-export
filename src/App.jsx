import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import FaixaAmbienteTeste from '@/components/common/FaixaAmbienteTeste';
import DicasMouse from '@/components/common/DicasMouse';
import OrganizerProtectedRoute from '@/components/route-guards/OrganizerProtectedRoute';
import IgrejaProtectedRoute from '@/components/route-guards/IgrejaProtectedRoute';
import ApoioProtectedRoute from '@/components/route-guards/ApoioProtectedRoute';
import HomePage from '@/pages/HomePage';
import Layout from '@/components/Layout';

// Telas dos organizadores em arquivos separados (18/10/2026): o celular de
// quem so abre a Area do Equipante nao baixa a Geracao de Escalas, os
// Pagamentos etc. Se um arquivo antigo sumir depois de um deploy, recarrega a
// pagina uma vez (pega a versao nova).
const carregarPagina = (importar) => lazy(() => importar().then((m) => {
  try { sessionStorage.removeItem('recarregou-pagina'); } catch { /* sem storage */ }
  return m;
}).catch((erro) => {
  let jaRecarregou = false;
  try { jaRecarregou = sessionStorage.getItem('recarregou-pagina') === '1'; } catch { /* sem storage */ }
  if (!jaRecarregou) {
    try { sessionStorage.setItem('recarregou-pagina', '1'); } catch { /* sem storage */ }
    window.location.reload();
    return new Promise(() => {});
  }
  throw erro;
}));
// Páginas públicas também separadas (25/10/2026): quem abre só a página
// inicial não baixa os formulários, o PIX e o login.
const LoginPage = carregarPagina(() => import('@/pages/LoginPage'));
const AcampantePage = carregarPagina(() => import('@/pages/AcampantePage'));
const EquipantePage = carregarPagina(() => import('@/pages/EquipantePage'));
const PaymentMethodSelectionPage = carregarPagina(() => import('@/pages/PaymentMethodSelectionPage'));
const InscricaoPixPage = carregarPagina(() => import('@/pages/InscricaoPixPage'));
const ManualPaymentPage = carregarPagina(() => import('@/pages/ManualPaymentPage'));
const EquipanteWorkflowStatus = carregarPagina(() => import('@/components/equipante/EquipanteWorkflowStatus'));
const GerenciarInscricoesPage = carregarPagina(() => import('@/pages/GerenciarInscricoesPage'));
const AprovacoesPage = carregarPagina(() => import('@/pages/AprovacoesPage'));
const ParceirosPage = carregarPagina(() => import('@/pages/ParceirosPage'));
const OrganizerConfigPage = carregarPagina(() => import('@/pages/OrganizerConfigPage'));
const OrganizerScalesPage = carregarPagina(() => import('@/pages/OrganizerScalesPage'));
const AdminWorkflowsPage = carregarPagina(() => import('@/pages/AdminWorkflowsPage'));
const PagamentosPendentesPage = carregarPagina(() => import('@/pages/PagamentosPendentesPage'));
const SenhasParceirosPage = carregarPagina(() => import('@/pages/SenhasParceirosPage'));
const SaudePage = carregarPagina(() => import('@/pages/SaudePage'));
const PortariaPage = carregarPagina(() => import('@/pages/PortariaPage'));
const RecepcaoPage = carregarPagina(() => import('@/pages/RecepcaoPage'));

const Carregando = () => (
  <div className="min-h-screen flex items-center justify-center bg-black text-gray-400 text-sm">Carregando...</div>
);

function EquipanteWorkflowRoute() {
  const { equipante_id } = useParams();
  const navigate = useNavigate();
  return (
    <EquipanteWorkflowStatus
      equipanteId={equipante_id}
      onProceedToPayment={(dados) => navigate('/payment-method-selection', {
        state: { id: equipante_id, tipo: 'equipante', nome: dados?.nome, cpf: dados?.cpf }
      })}
    />
  );
}

function InscricaoRedirect() {
  // Login de acampante/equipante via e-mail nativo do Supabase Auth nao
  // existe mais na interface (ver limpeza em useOrganizerAuth.js /
  // authService.js, 2026-09-04) -- user.role nunca mais vale 'acampante'/
  // 'equipante', entao esta rota sempre cai no login mesmo.
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen">
          <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/acampante" element={<AcampantePage />} />
            <Route path="/equipante" element={<EquipantePage />} />
            <Route path="/payment-method-selection" element={<PaymentMethodSelectionPage />} />
            <Route path="/inscricao-pix" element={<InscricaoPixPage />} />
            <Route path="/inscricao-manual" element={<ManualPaymentPage />} />
            <Route path="/manual-payment" element={<ManualPaymentPage />} />

            <Route 
              path="/equipante-workflow/:equipante_id" 
              element={
                <OrganizerProtectedRoute>
                  <Layout>
                    <div className="max-w-4xl mx-auto py-8">
                      <EquipanteWorkflowRoute />
                    </div>
                  </Layout>
                </OrganizerProtectedRoute>
              } 
            />

            <Route 
              path="/admin/equipante-workflows" 
              element={
                <OrganizerProtectedRoute>
                  <AdminWorkflowsPage />
                </OrganizerProtectedRoute>
              } 
            />

            <Route 
              path="/gerenciar" 
              element={
                <OrganizerProtectedRoute>
                  <GerenciarInscricoesPage />
                </OrganizerProtectedRoute>
              } 
            />
            <Route 
              path="/aprovacoes" 
              element={
                <OrganizerProtectedRoute>
                  <AprovacoesPage />
                </OrganizerProtectedRoute>
              } 
            />

            <Route 
              path="/parceiros" 
              element={
                <IgrejaProtectedRoute>
                  <ParceirosPage />
                </IgrejaProtectedRoute>
              } 
            />

            <Route 
              path="/organizer/configuracoes" 
              element={
                <OrganizerProtectedRoute>
                  <OrganizerConfigPage />
                </OrganizerProtectedRoute>
              } 
            />
            <Route 
              path="/organizer/escalas" 
              element={
                <OrganizerProtectedRoute>
                  <OrganizerScalesPage />
                </OrganizerProtectedRoute>
              } 
            />
            
            <Route 
              path="/pagamentos-pendentes" 
              element={
                <OrganizerProtectedRoute>
                  <PagamentosPendentesPage />
                </OrganizerProtectedRoute>
              } 
            />

            <Route 
              path="/senhas-parceiros" 
              element={
                <OrganizerProtectedRoute>
                  <SenhasParceirosPage />
                </OrganizerProtectedRoute>
              } 
            />

            <Route
              path="/saude"
              element={
                <ApoioProtectedRoute area="saude">
                  <SaudePage />
                </ApoioProtectedRoute>
              }
            />

            <Route
              path="/portaria"
              element={
                <ApoioProtectedRoute area="portaria">
                  <PortariaPage />
                </ApoioProtectedRoute>
              }
            />

            <Route
              path="/recepcao"
              element={
                <ApoioProtectedRoute area="recepcao">
                  <RecepcaoPage />
                </ApoioProtectedRoute>
              }
            />

            <Route path="/organizador" element={<Navigate to="/gerenciar" replace />} />
            <Route path="/inscricao" element={<InscricaoRedirect />} />
          </Routes>
          </Suspense>
          <Toaster />
          <FaixaAmbienteTeste />
          <DicasMouse />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;