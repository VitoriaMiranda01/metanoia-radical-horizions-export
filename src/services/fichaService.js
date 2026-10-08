import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';
import { updateAcampante } from '@/services/acampantesService';
import { updateEquipante } from '@/services/equipantesService';

/**
 * Uma ficha de inscricao inteira (acampante ou equipante), para abrir de
 * qualquer tela -- ex.: o icone ao lado do nome em Pagamentos (08/10/2026).
 * Devolve a ficha com `tipo`, no formato que InscricaoDetalhesModal e
 * EditarInscricaoModal esperam.
 */
export const fetchFicha = async (tipo, id) => {
  const tabela = tipo === 'equipante' ? 'equipantes' : 'acampantes';
  const { data, error } = await comReenvio(
    () => supabase.from(tabela).select('*, idade').eq('id', id).maybeSingle(),
    { rotulo: 'ficha de inscrição' }
  );
  if (error) throw new Error(error.message || 'Erro ao abrir a ficha');
  if (!data) throw new Error('Ficha não encontrada.');
  return { ...data, tipo: tipo === 'equipante' ? 'equipante' : 'acampante' };
};

// Mesmo caminho do "Editar" de Gerenciar Inscricoes.
export const salvarFicha = (tipo, id, dados) =>
  (tipo === 'equipante' ? updateEquipante(id, dados) : updateAcampante(id, dados));
