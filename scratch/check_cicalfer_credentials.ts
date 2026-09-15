import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';



(async () => {
  const forn = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  console.log('Forn record:', forn);
  if (forn) {
    const raw = (forn as any).rawSenhaCriptografada || (forn as any).senhaLogin || (forn as any).senha;
    console.log('Raw pass:', raw);
    try {
      const dec = decryptAES256(raw);
      console.log('Decrypted pass:', dec);
    } catch (e: any) {
      console.error('Decrypt err:', e.message);
    }
  }
})();
