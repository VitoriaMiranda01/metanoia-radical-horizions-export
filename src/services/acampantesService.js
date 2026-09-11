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

// O sorteio do grupo de trilha saiu daqui (Passo 2, etapa 5). Era feito no
// navegador e precisava consultar a tabela de acampantes cinco vezes, uma por
// grupo, só para contar quantas pessoas do mesmo sexo havia em cada um — o que
// exigia que o visitante pudesse ler a tabela.
//
// Agora quem sorteia é o servidor, dentro da função criar_inscricao
// (database/migrations/schema-update-20260911b-rpcs-publicas.sql), usando a
// mesma regra: entre os cinco grupos fixos, o que tem menos gente do mesmo sexo.

export const countAcampantes = async () => {
  return supabase.from('acampantes').select('*', { count: 'exact', head: true });
};

// Realoca um acampante ja aprovado pra outro grupo de trilha (organizador
// corrige manualmente pela tela de Gerenciar Inscricoes -- ex: quer colocar
// amigos/familia no mesmo grupo). Diferente da alocacao de equipante em
// area de trabalho, os grupos de trilha nao tem capacidade maxima fixa
// (o sorteio no servidor so tenta balancear por sexo no momento do
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

// Apaga TODOS os registros da tabela acampantes. Usado ao resetar o sistema
// para a proxima edicao (ver handleResetInscricoes em
// OrganizerConfigPage.jsx / Acoes de Risco). Diferente do reset de
// equipantes (que so atualiza o status para forcar nova inscricao), os
// acampantes nao carregam de uma edicao pra outra -- entao aqui a limpeza e
// uma exclusao real e definitiva de todos os registros.
//
// A tabela pagamentos tem uma FK pra acampantes
// (pagamentos_acampante_id_fkey), entao precisa apagar os pagamentos
// ligados a acampantes ANTES de apagar os acampantes -- senao o delete
// falha com "violates foreign key constraint". Decisao combinada com a
// usuaria em 2026-09-09: resetar a edicao apaga o historico de pagamento
// dos acampantes junto (o pagamento de equipante nao e afetado -- so
// acampante e resetado por exclusao real).
export const deleteAllAcampantes = async () => {
  try {
    const { error: pagamentosError } = await supabase
      .from('pagamentos')
      .delete()
      .not('acampante_id', 'is', null);

    if (pagamentosError) throw pagamentosError;

    const { data, error } = await supabase
      .from('acampantes')
      .delete()
      .not('id', 'is', null)
      .select('id');

    if (error) throw error;
    return { success: true, count: data ? data.length : 0 };
  } catch (error) {
    console.error('Erro ao apagar todos os acampantes:', error);
    throw error;
  }
};
