/**
 * INICIALIZAÇÃO DO CLIENT SUPABASE NO PROJETO SARACOTA
 * Arquivo: lib/db/client.ts (Linhas 1 - 22)
 * Arquivo: lib/config/api.ts (Linhas 21 - 45)
 */

// --- TRECHO 1: lib/config/api.ts ---
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

// --- TRECHO 2: lib/db/client.ts ---
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { API_CONFIG } from '@/lib/config/api';

const SUPABASE_URL = API_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = API_CONFIG.supabaseAnonKey;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    !SUPABASE_URL.includes('sua-instancia.supabase.co') &&
    !SUPABASE_URL.includes('sua-anon-key') &&
    !SUPABASE_ANON_KEY.includes('sua-anon-key')
);

// OBSERVAÇÃO CRÍTICA: Inicializa com ANON_KEY (Chave pública anônima sujeira a RLS)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
