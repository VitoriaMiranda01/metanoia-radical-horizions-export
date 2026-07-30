import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const TermosResponsabilidade = ({ formData, handleChange, handleCheckboxChange }) => {
  const handleAceiteChange = (e) => {
    const isChecked = e.target.checked;
    
    // Safely call handler or fallback to generic handleChange
    if (typeof handleCheckboxChange === 'function') {
      handleCheckboxChange('termoAceito', isChecked);
    } else if (typeof handleChange === 'function') {
      handleChange(e);
    }
    
    // Automatically set current date if checked, clear if unchecked
    if (isChecked) {
      const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
      handleChange({ target: { name: 'dataAceite', value: today } });
    } else {
      handleChange({ target: { name: 'dataAceite', value: '' } });
    }
  };

  return (
    <Card className="glass-effect border-white/20">
      <CardHeader>
        <CardTitle className="text-xl text-white flex items-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>Termos de uso e responsabilidade e Orientações</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-slate-100/5 p-4 rounded-md border border-white/10 transition-colors hover:bg-slate-100/10">
           <a 
             href="#" 
             className="text-blue-400 hover:text-blue-300 underline flex items-center gap-2 break-all text-sm md:text-base font-medium"
             onClick={(e) => {
               e.preventDefault();
               // Simulate download or open PDF
               alert("Simulação: Iniciando download do PDF de Termos de Responsabilidade...");
             }}
           >
             <FileText className="w-4 h-4 flex-shrink-0" />
             termo de responsabilidade e orientacoes metanoia radical serra acampante.pdf
           </a>
        </div>

        <div className="space-y-4">
          <p className="text-white/90 text-sm leading-relaxed border-l-4 border-blue-500 pl-4 py-1">
            Declaro estar ciente do conteúdo deste termo e da essência do trabalho do Metanóia Radical Serra, responsabilizando-me pela veracidade das informações preenchidas na ficha de inscrição. <span className="text-red-500 font-bold">*</span>
          </p>
          
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center space-x-3 bg-white/5 p-3 rounded-md w-fit">
              <input
                type="checkbox"
                id="termoAceito"
                name="termoAceito"
                checked={formData.termoAceito || false}
                onChange={handleAceiteChange}
                className="w-5 h-5 rounded border-white/30 bg-white/10 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                required
              />
              <label htmlFor="termoAceito" className="text-white font-medium cursor-pointer select-none">
                Estou Ciente
              </label>
            </div>

            {formData.termoAceito && formData.dataAceite && (
              <div className="text-blue-200 text-sm animate-in fade-in slide-in-from-left-2">
                Aceite registrado em: <span className="font-semibold text-white">{new Date(formData.dataAceite).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TermosResponsabilidade;