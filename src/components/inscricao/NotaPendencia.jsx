import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * Nota embaixo do campo com pendencia da ficha anterior (04/11/2026).
 * `pendencias` = lista de pendenciasDoFormulario; mostra as do `campo`.
 * Some sozinha quando a pessoa corrige (a lista e recalculada).
 */
const NotaPendencia = ({ pendencias, campo }) => {
  const daqui = (pendencias || []).filter((p) => p.campo === campo);
  if (!daqui.length) return null;
  return (
    <div className="space-y-1">
      {daqui.map((p) => (
        <p
          key={p.chave}
          className={`text-xs flex items-start gap-1.5 ${p.bloqueia ? 'text-red-300' : 'text-amber-300'}`}
        >
          {p.bloqueia
            ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span>{p.texto}</span>
        </p>
      ))}
    </div>
  );
};

export default NotaPendencia;
