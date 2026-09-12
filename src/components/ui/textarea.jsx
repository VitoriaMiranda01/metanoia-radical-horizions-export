import { cn } from '@/lib/utils';
import React from 'react';

// text-base md:text-sm -- 16px no celular, 14px do tablet pra cima. Mesmo
// motivo do Input: com menos de 16px o Safari do iPhone aproxima a pagina
// sozinha ao tocar no campo e nao volta. Ver o comentario em input.jsx.
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
