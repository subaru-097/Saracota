import * as crypto from 'crypto';
import { sanitizeSupplierSlug } from '@/lib/utils';
import { GenericSupplierAdapter } from './adapters/genericAdapter';
import { RPAExecutionOptions, RPALoginResult } from './rpaTypes';
import { decryptAES256 } from '@/lib/security/vault';

export class RPAEngine {
  /**
   * Executa a automação de login para um fornecedor específico
   */
  static async testSupplierLogin(
    fornecedor: {
      id: string;
      nome: string;
      urlPortalB2B?: string;
      login?: string;
      email?: string;
      cnpj?: string;
      loginType?: 'modal' | 'page';
      triggerSelector?: string;
      senhaCriptografada?: string;
      rawSenhaCriptografada?: string;
      senhaLogin?: string;
      senhaPlana?: string;
      seletores?: Record<string, string> | null;
    },
    options: RPAExecutionOptions = {}
  ): Promise<RPALoginResult> {
    const adapter = new GenericSupplierAdapter(fornecedor.id, fornecedor.nome);

    const loginUrl = fornecedor.urlPortalB2B || `https://portal.${sanitizeSupplierSlug(fornecedor.nome)}.com.br/login`;
    const user = (fornecedor.cnpj || fornecedor.email || fornecedor.login || 'compras@saracota.com.br').trim();

    const rawEncrypted = (
      fornecedor.rawSenhaCriptografada ||
      fornecedor.senhaLogin ||
      (fornecedor.senhaCriptografada !== '••••••••' ? fornecedor.senhaCriptografada : '') ||
      ''
    ).trim();

    let pass = (fornecedor.senhaPlana || '').trim();
    if (!pass && rawEncrypted && rawEncrypted !== '••••••••') {
      pass = decryptAES256(rawEncrypted).trim();
    }
    if (!pass || pass === '[DESCRIPTOGRAFIA_FALHOU]') {
      pass = 'SenhaDemo123!';
    }

    const passHashSHA256 = crypto.createHash('sha256').update(pass).digest('hex');

    console.log(`🔒 [RPA ENGINE VAULT] Credenciais prontas para o robô Playwright (Fornecedor: ${fornecedor.nome}):`);
    console.log(`   - Login: "${user}"`);
    console.log(`   - Length da Senha (.trim()): ${pass.length}`);
    console.log(`   - Hash SHA-256 da Senha: ${passHashSHA256}`);

    return await adapter.login(loginUrl, user, pass, {
      headless: true,
      loginType: fornecedor.loginType || 'modal',
      triggerSelector: fornecedor.triggerSelector,
      seletores: fornecedor.seletores,
      ...options,
    });
  }
}
