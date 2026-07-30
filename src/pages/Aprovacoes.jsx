import React from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import ApprovalsView from '@/components/aprovacoes/ApprovalsView';
import { useEdition } from '@/contexts/EditionContext';

const Aprovacoes = () => {
  const { selectedEdition } = useEdition();

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
          {/* We pass selectedEdition to ApprovalsView so it can filter data internally if needed,
              and also display the current edition to the user. */}
          <ApprovalsView 
            pageTitle="Aprovação de Equipantes"
            pageDescription={selectedEdition ? `Gerencie as inscrições pendentes da equipe de trabalho (Edição ${selectedEdition})` : "Carregando edições..."}
            selectedEdition={selectedEdition}
          />
        </motion.div>
      </Layout>
    </>
  );
};

export default Aprovacoes;