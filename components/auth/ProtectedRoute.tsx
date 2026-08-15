'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
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
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
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
