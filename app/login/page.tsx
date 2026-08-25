'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, LogIn, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isProprietario, isLoading, loginError, resetSuccess, resetPassword, clearErrors } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  useEffect(() => {
    clearErrors();
    if (isAuthenticated) {
      // Redirecionamento automático baseado na role identificada no banco
      if (isProprietario) {
        router.push('/painel');
      } else {
        router.push('/cotacoes');
      }
    }
  }, [isAuthenticated, isProprietario, router, clearErrors]);

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Endpoint / Contexto valida credenciais e identifica role automaticamente
      const userObj = await signIn(email, password);
      if (userObj) {
        if (userObj.role === 'proprietario') {
          router.push('/painel');
        } else {
          router.push('/cotacoes');
        }
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
        {/* Logo & Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-1 shadow-glow">
            <Sparkles className="w-3.5 h-3.5" />
            Sara Cota SaaS • Autenticação Segura
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-content-primary">
            Acessar sua Conta
          </h1>
          <p className="text-xs text-content-secondary font-light">
            Gerenciamento de cotações inteligentes para construção civil.
          </p>
        </div>

        {/* Card Único de Login do Usuário */}
        <Card variant="floating" className="border-brand/30 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" /> Login do Usuário
            </CardTitle>
            <CardDescription>
              Informe seu e-mail corporativo e senha cadastrada.
            </CardDescription>
          </CardHeader>

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

              {/* Input E-mail */}
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

              {/* Input Senha */}
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
          Ambiente seguro • Criptografia de senhas em repouso
        </p>
      </div>

      {/* Modal de Esqueci Minha Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-sara-elevated border border-sara-border rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-brand">
              <KeyRound className="w-5 h-5" />
              <h3 className="font-bold text-base text-content-primary">Recuperar Senha</h3>
            </div>
            <p className="text-xs text-content-secondary">
              Digite seu e-mail abaixo para receber as instruções de redefinição de senha.
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
