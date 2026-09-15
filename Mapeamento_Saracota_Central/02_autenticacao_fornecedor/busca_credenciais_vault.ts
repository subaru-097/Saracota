/**
 * ETAPA 3: AUTENTICAÇÃO NO FORNECEDOR — BUSCA E CRIPTOGRAFIA DE CREDENCIAIS
 * 
 * Trechos extraídos de lib/services/automacao/matchingEngine.ts e lib/security/vault.ts
 * Demonstra como as credenciais (e-mail e senha) do fornecedor externo são recuperadas
 * do banco de dados e descriptografadas de forma segura em AES-256.
 */

import { db } from '@/lib/db/client';
import { decryptAES256 } from '@/lib/security/vault';

export async function obterCredenciaisFornecedor(fornecedorId: string) {
  // 1. Buscar registro do fornecedor no banco de dados da Sara Cota
  const fornDbRecord = await db.fornecedores.getById(fornecedorId);
  if (!fornDbRecord) {
    throw new Error(`Fornecedor ID "${fornecedorId}" não encontrado no banco.`);
  }

  const fornecedorNome = fornDbRecord.nome || fornecedorId;

  // 2. Extrair campo de e-mail/login
  const loginUser = (
    (fornDbRecord as any)?.emailLogin ||
    (fornDbRecord as any)?.login ||
    (fornDbRecord as any)?.email ||
    (fornDbRecord as any)?.login_salvo ||
    (fornDbRecord as any)?.loginSalvo ||
    ''
  ).trim();

  // 3. Extrair hash criptografado da senha
  const rawPass = (
    (fornDbRecord as any)?.rawSenhaCriptografada ||
    (fornDbRecord as any)?.senhaLogin ||
    (fornDbRecord as any)?.senha_login ||
    (fornDbRecord as any)?.senha_criptografada ||
    (fornDbRecord as any)?.senhaCriptografada ||
    ''
  ).trim();

  // 4. Descriptografar a senha usando AES-256-CBC via Vault
  const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : '';

  // 5. Validação das credenciais antes de repassar ao Playwright RPA
  if (!loginUser || !decryptedPass || decryptedPass === '[DESCRIPTOGRAFIA_FALHOU]') {
    const errMsg = `[ERRO CREDENCIAIS] Fornecedor ${fornecedorNome} (${fornecedorId}) não possui e-mail/senha cadastrados ou chave inválida.`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  return {
    user: loginUser,
    pass: decryptedPass,
    fornecedorNome
  };
}
