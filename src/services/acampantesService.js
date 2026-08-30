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

// Escolhe, entre os 5 grupos fixos, o que tem menos integrantes aprovados do mesmo
// sexo do acampante que está sendo alocado agora. Chamada uma vez por pessoa, no
// momento do cadastro (ver criarInscricao em inscricoesService.js) — acampante já
// nasce com status 'aprovado' e não passa por uma aprovação manual separada.
export const escolherGrupoTrailha = async (sexo) => {
  let grupoEscolhido = GRUPOS_TRILHA[0];
  let menorContagem = Infinity;

  for (const grupo of GRUPOS_TRILHA) {
    const { count, error } = await supabase
      .from('acampantes')
      .select('*', { count: 'exact', head: true })
      .eq('grupo_trailha', grupo)
      .eq('sexo', sexo)
      .eq('status', 'aprovado');

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
