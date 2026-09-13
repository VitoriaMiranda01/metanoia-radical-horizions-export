import React from 'react';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import IgrejaSelect from './IgrejaSelect';
import { IGREJAS_RESPONSAVEL_ACAMPANTE } from '@/constants/igrejas';

// A lista aqui e IGREJAS_RESPONSAVEL_ACAMPANTE, nao IGREJAS_PARCEIRAS: alem
// das 145 igrejas ela traz "RADICAL 36", que so existe neste campo (ver o
// comentario em constants/igrejas.js). O formulario de equipante continua com
// a lista sem ela.
//
// igrejasEsgotadas: Set com as igrejas (mesma string da lista acima)
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
          <IgrejaSelect
            id="adminResponsavel"
            value={formData.adminResponsavel}
            onChange={(value) => handleSelectChange('adminResponsavel', value)}
            options={IGREJAS_RESPONSAVEL_ACAMPANTE}
            disabledOptions={igrejasEsgotadas}
          />
        </div>
      </div>
    </FormSection>
  );
};

export default AdminResponsavel;
