import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Campo de busca que nao trava a tela (13/10/2026, Patrick: "trava muito e
 * demora pra poder digitar"). O texto fica guardado AQUI enquanto a pessoa
 * digita; a pagina so recebe o valor depois de uma pausa (`espera`, em ms) ou
 * no Enter. Antes, cada letra redesenhava a Geracao de Escalas inteira (40
 * tabelas + a fila), e a digitacao ficava atras do dedo.
 *
 * `value`/`onChange` sao os da pagina (o valor "valendo"); se a pagina mudar o
 * valor por fora (ex.: botao de limpar), o campo acompanha.
 */
const CampoBusca = ({ value = '', onChange, espera = 250, onKeyDown, ...props }) => {
  const [texto, setTexto] = useState(value);
  const enviado = useRef(value);
  const timer = useRef(null);

  // A pagina mudou o valor por fora (limpar, trocar de tela...).
  useEffect(() => {
    if (value !== enviado.current) {
      enviado.current = value;
      setTexto(value);
    }
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const enviar = (v) => {
    clearTimeout(timer.current);
    if (v === enviado.current) return;
    enviado.current = v;
    onChange(v);
  };

  return (
    <Input
      {...props}
      value={texto}
      onChange={(e) => {
        const v = e.target.value;
        setTexto(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => enviar(v), espera);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') enviar(e.currentTarget.value);
        onKeyDown?.(e);
      }}
    />
  );
};

export default CampoBusca;
