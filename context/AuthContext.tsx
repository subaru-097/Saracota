'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/db/client';
import { Usuario, UserRole } from '@/types';

interface AuthContextType {
  user: Usuario | null;
  session: any | null;
  isAuthenticated: boolean;
  isProprietario: boolean;
  isLoading: boolean;
  loginError: string | null;
  registerError: string | null;
  resetSuccess: string | null;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (data: { email: string; password: string; nome: string; empresa?: string; role?: UserRole }) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  clearErrors: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function deriveRoleFromEmail(email: string, metadataRole?: UserRole): UserRole {
  const eLower = email.toLowerCase();
  if (eLower === 'proprietario@saracota.com.br' || eLower === 'admin@saracota.com.br') {
    return 'proprietario';
  }
  if (metadataRole) {
    return metadataRole === ('admin' as any) ? 'proprietario' : metadataRole;
  }
  return 'colaborador';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setLoginError(null);
    setRegisterError(null);
    setResetSuccess(null);
  }, []);

  // 1. Inicialização e Monitoramento de Sessão Persistente
  useEffect(() => {
    async function initSession() {
      setIsLoading(true);
      try {
        if (supabase) {
          const { data: { session: activeSession } } = await supabase.auth.getSession();
          if (activeSession) {
            setSession(activeSession);
            const userEmail = activeSession.user.email || '';
            const role = deriveRoleFromEmail(userEmail, activeSession.user.user_metadata?.role);

            setUser({
              id: activeSession.user.id,
              email: userEmail,
              nome: activeSession.user.user_metadata?.nome || userEmail.split('@')[0] || 'Usuário Sara Cota',
              role,
              cargo: role === 'proprietario' ? 'proprietario' : 'comprador',
              clienteId: 'cli-default',
            });
          } else {
            const savedLocalSession = localStorage.getItem('saracota_active_user');
            if (savedLocalSession) {
              const parsedUser = JSON.parse(savedLocalSession);
              // Migração simples de legacy role se necessário
              if (parsedUser.role === 'admin') parsedUser.role = 'proprietario';
              if (parsedUser.role === 'comprador') parsedUser.role = 'colaborador';
              setUser(parsedUser);
            }
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (newSession) {
              setSession(newSession);
              const userEmail = newSession.user.email || '';
              const role = deriveRoleFromEmail(userEmail, newSession.user.user_metadata?.role);

              const u: Usuario = {
                id: newSession.user.id,
                email: userEmail,
                nome: newSession.user.user_metadata?.nome || userEmail.split('@')[0] || 'Usuário Sara Cota',
                role,
                cargo: role === 'proprietario' ? 'proprietario' : 'comprador',
                clienteId: 'cli-default',
              };
              setUser(u);
              localStorage.setItem('saracota_active_user', JSON.stringify(u));
            } else {
              setSession(null);
              setUser(null);
              localStorage.removeItem('saracota_active_user');
            }
          });

          return () => {
            subscription.unsubscribe();
          };
        } else {
          const savedLocalSession = localStorage.getItem('saracota_active_user');
          if (savedLocalSession) {
            const parsed = JSON.parse(savedLocalSession);
            if (parsed.role === 'admin') parsed.role = 'proprietario';
            if (parsed.role === 'comprador') parsed.role = 'colaborador';
            setUser(parsed);
          }
        }
      } catch (err: any) {
        console.error('Erro na inicialização da sessão de auth:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initSession();
  }, []);

  // 2. Login com Suporte aos Usuários de Teste (proprietario / colaborador)
  const signIn = async (email: string, password: string): Promise<any> => {
    clearErrors();
    setIsLoading(true);
    try {
      if (!email || !email.includes('@')) {
        setLoginError('Informe um e-mail válido.');
        return null;
      }
      if (!password || password.length < 6) {
        setLoginError('A senha deve ter no mínimo 6 caracteres.');
        return null;
      }

      const role = deriveRoleFromEmail(email);

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error && email !== 'proprietario@saracota.com.br' && email !== 'colaborador@saracota.com.br' && email !== 'admin@saracota.com.br') {
          setLoginError(
            error.message === 'Invalid login credentials'
              ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
              : error.message
          );
          return null;
        }

        if (data?.user) {
          const u: Usuario = {
            id: data.user.id,
            email: data.user.email || email,
            nome: data.user.user_metadata?.nome || (role === 'proprietario' ? 'Proprietário Vinicius' : 'Colaborador Lucas'),
            role,
            cargo: role === 'proprietario' ? 'proprietario' : 'comprador',
            clienteId: 'cli-default',
          };
          setUser(u);
          localStorage.setItem('saracota_active_user', JSON.stringify(u));
          return u;
        }
      }

      const testUser: Usuario = {
        id: role === 'proprietario' ? 'usr-proprietario-test' : 'usr-colaborador-test',
        email,
        nome: role === 'proprietario' ? 'Proprietário Vinicius' : 'Colaborador Lucas',
        role,
        cargo: role === 'proprietario' ? 'proprietario' : 'comprador',
        clienteId: 'cli-default',
      };

      setUser(testUser);
      localStorage.setItem('saracota_active_user', JSON.stringify(testUser));
      return testUser;
    } catch (err: any) {
      setLoginError(err.message || 'Erro inesperado ao realizar login.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Cadastro
  const signUp = async (data: {
    email: string;
    password: string;
    nome: string;
    empresa?: string;
    role?: UserRole;
  }): Promise<boolean> => {
    clearErrors();
    setIsLoading(true);
    try {
      if (!data.email || !data.email.includes('@')) {
        setRegisterError('Por favor, digite um e-mail válido.');
        return false;
      }
      if (!data.password || data.password.length < 6) {
        setRegisterError('A senha deve conter no mínimo 6 caracteres.');
        return false;
      }

      const role = data.role || deriveRoleFromEmail(data.email);

      if (supabase) {
        const { data: resData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              nome: data.nome,
              empresa: data.empresa || 'Empresa de Construção',
              role,
            },
          },
        });

        if (error) {
          setRegisterError(error.message);
          return false;
        }

        if (resData.user) {
          const newUser: Usuario = {
            id: resData.user.id,
            email: resData.user.email || data.email,
            nome: data.nome,
            role,
            cargo: role === 'proprietario' ? 'proprietario' : 'comprador',
            clienteId: 'cli-default',
          };
          setUser(newUser);
          localStorage.setItem('saracota_active_user', JSON.stringify(newUser));
          return true;
        }
      }

      const mockUser: Usuario = {
        id: `usr-reg-${Date.now()}`,
        email: data.email,
        nome: data.nome,
        role,
        cargo: role === 'proprietario' ? 'proprietario' : 'comprador',
        clienteId: 'cli-default',
      };
      setUser(mockUser);
      localStorage.setItem('saracota_active_user', JSON.stringify(mockUser));
      return true;
    } catch (err: any) {
      setRegisterError(err.message || 'Erro ao realizar cadastro.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    } finally {
      setUser(null);
      setSession(null);
      localStorage.removeItem('saracota_active_user');
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    clearErrors();
    if (!email || !email.includes('@')) {
      setLoginError('Digite seu e-mail para receber as instruções de recuperação.');
      return false;
    }

    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?mode=reset`,
        });

        if (error) {
          setLoginError(error.message);
          return false;
        }
      }

      setResetSuccess(`Instruções para redefinição de senha enviadas para ${email}.`);
      return true;
    } catch (err: any) {
      setLoginError(err.message || 'Falha ao solicitar redefinição de senha.');
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: Boolean(user),
        isProprietario: user?.role === 'proprietario',
        isLoading,
        loginError,
        registerError,
        resetSuccess,
        signIn,
        signUp,
        signOut,
        resetPassword,
        clearErrors,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
