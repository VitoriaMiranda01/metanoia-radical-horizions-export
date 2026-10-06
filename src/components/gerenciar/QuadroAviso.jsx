import React, { useLayoutEffect, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Moldura comum dos avisos de Gerenciar Inscricoes (telefones, contato de
 * emergencia): titulo, explicacao, botao Ocultar e a lista com rolagem --
 * mostra 2 fichas por vez, para o quadro nao ficar comprido (pedido do
 * Patrick, 06/10/2026). A altura e medida na tela (as fichas de cada aviso
 * tem tamanhos diferentes): vai do topo da 1a ao topo da 3a ficha.
 */

const VISIVEIS = 2;

const useAlturaDeDuas = (ref) => {
  const [altura, setAltura] = useState(null);
  useLayoutEffect(() => {
    const lista = ref.current;
    if (!lista) return undefined;
    const medir = () => {
      const filhos = lista.children;
      if (filhos.length <= VISIVEIS) { setAltura(null); return; }
      setAltura(filhos[VISIVEIS].offsetTop - filhos[0].offsetTop - 4);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(lista);
    Array.from(lista.children).forEach((f) => obs.observe(f));
    return () => obs.disconnect();
  });
  return altura;
};

const CORES = {
  amber: { borda: 'border-amber-500/40', fundo: 'bg-amber-950/40', icone: 'text-amber-400', texto: 'text-amber-100/80' },
  orange: { borda: 'border-orange-500/40', fundo: 'bg-orange-950/40', icone: 'text-orange-400', texto: 'text-orange-100/80' },
};

const QuadroAviso = ({ id, cor = 'amber', Icone, titulo, explicacao, onOcultar, ocultas = 0, children }) => {
  const c = CORES[cor] || CORES.amber;
  const listaRef = useRef(null);
  const altura = useAlturaDeDuas(listaRef);
  const total = React.Children.count(children);
  return (
    <div id={id} role="alert" className={cn('mb-6 rounded-lg border p-4 space-y-3 scroll-mt-24', c.borda, c.fundo)}>
      <div className="flex items-start gap-3">
        <Icone className={cn('w-5 h-5 shrink-0 mt-0.5', c.icone)} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold">{titulo}</p>
          <p className={cn('text-sm', c.texto)}>{explicacao}</p>
        </div>
        {onOcultar && (
          <Button
            size="sm" variant="ghost" onClick={onOcultar}
            data-dica="Ocultar este quadro. O aviso continua no sino de notificações, de onde dá para reabrir."
            className="h-8 shrink-0 text-gray-400 hover:text-white hover:bg-white/10"
          >
            <EyeOff className="w-4 h-4 mr-1.5" /> Ocultar
          </Button>
        )}
      </div>
      <div ref={listaRef} className="space-y-2 overflow-y-auto pr-1" style={altura ? { maxHeight: altura } : undefined}>
        {children}
      </div>
      {total > VISIVEIS && (
        <p className="text-[11px] text-gray-400 text-center">Role para ver as outras {total - VISIVEIS} ↓</p>
      )}
      {ocultas > 0 && (
        <p className="text-[11px] text-gray-500 text-center">
          {ocultas === 1
            ? '1 ficha oculta — continua no sino de notificações.'
            : `${ocultas} fichas ocultas — continuam no sino de notificações.`}
        </p>
      )}
    </div>
  );
};

export default QuadroAviso;
