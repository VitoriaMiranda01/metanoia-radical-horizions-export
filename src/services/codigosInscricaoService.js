import { supabase } from '@/services/supabaseClient';

/**
 * Codigo de inscricao do equipante (07/11/2026, migration 20261107a).
 * A organizacao passa o codigo na reuniao (ou a quem nao pode ir); sem ele o
 * equipante nao se inscreve para todos os dias. Quem barra de verdade e
 * criar_inscricao; a tela so confere antes para nao deixar a pessoa preencher
 * tudo a toa.
 */
const chamar = async (funcao, parametros) => {
  const { data, error } = await supabase.rpc(funcao, parametros);
  if (error) throw error;
  return data;
};

export const conferirCodigoInscricao = (codigo) =>
  chamar('codigo_inscricao_conferir', { p_codigo: codigo });

export const listarCodigosInscricao = () => chamar('codigos_inscricao_listar');

export const criarCodigoInscricao = (codigo) =>
  chamar('codigo_inscricao_criar', { p_codigo: codigo });

export const ativarCodigoInscricao = (id, ativo) =>
  chamar('codigo_inscricao_ativar', { p_id: id, p_ativo: ativo });

export const excluirCodigoInscricao = (id) =>
  chamar('codigo_inscricao_excluir', { p_id: id });
