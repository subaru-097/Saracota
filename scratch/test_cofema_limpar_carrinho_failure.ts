import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaLimparCarrinhoFailure() {
  console.log('=== TESTE DE EXCEÇÃO / THROW DE ERRO NA LIMPEZA DO CARRINHO COFEMA ===\n');

  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const fornDbRecord = await db.fornecedores.getById(cofemaFornecedorId);
  const emailLogin = fornDbRecord?.emailLogin || '';
  const senhaLogin = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    console.log('1. Efetuando login...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('\n2. Chamando cofemaLimparCarrinho na conta atual (sem purgar a força para testar o THROW de erro)...');
    await cofemaLimparCarrinho(page, config);

    console.log('⚠️ ERRO INESPERADO: A limpeza não lançou exceção!');

  } catch (err: any) {
    console.log('\n=== ✅ EXCEÇÃO CAPTURADA COM SUCESSO (THROW DE ERRO CONFIRMADO) ===');
    console.log(`Mensagem de Erro: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
  } finally {
    await browser.close();
  }
}

testCofemaLimparCarrinhoFailure().catch(console.error);
