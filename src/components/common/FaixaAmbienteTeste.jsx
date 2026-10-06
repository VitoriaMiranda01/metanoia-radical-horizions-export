import React, { useEffect } from 'react';
import { FlaskConical, LogOut } from 'lucide-react';
import { emTeste, sairDoTeste } from '@/services/ambiente';

/**
 * Faixa laranja fixa no pe de todas as telas quando o site esta no ambiente
 * de teste (services/ambiente.js). Ninguem pode confundir o teste com o
 * sistema de verdade.
 */
const FaixaAmbienteTeste = () => {
  const ativo = emTeste();

  // Abre espaco no fim da pagina para a faixa nao cobrir botoes.
  useEffect(() => {
    if (!ativo) return undefined;
    const antes = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '56px';
    return () => { document.body.style.paddingBottom = antes; };
  }, [ativo]);

  if (!ativo) return null;

  return (
    <div
      role="status"
      className="fixed bottom-0 inset-x-0 z-[9999] bg-orange-500 text-black shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
    >
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold min-w-0">
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span className="truncate">
            AMBIENTE DE TESTE — nada aqui vale de verdade. O PIX é simulado.
          </span>
        </p>
        <button
          type="button"
          onClick={sairDoTeste}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-black/80 px-3 py-1.5 text-xs font-semibold text-orange-200 hover:bg-black"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair do teste
        </button>
      </div>
    </div>
  );
};

export default FaixaAmbienteTeste;
