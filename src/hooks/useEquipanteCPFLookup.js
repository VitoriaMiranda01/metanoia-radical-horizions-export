import { useState } from 'react';
import { searchEquipanteByCPF } from '@/lib/api/equipanteApi';

/**
 * Custom hook to handle CPF lookup and form auto-fill for Equipantes.
 * 
 * @param {Function} setFormData - State setter for the form data
 * @returns {Object} - { lookupEquipanteByCPF, isLoading, showRecoveryMessage }
 */
export const useEquipanteCPFLookup = (setFormData) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showRecoveryMessage, setShowRecoveryMessage] = useState(false);

  const lookupEquipanteByCPF = async (cpf) => {
    // Basic validation before API call
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
      return;
    }

    setIsLoading(true);

    try {
      const foundData = await searchEquipanteByCPF(cpf);

      if (foundData) {
        // Auto-fill form data
        setFormData(prev => ({
          ...prev,
          nome: foundData.nome || prev.nome,
          whatsapp: foundData.whatsapp || prev.whatsapp,
          tamanhoCamisa: foundData.tamanhoCamisa || prev.tamanhoCamisa,
          igreja: foundData.igreja || prev.igreja,
          areaTrabalhoOpcao1: foundData.areaTrabalhoOpcao1 || prev.areaTrabalhoOpcao1,
          areaTrabalhoOpcao2: foundData.areaTrabalhoOpcao2 || prev.areaTrabalhoOpcao2,
          areaTrabalhoOpcao3: foundData.areaTrabalhoOpcao3 || prev.areaTrabalhoOpcao3,
        }));

        // Show feedback
        setShowRecoveryMessage(true);
        setTimeout(() => setShowRecoveryMessage(false), 3000);
      }
    } catch (error) {
      // Silent error handling as per requirements
      console.error('CPF Lookup failed silently:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    lookupEquipanteByCPF,
    isLoading,
    showRecoveryMessage
  };
};