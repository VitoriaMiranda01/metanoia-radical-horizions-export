import React from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import EquipanteWorkflowAdmin from '@/components/equipante/EquipanteWorkflowAdmin';

const AdminWorkflowsPage = () => {
  return (
    <Layout>
      <Helmet>
        <title>Gestão de Workflows - Metanoia Radical</title>
      </Helmet>
      <div className="max-w-7xl mx-auto py-8">
        <EquipanteWorkflowAdmin />
      </div>
    </Layout>
  );
};

export default AdminWorkflowsPage;