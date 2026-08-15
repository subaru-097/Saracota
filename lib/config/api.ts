/**
 * SARA COTA SAAS — CONFIGURAÇÃO CENTRALIZADA DE API & BACKEND (FIXA E DEFINITIVA)
 *
 * Esta configuração garante que a URL do backend permaneça FIXA e IMUTÁVEL (https://api.saracota.com.br),
 * eliminando a necessidade de alteração manual a cada novo deploy.
 */

export interface ApiConfiguration {
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
  environment: 'development' | 'production' | 'staging';
  isProduction: boolean;
}

const DEFAULT_API_BASE_URL = 'https://api.saracota.com.br';
const DEFAULT_SUPABASE_URL = 'https://api.saracota.com.br/supabase';

export const API_CONFIG: ApiConfiguration = {
  baseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `${window.location.origin}/api/v1`
      : DEFAULT_API_BASE_URL),

  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,

  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'saracota_prod_anon_key_fixed_v1',

  appUrl:
    process.env.NEXT_PUBLIC_APP_URL || 'https://saracota.com.br',

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
