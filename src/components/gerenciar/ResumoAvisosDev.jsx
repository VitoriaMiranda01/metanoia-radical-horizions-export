import React from 'react';
import { Info } from 'lucide-react';

/**
 * O que a conta Desenvolvedores ve no lugar dos quadros de aviso (pedido do
 * Patrick, 06/10/2026): so um resumo de que os avisos estao no perfil da
 * Raquel, para ela verificar. Sem lista e sem edicao.
 */
const ResumoAvisosDev = ({ avisos }) => {
  const comItens = avisos.filter((a) => a.itens.length > 0);
  if (comItens.length === 0) return null;
  return (
    <div className="mb-6 rounded-lg border border-sky-500/30 bg-sky-950/30 p-4 flex items-start gap-3">
      <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="text-white font-semibold">Avisos no perfil da Raquel</p>
        <p className="text-sky-100/80">Isso está no perfil da Raquel para ela verificar e corrigir:</p>
        <ul className="mt-1 list-disc pl-5 text-sky-100/90">
          {comItens.map((a) => <li key={a.chave}>{a.titulo}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default ResumoAvisosDev;
