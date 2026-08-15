'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro na aplicação:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-sara-canvas flex items-center justify-center p-4">
      <Card variant="bordered" className="max-w-md w-full p-8 text-center space-y-4 border-amber-500/40 bg-sara-surface">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-content-primary">
            Instabilidade Temporária de Carregamento
          </h2>
          <p className="text-xs text-content-secondary font-light">
            Ocorreu um imprevisto ao carregar os dados desta página. Você pode tentar recarregar ou retornar ao início.
          </p>
          {error?.message && (
            <div className="mt-2 p-2 rounded-lg bg-sara-elevated font-mono text-[11px] text-rose-400 truncate">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reset()}
            leftIcon={<RefreshCw className="w-4 h-4 text-brand" />}
          >
            Tentar Novamente
          </Button>

          <Link href="/painel">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Home className="w-4 h-4 text-black" />}
            >
              Ir para o Painel
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
