import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';
const Endereco = ({
  formData,
  handleChange,
  handleSelectChange
}) => <FormSection title="Endereço">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-2 md:col-span-1">
        <Label htmlFor="cep" className="text-white">CEP</Label>
        <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="00000-000" />
      </div>
      <div className="space-y-2 md:col-span-3">
        <Label htmlFor="endereco" className="text-white">Endereço</Label>
        <Input id="endereco" name="endereco" value={formData.endereco} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Nome da rua" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label htmlFor="numero" className="text-white">Número</Label>
        <Input id="numero" name="numero" value={formData.numero} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="123" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="complemento" className="text-white">Complemento (opcional)</Label>
        <Input id="complemento" name="complemento" value={formData.complemento} onChange={handleChange} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Apto 101" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="bairro" className="text-white">Bairro</Label>
        <Input id="bairro" name="bairro" value={formData.bairro} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="Centro" />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="cidade" className="text-white">Cidade</Label>
        <Input id="cidade" name="cidade" value={formData.cidade} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="São Paulo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="estado" className="text-white">Estado</Label>
        <Select value={formData.estado} onValueChange={value => handleSelectChange('estado', value)}>
          <SelectTrigger className="bg-white/10 border-white/20 text-white">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SP">São Paulo</SelectItem>
            <SelectItem value="RJ">Rio de Janeiro</SelectItem>
            <SelectItem value="MG">Minas Gerais</SelectItem>
            <SelectItem value="ES">Espírito Santo</SelectItem>
            <SelectItem value="PR">Paraná</SelectItem>
            <SelectItem value="SC">Santa Catarina</SelectItem>
            <SelectItem value="RS">Rio Grande do Sul</SelectItem>
            <SelectItem value="BA">Bahia</SelectItem>
            <SelectItem value="DF">Distrito Federal</SelectItem>
            <SelectItem value="GO">Goiás</SelectItem>
            <SelectItem value="PE">Pernambuco</SelectItem>
            <SelectItem value="CE">Ceará</SelectItem>
            <SelectItem value="MT">Mato Grosso</SelectItem>
            <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </FormSection>;
export default Endereco;