import { db } from '../lib/db/client';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('🔍 [TESTE 18] Consultando mapeamento do Supabase para Construjá...');

  const baseDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste18_construja_correcao');
  const mapDir = path.join(baseDir, 'mapeamento_supabase');
  if (!fs.existsSync(mapDir)) fs.mkdirSync(mapDir, { recursive: true });

  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';
  const forn = await db.fornecedores.getById(construjaId);

  console.log('📋 Registro do fornecedor Construjá no Supabase:');
  console.log(JSON.stringify(forn, null, 2));

  const logContent = `# MAPEAMENTO SUPABASE - FORNECEDOR CONSTRUJÁ

**ID:** ${forn?.id}
**Nome:** ${forn?.nome}
**RPA Ativo:** ${forn?.rpaAtivo || (forn as any)?.rpa_ativo}
**Config Slug:** ${forn?.configSlug || (forn as any)?.config_slug}
**URL Login:** ${forn?.urlPortalB2B || (forn as any)?.url_login}
**Login Salvo:** ${forn?.login || (forn as any)?.login_salvo}
**Tem Credencial:** ${forn?.temCredencial}

## Seletores no Banco de Dados (JSON / Objeto):
\`\`\`json
${JSON.stringify((forn as any)?.seletores || {}, null, 2)}
\`\`\`
`;

  fs.writeFileSync(path.join(mapDir, 'mapeamento_construja.log'), logContent, 'utf8');
  console.log(`✅ Log salvo em ${path.join(mapDir, 'mapeamento_construja.log')}`);
}

main().catch(console.error);
