import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Infiltrados nos grupos de trilha (Patrick, 12/10/2026) -- migration
 * 20261012b. Sao EQUIPANTES escalados em "Infiltrados" com a cor do grupo;
 * so aparecem depois da escala oficial lancada. Viram "participantes" dos
 * grupos e dos onibus com o mesmo formato de um acampante (sigilo: nada no
 * que e impresso/exportado os diferencia), mas com infiltrado = true para a
 * tela do organizador saber quem e e para trocar o grupo pela escala.
 */
export const fetchInfiltradosNosGrupos = async () => {
  const { data, error } = await comReenvio(() => supabase.rpc('infiltrados_nos_grupos'), { rotulo: 'infiltrados' });
  if (error) return { success: false, error: error.message, oficial: false, infiltrados: [], paraVinculos: [], semCor: 0 };
  const lista = Array.isArray(data?.infiltrados) ? data.infiltrados : [];
  // Para os vinculos (23/10/2026, migration 20261023a): todos os escalados em
  // Infiltrados desde a escala PROVISORIA, com ou sem cor.
  const paraVinculos = Array.isArray(data?.para_vinculos) ? data.para_vinculos : lista;
  const comoParticipante = (i) => ({
      id: i.id,
      escala_id: i.escala_id,
      nome: i.nome,
      sexo: i.sexo,
      cpf: i.cpf,
      whatsapp: i.whatsapp,
      nacionalidade: i.nacionalidade,
      igreja: i.igreja,
      grupo_trailha: i.cor,
      infiltrado: true,
  });
  return {
    success: true,
    oficial: !!data?.oficial,
    semCor: Number(data?.sem_cor) || 0,
    infiltrados: lista.map(comoParticipante),
    paraVinculos: paraVinculos.map(comoParticipante),
  };
};
