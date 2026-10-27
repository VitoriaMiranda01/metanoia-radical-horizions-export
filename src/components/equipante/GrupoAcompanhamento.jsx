import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { fetchGruposEquipante } from '@/services/equipantesService';
import GrupoEquipante from './GrupoEquipante';

/**
 * Grupo de WhatsApp no acompanhamento (21/10/2026, Patrick).
 *  - modo "provisoria": abaixo do botao da area. O botao so aparece para quem
 *    esta PRESENTE (quem nao esta, so e convidado a mao pelo lider).
 *  Na escala oficial quem mostra a area e o grupo e o AreaOficial, direto
 *  abaixo da etapa "Escala oficial" (21/10/2026).
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

  // 27/10/2026: o fotografo com cor pode ter so o link do grupo da trilha.
  const semLink = areas.every((a) => !a.grupo_link && !a.grupo_trilha?.link);
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
