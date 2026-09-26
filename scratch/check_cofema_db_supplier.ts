import { db } from '../lib/db/client';

async function checkCofemaSupplier() {
  console.log('🔍 Checking Cofema supplier record in DB...');
  const fornList = await db.fornecedores.list();
  const cofema = fornList.find((f: any) => f.slug === 'cofema' || f.nome.toLowerCase().includes('cofema'));

  console.log('Cofema DB Record:', JSON.stringify(cofema, null, 2));

  if (cofema) {
    if (!cofema.rpa_ativo || !cofema.config_slug) {
      console.log('Updating Cofema DB record to ensure rpa_ativo=true and config_slug="cofema"...');
      await db.fornecedores.update(cofema.id, {
        rpa_ativo: true,
        rpaAtivo: true,
        config_slug: 'cofema',
        configSlug: 'cofema',
        seletores: {
          rpa_ativo: true,
          config_slug: 'cofema'
        }
      } as any);
      console.log('✅ Cofema DB record updated!');
    }
  }
}

checkCofemaSupplier().catch(console.error);
