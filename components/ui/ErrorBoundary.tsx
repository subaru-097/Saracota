'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 max-w-lg mx-auto my-8">
          <Card variant="bordered" className="p-6 text-center space-y-4 border-rose-500/40 bg-rose-500/5">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-content-primary">Ocorreu um erro ao carregar este componente</h3>
              <p className="text-xs text-content-secondary font-light">
                {this.state.error?.message || 'Falha temporária de renderização.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
              leftIcon={<RefreshCw className="w-4 h-4 text-brand" />}
            >
              Recarregar Componente
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
