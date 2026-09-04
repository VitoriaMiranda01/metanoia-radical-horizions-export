import React from 'react';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import { cn } from '@/lib/utils';

// Unica area que pode ser escolhida em mais de uma das 3 opcoes de
// preferencia (ver isAreaDisabled abaixo) -- antes eram 3 areas
// separadas ("Disponível para qualquer área 1/2/3"), unificadas a
// pedido da usuaria pra ficar mais simples no formulario e na tela de
// escalas (que passa a mostrar 1 tabela em vez de 3).
const AREA_DISPONIVEL_QUALQUER = "Disponível para qualquer área";

const AreasDeTrabalho = ({ formData, handleChange, handleSelectChange }) => {
  const AREAS = [
    "Contêiner",
    "Copa",
    "Cozinha",
    "Cracolândia",
    "Cristalândia",
    "Dia do arrebatamento da igreja",
    AREA_DISPONIVEL_QUALQUER,
    "Falsa baiana",
    "Família",
    "Família muçulmana",
    "Fotografia (necessário possuir equipamento próprio)",
    "Hospital (cena teatral)",
    "Igreja subterrânea",
    "Invisível",
    "Logística",
    "Louvor nas cenas",
    "Marcador",
    "Oração itinerante",
    "Pastor enforcado",
    "Perseguidos",
    "Presídio",
    "Primeiros socorros – Saúde",
    "Recepção",
    "Segurança",
    "Selva",
    "Teatro",
    "Túmulo"
  ];

  const EXTRA_OPTIONS = [
    "Disponível para ajudar a carregar o caminhão na Centenario Quinta-Feira 19h.",
    "Disponível para cozinha da Centenario na Sexta-Feira a tarde preparando o lanche dos ACAMPANTES.",
    "Disponível para ajudar na limpeza da Centenario após a saída dos ACAMPANTES na Sexta-Feira."
  ];

  // Helper to check if an area is selected in other fields
  const isAreaDisabled = (area, currentFieldName) => {
    // "Disponível para qualquer área" é a única exceção à regra abaixo: pode
    // ser escolhida em mais de uma das 3 opções de preferência.
    if (area === AREA_DISPONIVEL_QUALQUER) return false;

    const fieldNames = ["areaTrabalhoOpcao1", "areaTrabalhoOpcao2", "areaTrabalhoOpcao3"];
    const otherFields = fieldNames.filter(name => name !== currentFieldName);
    
    // Check if the area is selected in any of the OTHER fields
    return otherFields.some(fieldName => formData[fieldName] === area);
  };

  const handleExtraChange = (option, checked) => {
    const current = formData.areasTrabalhoExtra || [];
    let updated;
    if (checked) {
      updated = [...current, option];
    } else {
      updated = current.filter(item => item !== option);
    }
    handleSelectChange('areasTrabalhoExtra', updated);
  };

  const renderRadioGroup = (label, name, value) => (
    <div className="space-y-3">
      <Label className="text-white block text-md font-medium">{label}</Label>
      <div className="bg-white/5 border border-white/10 rounded-md p-4 max-h-60 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AREAS.map((area) => {
            const disabled = isAreaDisabled(area, name);
            const isSelected = value === area;
            
            return (
              <label 
                key={`${name}-${area}`} 
                className={cn(
                  "flex items-start space-x-3 p-2 rounded transition-colors border border-transparent",
                  disabled 
                    ? "opacity-40 cursor-not-allowed bg-black/20" 
                    : "cursor-pointer hover:bg-white/5",
                  isSelected && "bg-white/10 border-white/20"
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={area}
                  checked={isSelected}
                  onChange={handleChange}
                  disabled={disabled}
                  required
                  className="w-4 h-4 mt-1 text-red-600 focus:ring-red-500 bg-black/40 border-white/30 disabled:opacity-50"
                />
                <span className={cn(
                  "text-sm leading-tight",
                  disabled ? "text-gray-500" : "text-gray-200"
                )}>
                  {area} {disabled && "(Selecionado em outra opção)"}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <FormSection title="Áreas de Trabalho">
      <div className="space-y-8">
        <div className="bg-yellow-900/20 border border-yellow-700/30 p-4 rounded-md mb-4">
          <p className="text-yellow-200 text-sm">
            Selecione abaixo suas 3 opções de preferência para áreas de trabalho.
            <br/>
            <strong>Nota:</strong> Você não pode selecionar a mesma área em mais de uma opção, exceto "Disponível para qualquer área", que pode ser selecionada em mais de uma opção.
          </p>
        </div>
        
        {renderRadioGroup("Opção 1 (Prioridade)", "areaTrabalhoOpcao1", formData.areaTrabalhoOpcao1)}
        {renderRadioGroup("Opção 2", "areaTrabalhoOpcao2", formData.areaTrabalhoOpcao2)}
        {renderRadioGroup("Opção 3", "areaTrabalhoOpcao3", formData.areaTrabalhoOpcao3)}

        <div className="pt-6 border-t border-white/10 mt-6">
           <Label className="text-white block mb-4 text-md font-medium">Áreas de Trabalho Extra (opcional)</Label>
            <div className="flex flex-col space-y-3">
              {EXTRA_OPTIONS.map((option) => {
                const isSelected = (formData.areasTrabalhoExtra || []).includes(option);
                return (
                  <label key={option} className="flex items-start space-x-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                    <input
                      type="checkbox"
                      name="areasTrabalhoExtra"
                      value={option}
                      checked={isSelected}
                      onChange={(e) => handleExtraChange(option, e.target.checked)}
                      className="w-4 h-4 mt-1 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30 rounded"
                    />
                    <span className="text-white text-sm leading-tight">{option}</span>
                  </label>
                );
              })}
            </div>
        </div>
      </div>
    </FormSection>
  );
};

export default AreasDeTrabalho;