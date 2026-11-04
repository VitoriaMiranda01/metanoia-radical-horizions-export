import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

/**
 * Topo do formulario de reinscricao pelo CPF (04/11/2026, Patrick).
 * Sem pendencia: "so escolha as areas". Com pendencia: lista o que falta
 * corrigir, cada item leva ao campo. Recalculado a cada mudanca.
 */
const QuadroPendencias = ({ pendencias, soDomingo, onIr }) => {
  const lista = pendencias || [];
  const travam = lista.filter((p) => p.bloqueia);
  const avisos = lista.filter((p) => !p.bloqueia);

  if (!travam.length) {
    return (
      <div className="space-y-2">
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-emerald-100 text-sm">
            Trouxemos os seus dados da edição anterior.{' '}
            {soDomingo
              ? 'Confira se algo mudou e envie a inscrição para domingo.'
              : 'Confira se algo mudou e escolha as suas áreas de trabalho desta edição, no fim da página.'}
          </p>
        </div>
        {avisos.length > 0 && <ListaAvisos avisos={avisos} onIr={onIr} />}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-100 text-sm">
            Trouxemos os seus dados da edição anterior, mas a sua ficha tem{' '}
            <strong>{travam.length === 1 ? '1 pendência' : `${travam.length} pendências`}</strong>.
            Corrija os campos marcados em vermelho para a sua ficha ficar pronta
            {soDomingo ? '.' : ' e depois escolha as suas áreas de trabalho.'}
          </p>
        </div>
        <ul className="space-y-1.5 pl-8">
          {travam.map((p) => (
            <li key={p.chave}>
              <button
                type="button"
                onClick={() => onIr(p.campo)}
                className="text-left text-sm text-red-200 underline decoration-red-400/40 hover:text-white"
              >
                {p.texto}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {avisos.length > 0 && <ListaAvisos avisos={avisos} onIr={onIr} />}
    </div>
  );
};

const ListaAvisos = ({ avisos, onIr }) => (
  <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg space-y-1.5">
    {avisos.map((p) => (
      <button
        key={p.chave}
        type="button"
        onClick={() => onIr(p.campo)}
        className="w-full text-left text-sm text-amber-200 flex items-start gap-2 hover:text-white"
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{p.texto}</span>
      </button>
    ))}
  </div>
);

export default QuadroPendencias;
