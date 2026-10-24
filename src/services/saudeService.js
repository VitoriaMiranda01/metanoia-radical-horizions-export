import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Tela da saude (login de apoio, 09/10/2026).
 *
 * A lider da saude nao le nenhuma tabela direto: o banco entrega, pela funcao
 * saude_acampantes(), so os campos que a tela usa (saude, medicamentos,
 * restricao alimentar, contato de emergencia, idade, grupo de trilha...).
 */
export const fetchSaudeAcampantes = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('saude_acampantes'),
    { rotulo: 'dados de saúde' }
  );
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar os dados de saúde.');
  return data.acampantes || [];
};

// ---- Equipe da Saude (18/10/2026) ------------------------------------------
// Quem esta escalado em "Primeiros socorros - Saude", com a especialidade de
// cada um e o grupo do WhatsApp da equipe. Login Apoio da saude e organizador.
export const fetchSaudeEquipe = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('saude_equipe'),
    { rotulo: 'equipe da saúde' }
  );
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar a equipe da saúde.');
  return { equipe: data.equipe || [], grupoLink: data.grupo_link || null, lancada: data.lancada !== false };
};

// A lider da Saude (ou organizador) corrige a especialidade de alguem.
// adicionais (24/10/2026): as demais especialidades marcadas.
export const definirEspecialidadeSaude = async (equipanteId, especialidade, outro, adicionais = []) => {
  const { data, error } = await supabase.rpc('definir_especialidade_saude', {
    p_equipante_id: equipanteId, p_especialidade: especialidade || null, p_outro: outro || null,
    p_adicionais: adicionais || [],
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível salvar a especialidade.');
  return data;
};

// O que foi escrito em "Outro", agrupado, para virar opcao fixa.
export const fetchEspecialidadesOutros = async () => {
  const { data, error } = await supabase.rpc('especialidades_saude_outros');
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar.');
  return data.outros || [];
};

export const tornarEspecialidadeFixa = async (texto, nome = null) => {
  const { data, error } = await supabase.rpc('tornar_especialidade_fixa', { p_texto: texto, p_nome: nome });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível tornar fixa.');
  return data;
};
