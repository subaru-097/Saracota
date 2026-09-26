/**
 * ETAPA 2A: BUSCA DE CREDENCIAIS NO COFRE AES-256 PARA CONSTRUJÁ
 */

import { db } from '@/lib/db/client';
import { decryptAES256 } from '@/lib/security/vault';

export async function obterCredenciaisConstruja(fornecedorId: string = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2') {
  const forn = await db.fornecedores.getById(fornecedorId);
  if (!forn) throw new Error(`Fornecedor ${fornecedorId} não localizado.`);

  const emailLogin = (
    (forn as any).emailLogin ||
    forn.login ||
    forn.email ||
    (forn as any).login_salvo ||
    ''
  ).trim();

  const rawSenha = (
    (forn as any).rawSenhaCriptografada ||
    (forn as any).senhaLogin ||
    (forn as any).senha_criptografada ||
    ''
  ).trim();

  const senhaDescriptografada = rawSenha ? decryptAES256(rawSenha).trim() : '';

  if (!emailLogin || !senhaDescriptografada || senhaDescriptografada === '[DESCRIPTOGRAFIA_FALHOU]') {
    throw new Error(`Credenciais do fornecedor Construjá não puderam ser recuperadas do Vault.`);
  }

  return {
    user: emailLogin,
    pass: senhaDescriptografada,
    urlPortal: forn.urlPortalB2B || 'https://www.construja.com.br/produtos',
  };
}
