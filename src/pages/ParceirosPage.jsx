import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import ApprovalsView from '@/components/aprovacoes/ApprovalsView';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ParceirosPage = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-white text-lg">Carregando área do parceiro...</p>
        </div>
      </Layout>
    );
  }

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
          {/* 
            ApprovalsView was refactored in previous tasks to NOT rely on email parameters. 
            It strictly fetches all general partner data without doing queries on `email=undefined`.
          */}
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