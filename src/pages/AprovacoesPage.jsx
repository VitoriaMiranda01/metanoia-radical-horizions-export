import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import ApprovalsView from '@/components/aprovacoes/ApprovalsView';

const AprovacoesPage = () => {
  return (
    <>
      <Helmet>
        <title>Aprovação de Equipantes - Metanoia Radical</title>
        <meta name="description" content="Aprove ou rejeite as inscrições de equipantes do projeto Metanoia Radical" />
        <meta property="og:title" content="Aprovação de Equipantes - Metanoia Radical" />
      </Helmet>

      <Layout>
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
        >
          <ApprovalsView 
            pageTitle="Aprovação de Equipantes"
            pageDescription="Gerencie as inscrições pendentes da equipe de trabalho"
          />
        </motion.div>
      </Layout>
    </>
  );
};

export default AprovacoesPage;