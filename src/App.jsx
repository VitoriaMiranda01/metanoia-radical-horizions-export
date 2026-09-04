import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import OrganizerProtectedRoute from '@/components/route-guards/OrganizerProtectedRoute';
import IgrejaProtectedRoute from '@/components/route-guards/IgrejaProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import AcampantePage from '@/pages/AcampantePage';
import EquipantePage from '@/pages/EquipantePage';
import GerenciarInscricoesPage from '@/pages/GerenciarInscricoesPage';
import AprovacoesPage from '@/pages/AprovacoesPage';
import ParceirosPage from '@/pages/ParceirosPage';
import HomePage from '@/pages/HomePage';
import OrganizerConfigPage from '@/pages/OrganizerConfigPage';
import OrganizerScalesPage from '@/pages/OrganizerScalesPage';
import PaymentMethodSelectionPage from '@/pages/PaymentMethodSelectionPage';
import InscricaoPixPage from '@/pages/InscricaoPixPage';
import ManualPaymentPage from '@/pages/ManualPaymentPage';
import AdminWorkflowsPage from '@/pages/AdminWorkflowsPage';
import PagamentosPendentesPage from '@/pages/PagamentosPendentesPage';
import Layout from '@/components/Layout';
import EquipanteWorkflowStatus from '@/components/equipante/EquipanteWorkflowStatus';

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

            <Route path="/organizador" element={<Navigate to="/gerenciar" replace />} />
            <Route path="/inscricao" element={<InscricaoRedirect />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;