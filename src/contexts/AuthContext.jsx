import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { organizadorLogin, igrejaLogin } from '@/lib/authHelpers';

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

  useEffect(() => {
    // Carrega sessões salvas do localStorage
    const savedUser = localStorage.getItem('metanoia_user');
    const savedOrg = localStorage.getItem('metanoia_org_user');
    const savedIgreja = localStorage.getItem('metanoia_igreja_user');
    
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedOrg) setOrganizadorUser(JSON.parse(savedOrg));
    if (savedIgreja) setIgrejaUser(JSON.parse(savedIgreja));
    
    // Tenta sincronizar com a sessão nativa do Supabase também
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !savedUser) {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !localStorage.getItem('metanoia_user')) {
        setUser(session.user);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const login = async (identifier, password, type) => {
    return { success: false, error: 'Use os novos métodos de login' };
  };

  const loginAsOrganizador = async (nome, senha) => {
    try {
      const result = await organizadorLogin(nome.trim(), senha);
      
      if (result.success) {
        const sessionUser = { ...result.user, role: 'organizador' };
        
        setOrganizadorUser(sessionUser);
        setUser(sessionUser);
        localStorage.setItem('metanoia_org_user', JSON.stringify(sessionUser));
        localStorage.setItem('metanoia_user', JSON.stringify(sessionUser));
        
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('[AuthContext] Login as organizador failed:', err.message);
      throw err;
    }
  };

  const loginAsIgreja = async (codigo, senha) => {
    const result = await igrejaLogin(codigo.trim(), senha);
    if (result.success) {
      const sessionUser = { ...result.user, role: 'parceiro' };
      setIgrejaUser(sessionUser);
      setUser(sessionUser);
      localStorage.setItem('metanoia_igreja_user', JSON.stringify(sessionUser));
      localStorage.setItem('metanoia_user', JSON.stringify(sessionUser));
      return result;
    }
    throw new Error(result.error);
  };

  const logoutOrganizador = () => {
    setOrganizadorUser(null);
    if (user?.role === 'organizador') setUser(null);
    localStorage.removeItem('metanoia_org_user');
    localStorage.removeItem('metanoia_user');
  };

  const logoutIgreja = () => {
    setIgrejaUser(null);
    if (user?.role === 'parceiro') setUser(null);
    localStorage.removeItem('metanoia_igreja_user');
    localStorage.removeItem('metanoia_user');
  };

  const logout = async () => {
    logoutOrganizador();
    logoutIgreja();
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  };

  const value = {
    user,
    organizadorUser,
    igrejaUser,
    // Extrai explicitamente o ID do organizador autenticado para facilitar o uso
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