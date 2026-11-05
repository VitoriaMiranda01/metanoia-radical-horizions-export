import { supabase } from '@/services/supabaseClient';

/**
 * Ocorrencias anteriores (05/11/2026, migration 20261105e).
 * Pessoas com quem ja houve problema na portaria: comunicado ao digitar o CPF,
 * asterisco vermelho para organizadores e Apoio da portaria, modulo em
 * Configuracoes. Quem decide e o banco; a tela so mostra.
 */
const chamar = async (funcao, parametros) => {
  const { data, error } = await supabase.rpc(funcao, parametros);
  if (error) throw error;
  return data;
};

export const comunicadoDoCpf = (cpf) => chamar('comunicado_do_cpf', { p_cpf: cpf });

export const declararCiencia = (cpf, frase) =>
  chamar('comunicado_declarar', { p_cpf: cpf, p_frase: frase });

export const fetchMarcasOcorrencia = () => chamar('ocorrencias_marcas');

export const listarOcorrencias = () => chamar('ocorrencias_listar');

export const salvarOcorrencia = ({ id, cpf, nome, texto, repeticoes, aPartirEdicao }) =>
  chamar('ocorrencia_salvar', {
    p_id: id || null,
    p_cpf: cpf,
    p_nome: nome,
    p_texto: texto,
    p_repeticoes: repeticoes,
    p_a_partir_edicao: aPartirEdicao,
  });

export const excluirOcorrencia = (id) => chamar('ocorrencia_excluir', { p_id: id });
