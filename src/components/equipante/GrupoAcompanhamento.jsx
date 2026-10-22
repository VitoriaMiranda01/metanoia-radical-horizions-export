import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { fetchGruposEquipante } from '@/services/equipantesService';
import GrupoEquipante from './GrupoEquipante';

/**
 * Grupo de WhatsApp no acompanhamento (21/10/2026, Patrick).
 *  - modo "provisoria": abaixo do botao da area. O botao so aparece para quem
 *    esta PRESENTE (quem nao esta, so e convidado a mao pelo lider).
 *  - modo "oficial": etapa "Escala oficial" abaixo da taxa de alimentacao, ja
 *    concluida, com a area de trabalho explicita e o grupo daquela area.
 * Quem decide o que aparece e o servidor (equipante_grupos).
 */
const GrupoAcompanhamento = ({ equipanteId, dono, modo, recarregarCom }) => {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetchGruposEquipante(equipanteId, dono);
      if (vivo && r?.ok) setDados(r);
    })();
    return () => { vivo = false; };
  }, [equipanteId, dono?.cpf, dono?.nome, dono?.nascimento, recarregarCom]); // eslint-disable-line react-hooks/exhaustive-deps

  const areas = dados?.areas || [];
  if (areas.length === 0) return null;

  if (modo === 'oficial') {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            {areas.length > 1 ? 'Suas áreas de trabalho' : 'Sua área de trabalho'}
          </p>
          {areas.map((a) => (
            <p key={a.escala_id} className="text-xl font-extrabold uppercase text-white">
              {a.area}{a.cor ? <span className="text-sm font-semibold normal-case text-gray-300"> · {a.cor}</span> : null}
              {a.atuacao && !(a.eh_lider && a.atuacao === 'Líder')
                ? <span className="block text-sm font-normal normal-case text-gray-400">{a.atuacao}</span> : null}
            </p>
          ))}
        </div>
        <GrupoEquipante equipanteId={equipanteId} dono={dono} areas={areas} />
      </div>
    );
  }

  const semLink = areas.every((a) => !a.grupo_link);
  const algumPresente = areas.some((a) => a.presente === true);
  if (!semLink) {
    return <div className="pt-1"><GrupoEquipante equipanteId={equipanteId} dono={dono} areas={areas} /></div>;
  }
  if (algumPresente) return null; // presente, mas o lider ainda nao salvou o link
  return (
    <p className="text-xs text-gray-400 flex items-start gap-1.5 justify-center text-center">
      <MessageCircle className="w-4 h-4 shrink-0 text-[#25D366]" />
      O botão do grupo de WhatsApp da sua área aparece aqui quando a sua presença for confirmada.
    </p>
  );
};

export default GrupoAcompanhamento;
