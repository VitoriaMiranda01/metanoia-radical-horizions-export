import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormSection from './FormSection';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';

const InfoEclesiasticas = ({
  formData,
  handleChange,
  isEquipante = false
}) => {
  // --- EQUIPANTE LAYOUT (Conditional) ---
  if (isEquipante) {
    return (
      <FormSection title="Igreja">
        <div className="space-y-6">
          {/* 1. Pergunta Principal - Sempre visível e no topo */}
          <div className="space-y-2 p-4 bg-white/5 rounded-lg border border-white/10">
            <Label htmlFor="estaAfastado" className="text-white text-lg font-medium">
              Congrega em alguma igreja? *
            </Label>
            <Select 
              value={formData.estaAfastado} 
              onValueChange={value => handleChange({ target: { name: 'estaAfastado', value } })}
            >
              <SelectTrigger className="bg-white/10 border-white/20 text-white h-12">
                <SelectValue placeholder="Selecione sua resposta..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIM">SIM - Eu congrego em uma igreja</SelectItem>
                <SelectItem value="NÃO">NÃO - Não estou congregando no momento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. Campos Condicionais */}
          <AnimatePresence>
            {formData.estaAfastado === 'SIM' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="igreja" className="text-white">Igreja que frequenta *</Label>
                    <Select value={formData.igreja} onValueChange={value => handleChange({ target: { name: 'igreja', value } })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione sua igreja..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {IGREJAS_PARCEIRAS.map((option, index) => (
                          <SelectItem key={index} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pastor" className="text-white">Nome do Pastor *</Label>
                    <Input 
                      id="pastor" 
                      name="pastor" 
                      value={formData.pastor} 
                      onChange={handleChange} 
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
                      placeholder="Nome do pastor" 
                    />
                  </div>

                  {/* Equipante specific Cargo options */}
                  <div className="space-y-2">
                    <Label htmlFor="cargoIgreja" className="text-white">Cargo na Igreja *</Label>
                    <Select value={formData.cargoIgreja} onValueChange={value => handleChange({ target: { name: 'cargoIgreja', value } })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NÃO TENHO CARGO">NÃO TENHO CARGO</SelectItem>
                        <SelectItem value="DANÇA">DANÇA</SelectItem>
                        <SelectItem value="DIACONO / DIACONISA">DIACONO / DIACONISA</SelectItem>
                        <SelectItem value="LOUVOR">LOUVOR</SelectItem>
                        <SelectItem value="PASTOR(A)">PASTOR(A)</SelectItem>
                        <SelectItem value="PASTOR(A) AUXILIAR">PASTOR(A) AUXILIAR</SelectItem>
                        <SelectItem value="PROFESSOR">PROFESSOR</SelectItem>
                        <SelectItem value="SECRETARIA">SECRETARIA</SelectItem>
                        <SelectItem value="TEATRO">TEATRO</SelectItem>
                        <SelectItem value="TESOUREIRO">TESOUREIRO</SelectItem>
                        <SelectItem value="OUTRO">OUTRO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.cargoIgreja === 'OUTRO' && (
                    <div className="space-y-2">
                      <Label htmlFor="cargoIgrejaOutro" className="text-white">OUTRO *</Label>
                      <Input 
                        id="cargoIgrejaOutro" 
                        name="cargoIgrejaOutro" 
                        value={formData.cargoIgrejaOutro || ''} 
                        onChange={handleChange} 
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
                        placeholder='Especifique seu cargo' 
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="frequentaEBD" className="text-white">Frequenta Escola Bíblica (EBD)? *</Label>
                    <Select value={formData.frequentaEBD} onValueChange={value => handleChange({ target: { name: 'frequentaEBD', value } })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SIM">SIM</SelectItem>
                        <SelectItem value="NÃO">NÃO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Frequenta Grupo de Cuidado / Célula? *</Label>
                    <div className="flex gap-4 pt-2 h-10 items-center">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          id="frequentaGrupoCuidadoSim" 
                          name="frequentaGrupoCuidado" 
                          value="SIM" 
                          checked={formData.frequentaGrupoCuidado === 'SIM'} 
                          onChange={handleChange} 
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 ring-offset-gray-800" 
                        />
                        <Label htmlFor="frequentaGrupoCuidadoSim" className="text-white font-normal cursor-pointer">SIM</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="radio" 
                          id="frequentaGrupoCuidadoNao" 
                          name="frequentaGrupoCuidado" 
                          value="NÃO" 
                          checked={formData.frequentaGrupoCuidado === 'NÃO'} 
                          onChange={handleChange} 
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 ring-offset-gray-800" 
                        />
                        <Label htmlFor="frequentaGrupoCuidadoNao" className="text-white font-normal cursor-pointer">NÃO</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voceCanta" className="text-white">Você canta? *</Label>
                    <Select value={formData.voceCanta} onValueChange={value => handleChange({ target: { name: 'voceCanta', value } })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SIM">SIM</SelectItem>
                        <SelectItem value="NÃO">NÃO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tocaInstrumento" className="text-white">Você toca algum instrumento? *</Label>
                    <Select value={formData.tocaInstrumento} onValueChange={value => handleChange({ target: { name: 'tocaInstrumento', value } })}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NÃO">NÃO</SelectItem>
                        <SelectItem value="VIOLÃO">VIOLÃO</SelectItem>
                        <SelectItem value="GUITARRA">GUITARRA</SelectItem>
                        <SelectItem value="BAIXO">BAIXO</SelectItem>
                        <SelectItem value="TECLADO">TECLADO</SelectItem>
                        <SelectItem value="BATERIA">BATERIA</SelectItem>
                        <SelectItem value="CAJON">CAJON</SelectItem>
                        <SelectItem value="INSTRUMENTO DE SOPRO">INSTRUMENTO DE SOPRO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FormSection>
    );
  }

  // --- ACAMPANTE LAYOUT (Updated with Conditional Logic) ---
  return (
    <FormSection title="Igreja">
      <div className="space-y-6">
        {/* 1. Pergunta Principal - Sempre visível e no topo */}
        <div className="space-y-2 p-4 bg-white/5 rounded-lg border border-white/10">
          <Label htmlFor="estaAfastado" className="text-white text-lg font-medium">
            Congrega em alguma igreja? *
          </Label>
          <Select 
            value={formData.estaAfastado} 
            onValueChange={value => handleChange({ target: { name: 'estaAfastado', value } })}
          >
            <SelectTrigger className="bg-white/10 border-white/20 text-white h-12">
              <SelectValue placeholder="Selecione sua resposta..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SIM">SIM - Eu congrego em uma igreja</SelectItem>
              <SelectItem value="NÃO">NÃO - Não estou congregando no momento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 2. Campos Condicionais */}
        <AnimatePresence>
          {formData.estaAfastado === 'SIM' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pb-2">
                <div className="space-y-2">
                  <Label htmlFor="igreja" className="text-white">Igreja que frequenta *</Label>
                  <Input 
                    id="igreja" 
                    name="igreja" 
                    value={formData.igreja} 
                    onChange={handleChange} 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
                    placeholder="Nome da sua igreja" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pastor" className="text-white">Nome do Pastor *</Label>
                  <Input 
                    id="pastor" 
                    name="pastor" 
                    value={formData.pastor} 
                    onChange={handleChange} 
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
                    placeholder="Nome do pastor" 
                  />
                </div>

                {/* Acampante specific fields */}
                <div className="space-y-2">
                  <Label htmlFor="ePastor" className="text-white">Cargo na igreja *</Label>
                  <Select value={formData.ePastor} onValueChange={value => handleChange({ target: { name: 'ePastor', value } })}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NÃO TENHO CARGO">NAO TENHO CARGO</SelectItem>
                      <SelectItem value="DANÇA">DANÇA</SelectItem>
                      <SelectItem value="DIACONO / DIACONISA">DIACONO / DIACONISA</SelectItem>
                      <SelectItem value="LOUVOR">LOUVOR</SelectItem>
                      <SelectItem value="PASTOR(A)">PASTOR(A)</SelectItem>
                      <SelectItem value="PASTOR(A) AUXILIAR">PASTOR(A) AUXILIAR</SelectItem>
                      <SelectItem value="PROFESSOR">PROFESSOR</SelectItem>
                      <SelectItem value="SECRETARIA">SECRETARIA</SelectItem>
                      <SelectItem value="TEATRO">TEATRO</SelectItem>
                      <SelectItem value="TESOUREIRO">TESOUREIRO</SelectItem>
                      <SelectItem value="OUTRO">OUTRO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.ePastor === 'OUTRO' && (
                  <div className="space-y-2">
                    <Label htmlFor="ePastorOutro" className="text-white">OUTRO *</Label>
                    <Input 
                      id="ePastorOutro" 
                      name="ePastorOutro" 
                      value={formData.ePastorOutro} 
                      onChange={handleChange} 
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50" 
                      placeholder='Campo obrigatório se não tiver informação digite a letra "N"' 
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FormSection>
  );
};

export default InfoEclesiasticas;