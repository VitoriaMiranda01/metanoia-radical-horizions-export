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

export const fetchAcampantesRaw = async () => {
  return supabase.from('acampantes').select('*');
};

const GRUPOS_TRILHA = ['Vermelho', 'Amarelo', 'Verde', 'Azul', 'Roxo'];

// Escolhe, entre os 5 grupos fixos, o que tem menos integrantes aprovados do mesmo
// sexo do acampante que está sendo alocado agora. Só é chamada uma vez por pessoa,
// no momento da aprovação (ver updateAcampanteStatus abaixo) — quem já tem grupo
// nunca é realocado.
const escolherGrupoTrailha = async (sexo) => {
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

export const updateAcampanteStatus = async (id, newStatus) => {
  const updatePayload = { status: newStatus };

  if (newStatus === 'aprovado') {
    try {
      const { data: atual, error: erroConsulta } = await supabase
        .from('acampantes')
        .select('sexo, grupo_trailha')
        .eq('id', id)
        .single();

      if (erroConsulta) throw erroConsulta;

      // Só aloca grupo se ainda não tiver um salvo (nunca realoca quem já foi definido).
      if (!atual?.grupo_trailha) {
        updatePayload.grupo_trailha = await escolherGrupoTrailha(atual?.sexo);
      }
    } catch (error) {
      console.error('Erro ao alocar grupo de trilha:', error);
      // Não bloqueia a aprovação por causa disso; a pessoa fica sem grupo e pode
      // ser alocada manualmente depois.
    }
  }

  return supabase.from('acampantes').update(updatePayload).eq('id', id);
};

export const countAcampantes = async () => {
  return supabase.from('acampantes').select('*', { count: 'exact', head: true });
};
