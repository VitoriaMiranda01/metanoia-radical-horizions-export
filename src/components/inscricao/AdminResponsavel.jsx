import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';

// igrejasEsgotadas: Set com as igrejas (mesma string de IGREJAS_PARCEIRAS)
// que ja bateram o limite de acampantes inscritos (ver
// src/services/limitesIgrejasService.js e a sessao "Limite de Inscrições
// por Igreja" em Configurações). So desabilita a igreja neste campo -- os
// outros campos de igreja do formulario (ex: "Igreja que frequenta") nao
// tem nenhum controle de limite, por pedido explicito da usuaria.
const AdminResponsavel = ({ formData, handleChange, handleSelectChange, igrejasEsgotadas }) => {
  return (
    <FormSection title="Igreja Responsável">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adminResponsavel" className="text-white">Igreja Responsável pela Inscrição</Label>
          <Select
            value={formData.adminResponsavel}
            onValueChange={(value) => handleSelectChange('adminResponsavel', value)}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione a igreja..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {IGREJAS_PARCEIRAS.map((option, index) => {
                const esgotada = !!igrejasEsgotadas?.has(option);
                return (
                  <SelectItem key={index} value={option} disabled={esgotada}>
                    {option}{esgotada ? ' (limite atingido)' : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormSection>
  );
};

export default AdminResponsavel;
