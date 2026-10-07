import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';
import { UFS, mascararCep, problemaCep, limparSemNumero } from '@/utils/validacoesInscricao';

const Endereco = ({
  formData,
  handleChange,
  handleSelectChange,
  setFormData
}) => {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false);
  const ultimoCepBuscado = useRef('');

  // Preenche automaticamente Endereço/Bairro/Cidade/Estado assim que o
  // usuário termina de digitar um CEP válido (8 dígitos), consultando a API
  // pública ViaCEP. Número e Complemento continuam manuais -- a API não
  // informa esses dados. Pedido da usuária em 2026-09-09.
  useEffect(() => {
    const cepLimpo = (formData.cep || '').replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      setCepNaoEncontrado(false);
      return undefined;
    }
    if (cepLimpo === ultimoCepBuscado.current) return undefined;

    let cancelado = false;
    const buscarEndereco = async () => {
      setBuscandoCep(true);
      setCepNaoEncontrado(false);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const dados = await response.json();
        if (cancelado) return;

        ultimoCepBuscado.current = cepLimpo;

        if (dados.erro) {
          setCepNaoEncontrado(true);
          return;
        }

        if (setFormData) {
          setFormData(prev => ({
            ...prev,
            endereco: dados.logradouro || prev.endereco,
            bairro: dados.bairro || prev.bairro,
            cidade: dados.localidade || prev.cidade,
            estado: dados.uf || prev.estado
          }));
        }
      } catch (error) {
        if (!cancelado) setCepNaoEncontrado(true);
      } finally {
        if (!cancelado) setBuscandoCep(false);
      }
    };

    buscarEndereco();
    return () => { cancelado = true; };
  }, [formData.cep, setFormData]);

  return <FormSection title="Endereço">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-2 md:col-span-1">
        <Label htmlFor="cep" className="text-white">CEP</Label>
        <Input id="cep" name="cep" value={formData.cep} onChange={(e) => handleChange({ target: { name: 'cep', value: formData.semCpf ? e.target.value : mascararCep(e.target.value) } })} required inputMode={formData.semCpf ? 'text' : 'numeric'} maxLength={formData.semCpf ? 20 : 9} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="00000-000" />
        {!formData.semCpf && formData.cep && formData.cep.replace(/\D/g, '').length < 8 && <p className="text-xs text-red-300 mt-1">{problemaCep(formData.cep)}</p>}
        {buscandoCep && <p className="text-xs text-white/70 mt-1">Buscando endereço...</p>}
        {cepNaoEncontrado && <p className="text-xs text-yellow-300 mt-1">CEP não encontrado, preencha o endereço manualmente.</p>}
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
        <Input id="cidade" name="cidade" value={formData.cidade} onChange={(e) => handleChange({ target: { name: 'cidade', value: limparSemNumero(e.target.value) } })} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="São Paulo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="estado" className="text-white">Estado</Label>
        <Select value={formData.estado} onValueChange={value => handleSelectChange('estado', value)}>
          <SelectTrigger className="bg-white/10 border-white/20 text-white">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {UFS.map(([uf, nome]) => <SelectItem key={uf} value={uf}>{nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  </FormSection>;
};
export default Endereco;