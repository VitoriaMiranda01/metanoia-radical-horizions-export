import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';

const ExperienciaMotivacao = ({ 
  formData, 
  handleChange, 
  handleSelectChange
}) => (
  <FormSection title="Experiência e Motivação">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="indicacaoNome" className="text-white">Quem te indicou o projeto?</Label>
        <Input 
          id="indicacaoNome" 
          name="indicacaoNome" 
          value={formData.indicacaoNome} 
          onChange={handleChange} 
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
          placeholder="Nome de quem indicado" 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="indicacaoTelefone" className="text-white">Telefone de quem indicado</Label>
        <Input 
          id="indicacaoTelefone" 
          name="indicacaoTelefone" 
          value={formData.indicacaoTelefone} 
          onChange={handleChange} 
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
          placeholder="(00) 00000-0000" 
        />
      </div>
    </div>

    <div className="mt-4 space-y-2">
      <Label htmlFor="conhecidoNoAcampamento" className="text-white">Tem algum conhecido/familiar que vai participar como campante no projeto? *</Label>
      <Select 
        value={formData.conhecidoNoAcampamento} 
        onValueChange={(value) => handleSelectChange('conhecidoNoAcampamento', value)}
      >
        <SelectTrigger className="bg-white/10 border-white/20 text-white">
          <SelectValue placeholder="... Selecione uma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Nao">Não</SelectItem>
          <SelectItem value="Sim">Sim</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="mt-4 space-y-2">
      <Label htmlFor="experienciaAcampamento" className="text-white">Já participou de algum acampamento? Se sim, conte como foi sua experiência.</Label>
      <Textarea 
        id="experienciaAcampamento" 
        name="experienciaAcampamento" 
        value={formData.experienciaAcampamento} 
        onChange={handleChange} 
        className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
        placeholder="Sua experiência..." 
        rows="3" 
      />
    </div>

    <div className="mt-4 space-y-2">
      <Label htmlFor="motivacao" className="text-white">O que você motivou para se inscrever no Metanoia Radical?</Label>
      <Textarea 
        id="motivacao" 
        name="motivacao" 
        value={formData.motivacao} 
        onChange={handleChange} 
        className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
        placeholder="Sua motivação..." 
        rows="3" 
      />
    </div>
  </FormSection>
);

export default ExperienciaMotivacao;