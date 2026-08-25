/**
 * SARA COTA SAAS — CONFIGURAÇÃO CENTRALIZADA DE API & BACKEND
 * Centralizado via variável de ambiente NEXT_PUBLIC_API_URL (TAREFA 2)
 */

export interface ApiConfiguration {
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
  environment: 'development' | 'production' | 'staging';
  isProduction: boolean;
}

// Fallbacks de produção quando NEXT_PUBLIC_API_URL não for definido
const PROD_API_BASE_URL = 'https://api.saracota.com.br';
const DEV_API_BASE_URL = 'http://localhost:3000/api';

export const API_CONFIG: ApiConfiguration = {
  baseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : process.env.NODE_ENV === 'production'
      ? PROD_API_BASE_URL
      : DEV_API_BASE_URL),

  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',

  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '',

  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),

  environment:
    (process.env.NEXT_PUBLIC_ENVIRONMENT as any) ||
    (process.env.NODE_ENV === 'production' ? 'production' : 'development'),

  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * Retorna o endpoint completo para qualquer recurso da API
 */
export function getApiEndpoint(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_CONFIG.baseUrl}${cleanPath}`;
}
