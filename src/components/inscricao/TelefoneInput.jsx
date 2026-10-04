import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { mascararTelefone, problemaTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';

/**
 * Campo de telefone com mascara: vai formatando "(21) 99999-9999" enquanto a
 * pessoa digita, aceita colar "+55 21 ..." ou "021 ..." e nao deixa passar
 * de 11 digitos. Ao sair do campo, avisa embaixo se o numero esta errado.
 *
 * Para estrangeiro (inscricao sem CPF) o campo e livre: o numero de outro
 * pais nao cabe na mascara brasileira.
 *
 * Mantem a mesma assinatura de onChange dos outros campos do formulario
 * ({ target: { name, value } }), entao o handleChange de sempre serve.
 */
const TelefoneInput = ({
  id, name, value, onChange, required = false, aceitaFixo = false, estrangeiro = false,
  placeholder, className,
}) => {
  const [saiu, setSaiu] = useState(false);
  const problema = saiu ? problemaTelefone(value, { aceitaFixo, estrangeiro }) : null;

  const mudar = (e) => {
    const bruto = e.target.value;
    const valor = estrangeiro ? bruto.replace(/[^\d+\s()-]/g, '') : mascararTelefone(bruto);
    onChange({ target: { name, value: valor } });
  };

  return (
    <div className="space-y-1">
      <Input
        id={id}
        name={name}
        value={value || ''}
        onChange={mudar}
        onBlur={() => setSaiu(true)}
        required={required}
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder || (estrangeiro ? '+351 912 345 678' : '(21) 99999-9999')}
        aria-invalid={!!problema}
        className={cn(
          'bg-white/10 border-white/20 text-white placeholder:text-white/50',
          problema && 'border-red-500/70 focus-visible:ring-red-500/40',
          className
        )}
      />
      {problema && <p className="text-xs text-red-300">{problema}</p>}
    </div>
  );
};

export default TelefoneInput;
