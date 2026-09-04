import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';
import { Checkbox } from '@/components/ui/checkbox';
import { useEquipanteCPFLookup } from '@/hooks/useEquipanteCPFLookup';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toBoolean } from '@/utils/formatters';

const DadosPessoais = ({
  formData,
  handleChange,
  handleCpfBlur,
  handleSelectChange,
  handleCheckboxChange,
  isEquipante = false,
  setFormData // Required for the hook
}) => {

  // Use the hook internally if setFormData is provided and it's an equipante
  const { lookupEquipanteByCPF, isLoading, showRecoveryMessage } = useEquipanteCPFLookup(setFormData || (() => { }));

  const onAutorizacaoChange = (checked) => {
    if (typeof handleCheckboxChange === 'function') {
      handleCheckboxChange('autorizacaoImagem', checked);
    } else if (typeof handleChange === 'function') {
      // Fallback: Create a synthetic event
      handleChange({
        target: {
          name: 'autorizacaoImagem',
          value: checked,
          type: 'checkbox',
          checked: checked
        }
      });
    }
  };

  const handleLocalCpfBlur = (e) => {
    // 1. Run the parent's onBlur handler first (formatting etc)
    if (handleCpfBlur) {
      handleCpfBlur(e);
    }

    // 2. Trigger lookup ONLY for equipantes que informaram CPF
    if (isEquipante && setFormData && !formData.semCpf) {
      lookupEquipanteByCPF(e.target.value);
    }
  };

  return (
    <FormSection title="Dados Pessoais">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CPF - Primeiro campo */}
        <div className="space-y-2 relative flex flex-col h-full">
          <div className="flex justify-between items-center h-5 mb-1">
            <Label htmlFor="cpf" className="text-white">CPF</Label>

            <AnimatePresence>
              {showRecoveryMessage && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center text-green-400 text-xs gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Dados recuperados</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <Input
              id="cpf"
              name="cpf"
              value={formData.cpf || ''}
              onChange={handleChange}
              onBlur={handleLocalCpfBlur}
              required={!formData.semCpf}
              disabled={!!formData.semCpf}
              maxLength={14}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-10 disabled:opacity-50"
              placeholder={formData.semCpf ? 'Sem CPF' : '000.000.000-00'}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              </div>
            )}
          </div>

          {!formData.semCpf && (
            <p className="text-[10px] text-blue-200/70 mt-auto pt-1">
              {isEquipante
                ? "Digite o CPF para buscar dados de edições anteriores."
                : "Digite o CPF para preencher automaticamente dados anteriores."}
            </p>
          )}
        </div>

        {/* Nome Completo - Segundo campo (Alinhado com CPF) */}
        <div className="space-y-2 relative flex flex-col h-full">
          <div className="flex items-center h-5 mb-1">
            <Label htmlFor="nome" className="text-white">Nome Completo</Label>
          </div>
          <div className="relative">
            <Input 
              id="nome" 
              name="nome" 
              value={formData.nome || ''} 
              onChange={handleChange} 
              required 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
              placeholder="Seu nome completo" 
            />
          </div>
          {/* Espaçador invisível para manter alinhamento vertical com o texto de ajuda do CPF */}
          <div className="h-4 pointer-events-none mt-auto" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sexo" className="text-white">Sexo</Label>
          <Select value={formData.sexo || ''} onValueChange={(value) => handleSelectChange('sexo', value)}>
            <SelectTrigger className="bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp" className="text-white">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" value={formData.whatsapp || ''} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="(11) 99999-9999" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="idade" className="text-white">Idade</Label>
          <Input id="idade" name="idade" type="number" value={formData.idade || ''} onChange={handleChange} required className="bg-white/10 border-white/20 text-white placeholder:text-white/50" placeholder="25" />
        </div>

        {!isEquipante && (
          <div className="space-y-2">
            <Label htmlFor="tamanho_camisa" className="text-white">Tamanho da Camisa</Label>
            <Select value={formData.tamanho_camisa || ''} onValueChange={(value) => handleSelectChange('tamanho_camisa', value)}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PP">PP</SelectItem>
                <SelectItem value="P">P</SelectItem>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="G">G</SelectItem>
                <SelectItem value="GG">GG</SelectItem>
                <SelectItem value="XG">XG</SelectItem>
                <SelectItem value="XXG">XXG</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Autorização de Uso de Imagem */}
      <div className="flex items-center space-x-2 mt-4 col-span-full">
        <Checkbox
          id="autorizacaoImagem"
          name="autorizacaoImagem"
          checked={toBoolean(formData.autorizacaoImagem)}
          onCheckedChange={onAutorizacaoChange}
          className="border-white/50 data-[state=checked]:bg-red-700 data-[state=checked]:text-white"
        />
        <label
          htmlFor="autorizacaoImagem"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white/80"
        >
          Autorizo o uso da minha imagem em fotos e vídeos divulgados pelos canais oficiais da Metanoia Radical para fins de divulgação do evento.
        </label>
      </div>
    </FormSection>
  );
};

export default DadosPessoais;