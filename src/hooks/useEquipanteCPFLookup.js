import { useState } from 'react';
import { searchEquipanteByCPF } from '@/services/equipantesService';

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
          ...Object.fromEntries(
            Object.entries(foundData).filter(([key, value]) => value !== null && value !== undefined)
          )
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