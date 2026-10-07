import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import TelefoneInput from './TelefoneInput';
import { cn } from '@/lib/utils';
import {
  limparNomeContato, problemaNomeContato, mesmoTelefone, AVISO_MESMO_TELEFONE, mesmoNome, AVISO_MESMO_NOME
} from '@/utils/contatoEmergencia';

// Regras (06/10/2026): nome so com letras; telefone valido e diferente do
// WhatsApp da propria pessoa -- ver utils/contatoEmergencia.js.
const ContatoEmergencia = ({ formData, handleChange }) => {
  const problemaNome = problemaNomeContato(formData.contatoEmergencia)
    || (mesmoNome(formData.contatoEmergencia, formData.nome) ? AVISO_MESMO_NOME : null);
  const repetido = mesmoTelefone(formData.telefoneEmergencia, formData.whatsapp);

  return (
    <FormSection title="Contato de Emergência">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contatoEmergencia" className="text-white">Nome do Contato</Label>
          <Input
            id="contatoEmergencia"
            name="contatoEmergencia"
            value={formData.contatoEmergencia}
            // Numeros e simbolos nem entram: o campo e so para o nome.
            onChange={(e) => handleChange({ target: { name: 'contatoEmergencia', value: limparNomeContato(e.target.value) } })}
            required
            autoComplete="off"
            className={cn('bg-white/10 border-white/20 text-white placeholder:text-white/50',
              problemaNome && 'border-red-500/70')}
            placeholder="Nome de quem avisar (só letras)"
          />
          {problemaNome && <p className="text-xs text-red-300">{problemaNome}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefoneEmergencia" className="text-white">Telefone de Emergência</Label>
          {/* Aceita fixo: o contato de emergencia pode ser o telefone de casa. */}
          <TelefoneInput id="telefoneEmergencia" name="telefoneEmergencia" value={formData.telefoneEmergencia} onChange={handleChange} required aceitaFixo estrangeiro={!!formData.semCpf}
            className={repetido ? 'border-red-500/70' : undefined} />
          {repetido && <p className="text-xs text-red-300">{AVISO_MESMO_TELEFONE}</p>}
        </div>
      </div>
    </FormSection>
  );
};

export default ContatoEmergencia;
