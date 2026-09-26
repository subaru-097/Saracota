import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '@/lib/db/client';

async function main() {
  console.log('=== VERIFICANDO FORNECEDORES NO SUPABASE ===');
  const forns = await db.fornecedores.list();
  
  const targetSlugs = ['construja', 'cicalfer', 'cofema'];
  const encontrados = forns.filter(f => {
    const slug = (f.config_slug || (f as any).configSlug || '').toLowerCase();
    const nome = (f.nome || '').toLowerCase();
    return targetSlugs.some(s => slug.includes(s) || nome.includes(s));
  });

  console.log(`Fornecedores encontrados (${encontrados.length}):`);
  for (const f of encontrados) {
    console.log({
      id: f.id,
      nome: f.nome,
      config_slug: f.config_slug || (f as any).configSlug,
      rpa_ativo: f.rpa_ativo ?? (f as any).rpaAtivo,
      url_portal_b2b: f.url_portal_b2b || (f as any).urlPortalB2B,
      email_login: (f as any).emailLogin || (f as any).login || (f as any).email,
      has_pass: Boolean((f as any).rawSenhaCriptografada || (f as any).senhaLogin || (f as any).senha_login)
    });
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
