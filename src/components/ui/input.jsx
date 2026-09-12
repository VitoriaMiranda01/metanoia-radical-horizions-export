import { cn } from '@/lib/utils';
import React from 'react';

// text-base md:text-sm -- 16px no celular, 14px do tablet pra cima.
//
// Nao e escolha de estilo: o Safari do iPhone APROXIMA a pagina sozinho
// quando a pessoa toca num campo com letra menor que 16px, e nao volta
// depois. O resto da navegacao fica torto. 14px (text-sm) ficava exatamente
// abaixo desse limiar.
//
// A correcao mora aqui, e nao numa regra de CSS solta, porque classe do
// Tailwind vence seletor de elemento -- um "input { font-size: 16px }" no
// index.css perde para o text-sm da propria classe e nao faz nada.
//
// Tambem NAO usamos maximum-scale=1 / user-scalable=no no viewport: isso
// tiraria o zoom com os dedos (ruim para quem enxerga pouco) e o Safari
// ignora essa instrucao desde o iOS 10.
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };