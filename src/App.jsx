import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { EditionProvider } from '@/contexts/EditionContext';
import { Toaster } from '@/components/ui/toaster';
import ProtectedRoute from '@/components/ProtectedRoute';
import OrganizerProtectedRoute from '@/components/OrganizerProtectedRoute';
import IgrejaProtectedRoute from '@/components/IgrejaProtectedRoute';
import Login from '@/pages/Login';
import Acampante from '@/pages/Acampante';
import Equipante from '@/pages/Equipante';
import GerenciarInscricoes from '@/pages/GerenciarInscricoes';
import Aprovacoes from '@/pages/Aprovacoes';
import ParceirosPage from '@/pages/ParceirosPage';
import HomePage from '@/pages/HomePage';
import OrganizerConfigPage from '@/pages/OrganizerConfigPage';
import OrganizerScalesPage from '@/pages/OrganizerScalesPage';
import PaymentMethodSelection from '@/pages/PaymentMethodSelection';
import InscricaoPixPage from '@/pages/InscricaoPixPage';
import ManualPaymentPage from '@/pages/ManualPaymentPage';
import AdminWorkflowsPage from '@/pages/AdminWorkflowsPage';
import PagamentosPendentes from '@/pages/PagamentosPendentes';
import Layout from '@/components/Layout';
import EquipanteWorkflowStatus from '@/components/equipante/EquipanteWorkflowStatus';

function EquipanteWorkflowRoute() {
  const { equipante_id } = useParams();
  const navigate = useNavigate();
  return (
    <EquipanteWorkflowStatus
      equipanteId={equipante_id}
      onProceedToPayment={() => navigate('/payment-method-selection', { state: { equipanteId: equipante_id } })}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <EditionProvider>
        <Router>
          <div className="min-h-screen">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Login />} />
              
              <Route path="/acampante" element={<Acampante />} />
              <Route path="/equipante" element={<Equipante />} />
              <Route path="/payment-method-selection" element={<PaymentMethodSelection />} />
              <Route path="/inscricao-pix" element={<InscricaoPixPage />} />
              <Route path="/inscricao-manual" element={<ManualPaymentPage />} />
              {/* Added /manual-payment mapping per requirements to maintain route matching */}
              <Route path="/manual-payment" element={<ManualPaymentPage />} />

              {/* Individual Workflow Route (Usually accessed during registration, but mapped here as well) */}
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
                    <GerenciarInscricoes />
                  </OrganizerProtectedRoute>
                } 
              />
              <Route 
                path="/aprovacoes" 
                element={
                  <OrganizerProtectedRoute>
                    <Aprovacoes />
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
                    <PagamentosPendentes />
                  </OrganizerProtectedRoute>
                } 
              />

              <Route path="/organizador" element={<Navigate to="/gerenciar" replace />} />
              <Route path="/inscricao" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </EditionProvider>
    </AuthProvider>
  );
}

export default App;