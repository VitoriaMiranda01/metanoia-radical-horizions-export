import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';

const QuemIndicou = ({ formData, handleChange, handleSelectChange }) => {
  return (
    <FormSection title="Quem Indicou e Conhecidos">
      <div className="grid grid-cols-1 gap-4">
        
        {/* Nome de quem indicou */}
        <div className="space-y-2">
          <Label htmlFor="nomeQuemIndicou" className="text-white">Nome de quem indicou *</Label>
          <Input 
            id="nomeQuemIndicou" 
            name="nomeQuemIndicou" 
            value={formData.nomeQuemIndicou || ''} 
            onChange={handleChange} 
            required 
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
            placeholder="Digite o nome..." 
          />
        </div>

        {/* Telefone de quem indicou */}
        <div className="space-y-2">
          <Label htmlFor="telefoneQuemIndicou" className="text-white">Telefone de quem indicou (Caso não saiba, informe o seu número) *</Label>
          <Input 
            id="telefoneQuemIndicou" 
            name="telefoneQuemIndicou" 
            value={formData.telefoneQuemIndicou || ''} 
            onChange={handleChange} 
            required 
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
            placeholder="(00) 00000-0000" 
          />
        </div>

        {/* Conhecido no projeto */}
        <div className="space-y-2">
          <Label htmlFor="conhecidoNoProjeto" className="text-white">Tem algum conhecido / familiar que vai participar como acampante no projeto? *</Label>
          <Select 
            value={formData.conhecidoNoProjeto} 
            onValueChange={(value) => handleSelectChange('conhecidoNoProjeto', value)}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NÃO TENHO">NÃO TENHO</SelectItem>
              <SelectItem value="CONJUGE">CONJUGE</SelectItem>
              <SelectItem value="PAI / MÃE">PAI / MÃE</SelectItem>
              <SelectItem value="FILHO / FILHA">FILHO / FILHA</SelectItem>
              <SelectItem value="IRMÃO / IRMÃ">IRMÃO / IRMÃ</SelectItem>
              <SelectItem value="AVÔ / AVÓ">AVÔ / AVÓ</SelectItem>
              <SelectItem value="TIO / TIA">TIO / TIA</SelectItem>
              <SelectItem value="PRIMO / PRIMA">PRIMO / PRIMA</SelectItem>
              <SelectItem value="SOBRINHO / SOBRINHA">SOBRINHO / SOBRINHA</SelectItem>
              <SelectItem value="AMIGO / AMIGA">AMIGO / AMIGA</SelectItem>
              <SelectItem value="COLEGA DE TRABALHO">COLEGA DE TRABALHO</SelectItem>
              <SelectItem value="COLEGA DE ESCOLA">COLEGA DE ESCOLA</SelectItem>
              <SelectItem value="VIZINHO / VIZINHA">VIZINHO / VIZINHA</SelectItem>
              <SelectItem value="OUTRO">OUTRO</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Nome do familiar/conhecido (Condicional) */}
        {formData.conhecidoNoProjeto && formData.conhecidoNoProjeto !== 'NÃO TENHO' && (
          <div className="space-y-2">
            <Label htmlFor="nomeFamiliarConhecido" className="text-white">Nome completo do familiar / conhecido</Label>
            <Input 
              id="nomeFamiliarConhecido" 
              name="nomeFamiliarConhecido" 
              value={formData.nomeFamiliarConhecido || ''} 
              onChange={handleChange} 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
              placeholder="Digite o nome..." 
            />
          </div>
        )}

      </div>
    </FormSection>
  );
};

export default QuemIndicou;