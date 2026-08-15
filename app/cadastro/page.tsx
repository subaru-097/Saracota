'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, UserPlus, Sparkles, AlertCircle, User, Building2, ShieldCheck } from 'lucide-react';

export default function CadastroPage() {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading, registerError, clearErrors } = useAuth();

  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    clearErrors();
    if (isAuthenticated) {
      router.push('/painel');
    }
  }, [isAuthenticated, router, clearErrors]);

  const handleSubmitCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('As senhas digitadas não coincidem. Verifique a confirmação.');
      return;
    }

    if (password.length < 6) {
      setLocalError('A senha deve conter pelo menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await signUp({
        email,
        password,
        nome,
        empresa,
      });

      if (ok) {
        router.push('/painel');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentError = localError || registerError;

  return (
    <div className="min-h-screen bg-sara-canvas flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-300">
        {/* Brand Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-light border border-brand/30 text-brand text-xs font-mono mb-1 shadow-glow">
            <Sparkles className="w-3.5 h-3.5" />
            Sara Cota SaaS • Credenciamento Corporativo
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-content-primary">
            Criar Nova Conta
          </h1>
          <p className="text-xs text-content-secondary font-light">
            Cadastre sua empresa ou construtora para cotar materiais com inteligência fiscal.
          </p>
        </div>

        {/* Cadastro Card */}
        <Card variant="floating" className="border-brand/30 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand" /> Dados da Conta
            </CardTitle>
            <CardDescription>
              Preencha os campos abaixo para obter acesso ao painel de cotações.
            </CardDescription>
          </CardHeader>

          {/* FORM COMPATÍVEL COM GERENCIADOR DE SENHAS DO NAVEGADOR */}
          <form onSubmit={handleSubmitCadastro}>
            <CardContent className="space-y-3.5 pt-2">
              {/* Alert Error Message */}
              {currentError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-mono flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{currentError}</span>
                </div>
              )}

              {/* Name Input */}
              <Input
                id="cad-nome"
                name="nome"
                type="text"
                autoComplete="name"
                label="Seu Nome Completo"
                placeholder="Engenheiro Marcos Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                leftIcon={<User className="w-4 h-4 text-content-tertiary" />}
                required
              />

              {/* Company Input */}
              <Input
                id="cad-empresa"
                name="empresa"
                type="text"
                autoComplete="organization"
                label="Nome da Construtora ou Obra (Opcional)"
                placeholder="Construtora Alfa SP"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                leftIcon={<Building2 className="w-4 h-4 text-content-tertiary" />}
              />

              {/* Email Input */}
              <Input
                id="cad-email"
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
              <Input
                id="cad-password"
                name="password"
                type="password"
                autoComplete="new-password"
                label="Senha (Mínimo 6 caracteres)"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-content-tertiary" />}
                required
              />

              {/* Password Confirmation */}
              <Input
                id="cad-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                label="Confirmar Senha"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-content-tertiary" />}
                required
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-4 border-t border-sara-border">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center shadow-glow"
                isLoading={isSubmitting || isLoading}
                leftIcon={<UserPlus className="w-4 h-4 text-black" />}
              >
                Concluir Cadastro
              </Button>

              <div className="text-center text-xs text-content-tertiary pt-1">
                Já tem uma conta cadastrada?{' '}
                <Link href="/login" className="text-brand font-bold hover:underline">
                  Fazer Login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
