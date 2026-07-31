import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const EditionContext = createContext();

export const useEdition = () => {
  const context = useContext(EditionContext);
  if (!context) {
    throw new Error('useEdition deve ser usado dentro de um EditionProvider');
  }
  return context;
};

export const EditionProvider = ({ children }) => {
  const [selectedEdition, setSelectedEditionState] = useState(() => {
    const saved = localStorage.getItem('selectedEdition');
    return saved ? parseInt(saved, 10) : null;
  });
  const [availableEditions, setAvailableEditions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEditions = async () => {
    setLoading(true);
    try {
      const allEditions = new Set();

      // Get from configuracoes (current active)
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('edicao_numero')
        .limit(1)
        .maybeSingle();
        
      if (configData?.edicao_numero) {
        allEditions.add(configData.edicao_numero);
      }

      // Get distinct from acampantes
      const { data: acampantesData } = await supabase
        .from('acampantes')
        .select('numero_edicao');
        
      acampantesData?.forEach(item => {
        if (item.numero_edicao) allEditions.add(item.numero_edicao);
      });

      // Get distinct from equipantes
      const { data: equipantesData } = await supabase
        .from('equipantes')
        .select('numero_edicao');
        
      equipantesData?.forEach(item => {
        if (item.numero_edicao) allEditions.add(item.numero_edicao);
      });

      const sortedEditions = Array.from(allEditions).sort((a, b) => a - b);
      setAvailableEditions(sortedEditions);

      // Set default to latest if none selected
      if (!selectedEdition && sortedEditions.length > 0) {
        const latest = sortedEditions[sortedEditions.length - 1];
        setSelectedEditionState(latest);
        localStorage.setItem('selectedEdition', latest.toString());
      }
    } catch (error) {
      console.error('Erro ao buscar edições:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditions();
  }, []);

  const setSelectedEdition = (editionNumber) => {
    const num = parseInt(editionNumber, 10);
    setSelectedEditionState(num);
    localStorage.setItem('selectedEdition', num.toString());
  };

  const value = {
    selectedEdition,
    setSelectedEdition,
    availableEditions,
    loading,
    loadEditions: fetchEditions
  };

  return (
    <EditionContext.Provider value={value}>
      {children}
    </EditionContext.Provider>
  );
};