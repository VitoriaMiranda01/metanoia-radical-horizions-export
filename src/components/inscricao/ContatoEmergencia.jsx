import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';

const ContatoEmergencia = ({ formData, handleChange }) => (
  <FormSection title="Contato de Emergência">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="contatoEmergencia" className="text-white">Nome do Contato *</Label>
        <Input id="contatoEmergencia" name="contatoEmergencia" value={formData.contatoEmergencia} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Nome completo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefoneEmergencia" className="text-white">Telefone de Emergência *</Label>
        <Input id="telefoneEmergencia" name="telefoneEmergencia" value={formData.telefoneEmergencia} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="(11) 99999-9999" />
      </div>
    </div>
  </FormSection>
);

export default ContatoEmergencia;