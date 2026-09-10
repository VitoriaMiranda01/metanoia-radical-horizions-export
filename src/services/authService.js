import { supabase } from '@/services/supabaseClient';
import bcrypt from 'bcryptjs';

export const organizadorLogin = async (nome, senha) => {
  try {
    if (!nome) {
      return { success: false, error: 'Nome de usuário não fornecido.' };
    }

    const trimmedNome = nome.trim();
    
    const { data, error } = await supabase
      .from('organizadores_auth')
      .select('*')
      .ilike('nome', trimmedNome)
      .maybeSingle();

    if (error) {
      // Erros de conexão podem ter mensagem genérica propria (nao revelam usuario)
      if (error.message?.toLowerCase().includes('failed to fetch')) {
        return { success: false, error: 'Falha de conexão com o banco de dados.' };
      }
      // Nao expor detalhes internos (codigo/RLS/mensagem do banco) ao usuario:
      // apenas registrar para depuracao e devolver mensagem generica.
      console.error('[AuthHelper] organizadorLogin - erro na consulta:', error);
      return { success: false, error: 'Não foi possível fazer login. Tente novamente.' };
    }

    // Mensagem unica para "usuario nao existe" e "senha errada", para nao
    // permitir enumeracao de usuarios.
    if (!data) {
      return { success: false, error: 'Usuário ou senha inválidos' };
    }

    const isMatch = await bcrypt.compare(senha, data.senha);

    if (!isMatch) {
      return { success: false, error: 'Usuário ou senha inválidos' };
    }

    return { success: true, user: data };
  } catch (err) {
    console.error('[AuthHelper] Login exception:', err);
    return { success: false, error: 'Erro interno ao tentar realizar login' };
  }
};

export const igrejaLogin = async (codigo, senha) => {
  try {
    const trimmedCodigo = codigo.trim();
    const { data: rows, error } = await supabase
      .from('igrejas_parceiras')
      .select('*')
      .ilike('codigo', trimmedCodigo);

    const data = rows?.[0];

    if (error) {
      console.error('[AuthHelper] igrejaLogin - erro na consulta:', error);
      return { success: false, error: 'Não foi possível fazer login. Tente novamente.' };
    }
    // Mensagem unica para "usuario nao existe" e "senha errada" (sem enumeracao).
    if (!data) return { success: false, error: 'Usuário ou senha inválidos' };

    const isMatch = await bcrypt.compare(senha, data.senha);
    if (!isMatch) return { success: false, error: 'Usuário ou senha inválidos' };

    return { success: true, user: data };
  } catch (err) {
    return { success: false, error: 'Erro ao conectar com banco de dados' };
  }
};
