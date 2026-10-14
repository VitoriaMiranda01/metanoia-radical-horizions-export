import React, { useState } from 'react';
import { Select } from '@/components/ui/select';

/**
 * Select que so monta as opcoes com o menu ABERTO (14/10/2026).
 *
 * O Select do Radix monta todas as opcoes mesmo fechado (num pedaco de
 * pagina invisivel, para achar o texto do valor escolhido). Na Geracao de
 * Escalas sao ~900 linhas, cada uma com ate 3 menus (atuacao, cor e "Mover
 * para..." com ~45 areas): dezenas de milhares de elementos invisiveis. No
 * iPhone a pagina ficava sem memoria e o Safari a derrubava ("Um problema
 * ocorreu repetidamente").
 *
 * Uso: children e uma funcao que recebe `aberto`. Fechado, monte so a opcao
 * escolhida (para o SelectValue continuar mostrando o texto) ou nada.
 *
 *   <SelectSobDemanda value={v} onValueChange={...}>
 *     {(aberto) => (<>
 *       <SelectTrigger>...</SelectTrigger>
 *       <SelectContent>{(aberto ? todas : escolhida).map(...)}</SelectContent>
 *     </>)}
 *   </SelectSobDemanda>
 */
const SelectSobDemanda = ({ children, onOpenChange, ...props }) => {
  const [aberto, setAberto] = useState(false);
  return (
    <Select {...props} open={aberto} onOpenChange={(v) => { setAberto(v); onOpenChange?.(v); }}>
      {children(aberto)}
    </Select>
  );
};

export default SelectSobDemanda;
