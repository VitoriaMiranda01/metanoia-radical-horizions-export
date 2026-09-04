import { supabase } from '@/services/supabaseClient';
import { toast } from '@/components/ui/use-toast';

// Deleta um acampante
export const deleteAcampante = async (acampanteId, user) => {
  try {
    if (!navigator.onLine) {
      throw new Error("Você está offline. Verifique sua conexão.");
    }

    const { error } = await supabase
      .from('acampantes')
      .delete()
      .eq('id', acampanteId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar acampante:', error);
    return { success: false, error: error.message || "Erro ao excluir registro." };
  }
};

export const getAcampantes = async () => {
  try {
    if (!navigator.onLine) {
      console.warn("Offline mode: Cannot fetch acampantes.");
      return [];
    }

    let query = supabase
      .from('acampantes')
      .select('*')
    const { data, error } = await query;

    if (error) throw error;
    
    // Map data to ensure nome_completo fallback
    return (data || []).map(a => ({
      ...a,
      nome_completo: a.nome_completo || a.nome
    }));
  } catch (error) {
    console.error('Erro ao buscar acampantes:', error);
    toast({
      title: "Erro de Conexão",
      description: "Não foi possível carregar os dados. Verifique sua conexão.",
      variant: "destructive"
    });
    return [];
  }
};

const GRUPOS_TRILHA = ['Vermelho', 'Amarelo', 'Verde', 'Azul', 'Roxo'];

// Escolhe, entre os 5 grupos fixos, o que tem menos integrantes do mesmo
// sexo do acampante que está sendo alocado agora. Chamada uma vez por pessoa, no
// momento do cadastro (ver criarInscricao em inscricoesService.js) — acampante já
// nasce com status 'aprovado' e não passa por uma aprovação manual separada, então
// não há mais necessidade de filtrar por status aqui.
export const escolherGrupoTrailha = async (sexo) => {
  let grupoEscolhido = GRUPOS_TRILHA[0];
  let menorContagem = Infinity;

  for (const grupo of GRUPOS_TRILHA) {
    const { count, error } = await supabase
      .from('acampantes')
      .select('*', { count: 'exact', head: true })
      .eq('grupo_trailha', grupo)
      .eq('sexo', sexo);

    if (error) throw error;

    if ((count || 0) < menorContagem) {
      menorContagem = count || 0;
      grupoEscolhido = grupo;
    }
  }

  return grupoEscolhido;
};

export const countAcampantes = async () => {
  return supabase.from('acampantes').select('*', { count: 'exact', head: true });
};

// Realoca um acampante ja aprovado pra outro grupo de trilha (organizador
// corrige manualmente pela tela de Gerenciar Inscricoes -- ex: quer colocar
// amigos/familia no mesmo grupo). Diferente da alocacao de equipante em
// area de trabalho, os grupos de trilha nao tem capacidade maxima fixa
// (escolherGrupoTrailha, acima, so tenta balancear por sexo no momento do
// cadastro) -- por isso aqui e so um UPDATE direto na coluna
// grupo_trailha, sem trava de concorrencia/capacidade no banco.
export const realocarGrupoTrailha = async (acampanteId, novoGrupo) => {
  if (!acampanteId || !novoGrupo) {
    return { success: false, error: 'Acampante ou grupo não informados' };
  }

  try {
    const { error } = await supabase
      .from('acampantes')
      .update({ grupo_trailha: novoGrupo })
      .eq('id', acampanteId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('acampantesApi - realocarGrupoTrailha', error, { acampanteId, novoGrupo });
    return { success: false, error: error.message || 'Erro ao tentar realocar grupo de trilha.' };
  }
};

// Salva a observacao breve que o organizador escreveu sobre um acampante
// (campo livre no card dele, dentro do modal de um grupo de trilha).
// Coluna acampantes.observacoes_organizador -- ver migration
// schema-update-20260903-observacoes-acampante.sql.
export const salvarObservacaoAcampante = async (acampanteId, observacao) => {
  if (!acampanteId) {
    return { success: false, error: 'Acampante não informado' };
  }

  try {
    const { error } = await supabase
      .from('acampantes')
      .update({ observacoes_organizador: observacao || null })
      .eq('id', acampanteId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('acampantesApi - salvarObservacaoAcampante', error, { acampanteId });
    return { success: false, error: error.message || 'Erro ao tentar salvar a observação.' };
  }
};
