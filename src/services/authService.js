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
      // Connection/Fetch errors
      if (error.message?.toLowerCase().includes('failed to fetch')) {
        return { success: false, error: 'Falha de conexão com o banco de dados.' };
      }
      // RLS Errors
      if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied') || error.message?.toLowerCase().includes('rls')) {
        return { success: false, error: 'Erro de permissão no banco de dados (RLS).' };
      }

      return { success: false, error: `Erro na consulta: ${error.message}` };
    }

    if (!data) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const isMatch = await bcrypt.compare(senha, data.senha);
    
    if (!isMatch) {
      return { success: false, error: 'Senha incorreta' };
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

    if (error) return { success: false, error: 'Erro ao conectar com banco de dados' };
    if (!data) return { success: false, error: 'Usuário não encontrado' };

    const isMatch = await bcrypt.compare(senha, data.senha);
    if (!isMatch) return { success: false, error: 'Senha incorreta' };

    return { success: true, user: data };
  } catch (err) {
    return { success: false, error: 'Erro ao conectar com banco de dados' };
  }
};

export const fetchUserRole = async (email) => {
  return supabase.from('users').select('role').eq('email', email).single();
};
