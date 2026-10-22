import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { revelarArea } from '@/services/equipantesService';
import AreasReveladas from './AreasReveladas';
import GrupoEquipante from './GrupoEquipante';

/**
 * A area na escala OFICIAL (15/10/2026, Patrick): aparece direto, sem o
 * misterio da provisoria. Vem do servidor, como a revelacao -- se a pessoa
 * mudou de area depois da provisoria, e a nova que aparece.
 */
const AreaOficial = ({ equipanteId, dono, onVisto, onPendencias }) => {
  const [estado, setEstado] = useState({ carregando: true });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await revelarArea(equipanteId, dono);
        if (!vivo) return;
        if (r?.pendencias?.length) { onPendencias?.(r.pendencias); return; }
        if (!r?.ok) { setEstado({ erro: r?.erro || 'Não foi possível buscar a sua área.' }); return; }
        if (!r.areas?.length) {
          setEstado({ erro: 'Seu nome não saiu na escala oficial, procure a coordenação do projeto.' });
          return;
        }
        setEstado({ areas: r.areas, extras: r.extras || [] });
        onVisto?.();
      } catch (e) {
        if (vivo) setEstado({ erro: e.message });
      }
    })();
    return () => { vivo = false; };
  }, [equipanteId, dono?.cpf, dono?.nome, dono?.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black p-6">
      {estado.carregando && (
        <div className="flex items-center justify-center gap-2 text-gray-300 py-4">
          <Loader2 className="w-5 h-5 animate-spin" /> Buscando a sua área...
        </div>
      )}
      {estado.erro && <p className="text-center text-sm text-gray-300">{estado.erro}</p>}
      {estado.areas && (
        <>
          <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-500 mb-4">
            {estado.areas.length > 1 ? 'Suas áreas na escala oficial' : 'Sua área na escala oficial'}
          </p>
          <AreasReveladas areas={estado.areas} extras={estado.extras} animado={false} />
          <div className="mt-5"><GrupoEquipante equipanteId={equipanteId} dono={dono} areas={estado.areas} /></div>
        </>
      )}
    </div>
  );
};

export default AreaOficial;
