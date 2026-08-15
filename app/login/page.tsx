'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, LogIn, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, KeyRound, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading, loginError, resetSuccess, resetPassword, clearErrors } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const isDevMode = process.env.NODE_ENV === 'development';

  useEffect(() => {
    clearErrors();
    if (isAuthenticated) {
      router.push('/painel');
    }
  }, [isAuthenticated, router, clearErrors]);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ok = await signIn(email, password);
      if (ok) {
        router.push('/painel');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestLogin = async (testEmail: string) => {
    setEmail(testEmail);
    setPassword('password123');
    setIsSubmitting(true);
    try {
      const ok = await signIn(testEmail, 'password123');
      if (ok) {
        router.push('/painel');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitting(true);
    try {
      const ok = await resetPassword(forgotEmail);
      if (ok) {
        setShowForgotModal(false);
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sara-canvas flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-300">
        {/* Brand Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-1 shadow-glow">
            <Sparkles className="w-3.5 h-3.5" />
            Sara Cota SaaS • Sistema de Cotações Inteligente
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-content-primary">
            Acessar sua Conta
          </h1>
          <p className="text-xs text-content-secondary font-light">
            Gerenciamento automatizado de cotações de construção civil com cálculo ICMS-ST.
          </p>
        </div>

        {/* Atalhos de Teste visíveis APENAS no ambiente de Desenvolvimento (NODE_ENV === 'development') */}
        {isDevMode && (
          <div className="p-3.5 rounded-2xl bg-sara-surface border border-sara-border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold text-content-tertiary uppercase flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-brand" /> Atalhos Dev (NODE_ENV=development):
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <button
                type="button"
                onClick={() => handleTestLogin('proprietario@saracota.com.br')}
                className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-left transition-colors cursor-pointer"
              >
                <Badge variant="brand" size="sm" className="mb-1">PROPRIETÁRIO</Badge>
                <span className="block text-[11px] font-bold text-content-primary truncate">proprietario@saracota.com.br</span>
                <span className="block text-[10px] text-content-tertiary">Gestão Total</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestLogin('colaborador@saracota.com.br')}
                className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-left transition-colors cursor-pointer"
              >
                <Badge variant="emerald" size="sm" className="mb-1">COLABORADOR</Badge>
                <span className="block text-[11px] font-bold text-content-primary truncate">colaborador@saracota.com.br</span>
                <span className="block text-[10px] text-content-tertiary">Cotações / Leitura</span>
              </button>
            </div>
          </div>
        )}

        {/* Login Card */}
        <Card variant="floating" className="border-brand/30 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" /> Login do Usuário
            </CardTitle>
            <CardDescription>
              Informe seu e-mail corporativo e senha cadastrada.
            </CardDescription>
          </CardHeader>

          {/* FORM COMPATÍVEL COM GERENCIADOR DE SENHAS DO NAVEGADOR */}
          <form onSubmit={handleSubmitLogin}>
            <CardContent className="space-y-4 pt-2">
              {/* Alert Error Message */}
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-mono flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Alert Reset Success Message */}
              {resetSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-mono flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {/* Email Input */}
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                label="E-mail Corporativo"
                placeholder="seu.nome@construtora.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-content-tertiary" />}
                required
              />

              {/* Password Input */}
              <div className="space-y-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  label="Senha"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-content-tertiary" />}
                  required
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] text-brand hover:underline font-mono"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-4 border-t border-sara-border">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center shadow-glow"
                isLoading={isSubmitting || isLoading}
                leftIcon={<LogIn className="w-4 h-4 text-black" />}
              >
                Entrar no Sara Cota
              </Button>

              <div className="text-center text-xs text-content-tertiary pt-1">
                Ainda não possui acesso?{' '}
                <Link href="/cadastro" className="text-brand font-bold hover:underline">
                  Cadastrar minha Empresa
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Footer Info */}
        <p className="text-[11px] text-center text-content-tertiary font-mono">
          Ambiente seguro • Proteção de dados com criptografia bancária
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-sara-elevated border border-sara-border rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-brand">
              <KeyRound className="w-5 h-5" />
              <h3 className="font-bold text-base text-content-primary">Recuperar Senha</h3>
            </div>
            <p className="text-xs text-content-secondary">
              Digite seu e-mail abaixo para receber o link de redefinição de senha.
            </p>
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                label="E-mail de Cadastro"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowForgotModal(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={forgotSubmitting}>
                  Enviar Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
