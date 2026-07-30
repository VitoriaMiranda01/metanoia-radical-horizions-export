import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import ApprovalsView from '@/components/aprovacoes/ApprovalsView';

const ParceirosPage = () => {
  return (
    <>
      <Helmet>
        <title>Área do Parceiro - Metanoia Radical</title>
        <meta name="description" content="Área exclusiva para parceiros do projeto Metanoia Radical" />
        <meta property="og:title" content="Área do Parceiro - Metanoia Radical" />
      </Helmet>

      <Layout>
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
        >
          <ApprovalsView 
            pageTitle="Área do Parceiro"
            pageDescription="Gestão de inscrições para parceiros do projeto"
            showStatistics={true}
          />
        </motion.div>
      </Layout>
    </>
  );
};

export default ParceirosPage;