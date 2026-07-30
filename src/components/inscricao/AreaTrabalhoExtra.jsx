import React from 'react';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';

const AreaTrabalhoExtra = ({ formData, handleChange }) => {
  const OPTIONS = [
    "Disponível para ajudar a carregar o caminhão na Centenario Quinta-Feira 19h.",
    "Disponível para cozinha da Centenario na Sexta-Feira a tarde preparando o lanche dos ACAMPANTES.",
    "Disponível para ajudar na limpeza da Centenario após a saída dos ACAMPANTES na Sexta-Feira."
  ];

  return (
    <FormSection title="Área de trabalho extra">
      <div className="space-y-4">
        <Label className="text-white block mb-2">Área de Trabalho Extra</Label>
        <div className="flex flex-col space-y-3">
          {OPTIONS.map((option) => (
            <label key={option} className="flex items-start space-x-2 cursor-pointer">
              <input
                type="radio"
                name="areaTrabalhoExtra"
                value={option}
                checked={formData.areaTrabalhoExtra === option}
                onChange={handleChange}
                className="w-4 h-4 mt-1 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30"
              />
              <span className="text-white text-sm leading-tight">{option}</span>
            </label>
          ))}
        </div>
      </div>
    </FormSection>
  );
};

export default AreaTrabalhoExtra;