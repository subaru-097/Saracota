'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { Loader2, ShieldAlert, ArrowLeft, RefreshCw, LogIn } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, isProprietario, user, isLoading } = useAuth();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Timeout de segurança de 4.5s para interromper travamentos da verificação de sessão
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      console.log('[ProtectedRoute] Verification loading... Timer 4.5s iniciado.');
      timer = setTimeout(() => {
        console.warn('[ProtectedRoute] Timer 4.5s atingido! Interrompendo tela de carregamento.');
        setHasTimedOut(true);
      }, 4500);
    } else {
      setHasTimedOut(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  if (isLoading && !hasTimedOut) {
    return (
      <div className="min-h-screen bg-sara-canvas flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/40 flex items-center justify-center animate-pulse">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <span className="text-xs font-mono text-brand uppercase font-bold tracking-wider block">
            Sara Cota SaaS • Sistema de Acesso
          </span>
          <p className="text-xs text-content-tertiary font-light">
            Verificando permissões de acesso ao sistema...
          </p>
        </div>
      </div>
    );
  }

  if (hasTimedOut && isLoading) {
    return (
      <div className="min-h-screen bg-sara-canvas flex items-center justify-center p-4">
        <Card variant="bordered" className="max-w-md w-full p-8 text-center space-y-5 border-amber-500/40 bg-amber-500/5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-content-primary">
              Tempo Limite de Autenticação Excedido
            </h2>
            <p className="text-xs text-content-secondary leading-relaxed">
              A verificação de permissões do sistema excedeu o tempo limite (timeout de conexão com o Supabase/Auth). 
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              size="md"
              leftIcon={<RefreshCw className="w-4 h-4 text-black" />}
              onClick={() => window.location.reload()}
            >
              Tentar Novamente
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<LogIn className="w-4 h-4 text-content-primary" />}
              onClick={() => router.push('/login')}
            >
              Ir para a Tela de Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Verificação de RBAC para páginas exclusivas do Proprietário (ex: /ajustes)
  if (requiredRole === 'proprietario' && !isProprietario) {
    return (
      <div className="min-h-screen bg-sara-canvas flex items-center justify-center p-4">
        <Card variant="bordered" className="max-w-md w-full p-8 text-center space-y-4 border-rose-500/40 bg-rose-500/5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-content-primary">
              Acesso Restrito ao Proprietário — 403 Forbidden
            </h2>
            <p className="text-xs text-content-secondary font-light">
              Você está logado como <strong className="text-content-primary">{user?.email}</strong> (Perfil: {user?.role.toUpperCase()}). Esta seção de configurações exige o perfil de <strong>PROPRIETÁRIO DA EMPRESA</strong>.
            </p>
          </div>
          <Link href="/painel">
            <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4 text-black" />}>
              Voltar para o Painel
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
