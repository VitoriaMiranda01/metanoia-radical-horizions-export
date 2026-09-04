import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';

const DadosComplementaresEquipante = ({
  formData,
  handleChange,
  handleSelectChange,
  handleCheckboxChange
}) => {
  const PARENTESCO_OPTIONS = ['NÃO TENHO', 'CÔNJUGE', 'PAI', 'MÃE', 'FILHO', 'TIO / TIA', 'CUNHADO / CUNHADA', 'IRMÃO / IRMÃ', 'OUTRO FAMILIAR (DESCREVA)'];
  const RADICAL_ACAMPANTE_OPTIONS = ['Metanoia Radical MG', 'Metanoia Radical RJ (PIBSA)', 'Metanoia Radical Serra (Igreja Teresópolis)', 'Outros casos (favor descrever)'];

  return (
    <FormSection title="Dados do Equipante no Projeto">
      <div className="space-y-6">
        
        {/* Familiar Trabalhando */}
        <div className="space-y-2">
          <Label htmlFor="familiarTrabalhando" className="text-white">Tem algum familiar que vai trabalhar no projeto?</Label>
          <Select value={formData.familiarTrabalhando} onValueChange={value => handleSelectChange('familiarTrabalhando', value)}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {PARENTESCO_OPTIONS.map(option => <SelectItem key={`trab-${option}`} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {formData.familiarTrabalhando === 'OUTRO FAMILIAR (DESCREVA)' && (
          <div className="space-y-2">
            <Label htmlFor="familiarTrabalhandoOutro" className="text-white">Outro familiar (favor descrever) (opcional)</Label>
            <Input id="familiarTrabalhandoOutro" name="familiarTrabalhandoOutro" value={formData.familiarTrabalhandoOutro} onChange={handleChange} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Descreva o grau de parentesco" />
          </div>
        )}

        {/* Familiar Acampando */}
        <div className="space-y-2">
          <Label htmlFor="parentesco" className="text-white">Tem algum conhecido / familiar que vai participar como ACAMPANTE no projeto?</Label>
          <Select value={formData.parentesco} onValueChange={value => handleSelectChange('parentesco', value)}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {PARENTESCO_OPTIONS.map(option => <SelectItem key={`acamp-${option}`} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {formData.parentesco && formData.parentesco !== 'NÃO TENHO' && (
          <div className="space-y-2">
            <Label htmlFor="familiarNome" className="text-white">Descrever conhecido / familiar (opcional)</Label>
            <Input id="familiarNome" name="familiarNome" value={formData.familiarNome} onChange={handleChange} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Nome do conhecido/familiar" />
          </div>
        )}

        {/* Histórico Radical Acampante */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="space-y-2">
            <Label className="text-white block mb-2">Você fez qual Radical como ACAMPANTE?</Label>
            <div className="flex flex-col space-y-2">
              {RADICAL_ACAMPANTE_OPTIONS.map(option => (
                <label key={option} className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="qualRadicalAcampante" value={option} checked={formData.qualRadicalAcampante === option} onChange={handleChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30" required />
                  <span className="text-white">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {formData.qualRadicalAcampante === 'Outros casos (favor descrever)' && (
            <div className="space-y-2">
              <Label htmlFor="qualRadicalAcampanteOutro" className="text-white">Outra edição (favor descrever) (opcional)</Label>
              <Input id="qualRadicalAcampanteOutro" name="qualRadicalAcampanteOutro" value={formData.qualRadicalAcampanteOutro} onChange={handleChange} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="numeroEdicaoParticipou" className="text-white">Qual número da edição que você participou do Radical? (opcional)</Label>
            <Input id="numeroEdicaoParticipou" name="numeroEdicaoParticipou" value={formData.numeroEdicaoParticipou} onChange={handleChange} type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
          </div>
        </div>

        {/* Histórico Trabalho */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="space-y-2">
            <Label className="text-white block mb-2">Já trabalhou em alguma Edição do Radical?</Label>
            <div className="flex space-x-6">
              {['SIM', 'NÃO'].map(opt => (
                <label key={`trabalhou-${opt}`} className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="jaTrabalhouEquipe" value={opt} checked={formData.jaTrabalhouEquipe === opt} onChange={handleChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30" required />
                  <span className="text-white">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {formData.jaTrabalhouEquipe === 'SIM' && (
            <div className="space-y-2">
              <Label htmlFor="edicaoTrabalhou" className="text-white">Em qual edição você trabalhou? (opcional)</Label>
              <Input id="edicaoTrabalhou" name="edicaoTrabalhou" value={formData.edicaoTrabalhou} onChange={handleChange} type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
            </div>
          )}
        </div>

      </div>
    </FormSection>
  );
};

export default DadosComplementaresEquipante;