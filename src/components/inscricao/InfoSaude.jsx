import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import { toBoolean } from '@/utils/formatters';

const InfoSaude = ({ formData, handleChange }) => {
  
  // Helper to check if a value matches the option (handling both boolean and string 'SIM'/'NÃO')
  const isChecked = (fieldValue, option) => {
    const boolValue = toBoolean(fieldValue);
    if (option === 'SIM') return boolValue === true;
    if (option === 'NÃO') return boolValue === false;
    return false;
  };

  return (
    <FormSection title="Saúde">
      <div className="grid grid-cols-1 gap-6">
        
        {/* Problema de Saúde */}
        <div className="space-y-2">
          <Label className="text-white block mb-2">Tem algum problema de saúde? *</Label>
          <div className="flex space-x-6">
            {['SIM', 'NÃO'].map((opt) => (
              <label key={`saude-${opt}`} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="temProblemaSaude"
                  value={opt}
                  checked={isChecked(formData.temProblemaSaude, opt)}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30"
                  required
                />
                <span className="text-white">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {toBoolean(formData.temProblemaSaude) && (
          <div className="space-y-2">
            <Label htmlFor="condicoesMedicas" className="text-white">Qual problema de saúde?</Label>
            <Input 
              id="condicoesMedicas" 
              name="condicoesMedicas" 
              value={formData.condicoesMedicas || ''} 
              onChange={handleChange} 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
              placeholder='Ex: Diabetes' 
            />
          </div>
        )}

        {toBoolean(formData.usaMedicamento) && (
          <div className="space-y-2">
            <Label htmlFor="medicamentos" className="text-white">Qual medicamento?</Label>
            <Input 
              id="medicamentos" 
              name="medicamentos" 
              value={formData.medicamentos || ''} 
              onChange={handleChange} 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
              placeholder='Ex: Dipirona' 
            />
          </div>
        )}

        {/* Restrições Alimentares */}
        <div className="space-y-2">
          <Label className="text-white block mb-2">Tem restrição alimentar? *</Label>
          <div className="flex space-x-6">
            {['SIM', 'NÃO'].map((opt) => (
              <label key={`alim-${opt}`} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="temRestricaoAlimentar"
                  value={opt}
                  checked={isChecked(formData.temRestricaoAlimentar, opt)}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30"
                  required
                />
                <span className="text-white">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {toBoolean(formData.temRestricaoAlimentar) && (
          <div className="space-y-2">
            <Label htmlFor="restricoesAlimentares" className="text-white">Quais?</Label>
            <Input 
              id="restricoesAlimentares" 
              name="restricoesAlimentares" 
              value={formData.restricoesAlimentares || ''} 
              onChange={handleChange} 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
              placeholder='Ex: Intolerância à lactose' 
            />
          </div>
        )}

        {/* Gravidez */}
        <div className="space-y-2">
          <Label className="text-white block mb-2">Está grávida? *</Label>
          <div className="flex space-x-6">
            {['SIM', 'NÃO'].map((opt) => (
              <label key={`gravida-${opt}`} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="estaGravida"
                  value={opt}
                  checked={isChecked(formData.estaGravida, opt)}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30"
                  required
                />
                <span className="text-white">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </FormSection>
  );
};

export default InfoSaude;