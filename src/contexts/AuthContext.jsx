import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { organizadorLogin, igrejaLogin } from '@/services/authService';

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
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Carrega sessões salvas do localStorage
        const savedUser = localStorage.getItem('metanoia_user');
        const savedOrg = localStorage.getItem('metanoia_org_user');
        const savedIgreja = localStorage.getItem('metanoia_igreja_user');
        
        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedOrg) setOrganizadorUser(JSON.parse(savedOrg));
        if (savedIgreja) setIgrejaUser(JSON.parse(savedIgreja));
        
        // Tenta sincronizar com a sessão nativa do Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (mounted && session?.user && !savedUser) {
          setUser(session.user);
        }
      } catch (err) {
        console.error('AuthContext - Initialization', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !localStorage.getItem('metanoia_user')) {
        setUser(session.user);
      } else if (!session?.user && _event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
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
      console.error('AuthContext - loginAsOrganizador', err);
      throw err;
    }
  };

  const loginAsIgreja = async (codigo, senha) => {
    try {
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
    } catch (e) {
      console.error('AuthContext - logout', e);
    }
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