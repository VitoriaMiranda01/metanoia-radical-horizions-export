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

export const updateAcampanteStatus = async (id, newStatus) => {
  return supabase.from('acampantes').update({ status: newStatus }).eq('id', id);
};

export const countAcampantes = async () => {
  return supabase.from('acampantes').select('*', { count: 'exact', head: true });
};
