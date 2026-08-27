import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let fornecedoresCount = 0;
  let fornecedoresNomes: string[] = [];
  let fornecedoresError: string | null = null;

  try {
    const list = await db.fornecedores.list();
    fornecedoresCount = list.length;
    fornecedoresNomes = list.map((f) => f.nome);
  } catch (e: any) {
    fornecedoresError = e.message || String(e);
  }

  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLast4: apiKey ? apiKey.slice(-4) : null,
    hasProjectId: !!projectId,
    projectIdValue: projectId || null,
    hasSupabaseUrl: !!supabaseUrl,
    supabaseUrlDomain: supabaseUrl ? supabaseUrl.split('//')[1] : null,
    hasSupabaseAnonKey: !!supabaseAnonKey,
    fornecedoresCount,
    fornecedoresNomes,
    fornecedoresError,
    environment: process.env.NODE_ENV || 'unknown',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
  });
}
