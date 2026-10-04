import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import TelefoneInput from './TelefoneInput';

const ContatoEmergencia = ({ formData, handleChange }) => (
  <FormSection title="Contato de Emergência">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="contatoEmergencia" className="text-white">Nome do Contato</Label>
        <Input id="contatoEmergencia" name="contatoEmergencia" value={formData.contatoEmergencia} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Nome completo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefoneEmergencia" className="text-white">Telefone de Emergência</Label>
        {/* Aceita fixo: o contato de emergencia pode ser o telefone de casa. */}
        <TelefoneInput id="telefoneEmergencia" name="telefoneEmergencia" value={formData.telefoneEmergencia} onChange={handleChange} required aceitaFixo estrangeiro={!!formData.semCpf} />
      </div>
    </div>
  </FormSection>
);

export default ContatoEmergencia;