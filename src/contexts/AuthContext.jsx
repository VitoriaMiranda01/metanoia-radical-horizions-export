import React, { createContext, useContext, useState, useEffect } from 'react';
import { organizadorLogin, igrejaLogin } from '@/services/authService';
import { setAuthToken, clearAuthToken, getAuthToken } from '@/services/authToken';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organizadorUser, setOrganizadorUser] = useState(null);
  const [igrejaUser, setIgrejaUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // As chamadas a supabase.auth.* sairam daqui (Passo 2, etapa 6).
  //
  // Elas eram vestigiais: este projeto nunca usou Supabase Auth. Ninguem
  // nunca se cadastrou por la, entao getSession() sempre devolvia sessao
  // nula, onAuthStateChange nunca disparava e signOut() nao fazia nada.
  //
  // Agora elas atrapalhariam: o cliente e criado com a opcao "accessToken"
  // (ver supabaseClient.js), para mandar o cracha do nosso proprio login
  // nas consultas -- e nesse modo a biblioteca desabilita o namespace
  // supabase.auth. A sessao sempre veio do localStorage, e continua vindo.
  useEffect(() => {
    try {
      // getAuthToken devolve null e limpa a sessão inteira quando o crachá
      // está vencido ou ilegível (ver authToken.js). Sem crachá válido não
      // adianta restaurar a sessão: as telas abririam vazias, sem explicação.
      // Melhor cair no login, que é um problema óbvio e de solução óbvia.
      if (!getAuthToken()) {
        setLoading(false);
        return;
      }

      const savedUser = localStorage.getItem('metanoia_user');
      const savedOrg = localStorage.getItem('metanoia_org_user');
      const savedIgreja = localStorage.getItem('metanoia_igreja_user');

      if (savedUser) setUser(JSON.parse(savedUser));
      if (savedOrg) setOrganizadorUser(JSON.parse(savedOrg));
      if (savedIgreja) setIgrejaUser(JSON.parse(savedIgreja));
    } catch (err) {
      console.error('AuthContext - leitura da sessão salva', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (identifier, password, type) => {
    return { success: false, error: 'Use os novos métodos de login' };
  };

  const loginAsOrganizador = async (nome, senha) => {
    try {
      const result = await organizadorLogin(nome.trim(), senha);
      
      if (result.success) {
        const sessionUser = { ...result.user, role: result.user?.role || 'organizador' };

        // Cracha assinado pelo servidor. Guardado agora; passa a ser usado nas
        // consultas ao banco no Passo 2 (junto com o travamento por RLS).
        setAuthToken(result.token);

        setOrganizadorUser(sessionUser);
        setUser(sessionUser);
        localStorage.setItem('metanoia_org_user', JSON.stringify(sessionUser));
        localStorage.setItem('metanoia_user', JSON.stringify(sessionUser));
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('AuthContext - loginAsOrganizador', err);
      throw err;
    }
  };

  const loginAsIgreja = async (codigo, senha) => {
    try {
      const result = await igrejaLogin(codigo.trim(), senha);
      if (result.success) {
        const sessionUser = { ...result.user, role: 'parceiro' };
        setAuthToken(result.token);
        setIgrejaUser(sessionUser);
        setUser(sessionUser);
        localStorage.setItem('metanoia_igreja_user', JSON.stringify(sessionUser));
        localStorage.setItem('metanoia_user', JSON.stringify(sessionUser));
        return result;
      }
      throw new Error(result.error);
    } catch (err) {
      console.error('AuthContext - loginAsIgreja', err);
      throw err;
    }
  };

  const logoutOrganizador = () => {
    setOrganizadorUser(null);
    if (user?.role === 'organizador') setUser(null);
    localStorage.removeItem('metanoia_org_user');
    localStorage.removeItem('metanoia_user');
    clearAuthToken();
  };

  const logoutIgreja = () => {
    setIgrejaUser(null);
    if (user?.role === 'parceiro') setUser(null);
    localStorage.removeItem('metanoia_igreja_user');
    localStorage.removeItem('metanoia_user');
    clearAuthToken();
  };

  const logout = async () => {
    logoutOrganizador();
    logoutIgreja();
  };

  const value = {
    user,
    organizadorUser,
    igrejaUser,
    organizadorId: organizadorUser?.id || user?.id,
    login,
    loginAsOrganizador,
    loginAsIgreja,
    logout,
    logoutOrganizador,
    logoutIgreja,
    loading,
    isAuthenticated: !!user || !!organizadorUser || !!igrejaUser,
    isOrganizador: !!organizadorUser || user?.role === 'organizador',
    isAprovador: !!organizadorUser || user?.role === 'organizador' || user?.role === 'organizador-aprovador',
    isParceiro: !!igrejaUser || user?.role === 'parceiro'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};