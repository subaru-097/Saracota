// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { db } = require('../lib/db/client');
const { decryptAES256 } = require('../lib/security/vault');

(async () => {
  console.log('=== TESTE E INSPEÇÃO DA NOVA EXTRAÇÃO DO CARRINHO CICALFER COM CREDENCIAIS DO BANCO ===');
  const quoteEngine = require('../core/services/supplier-quote-engine');
  const cicalferConfig = require('../config/suppliers/cicalfer.json');

  const fornDbRecord = await db.fornecedores.getById('33e03495-100d-45a3-9e34-899de56b0ab1');
  const loginUser = (fornDbRecord?.emailLogin || fornDbRecord?.login || fornDbRecord?.email || '').trim();
  const rawPass = (fornDbRecord?.rawSenhaCriptografada || fornDbRecord?.senhaLogin || '').trim();
  const decryptedPass = rawPass ? decryptAES256(rawPass).trim() : '';

  console.log(`Credenciais obtidas do banco: User: "${loginUser}", Senha Presente: ${Boolean(decryptedPass)}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

  try {
    console.log('1. Executando realizarLogin com as credenciais do banco...');
    await quoteEngine.realizarLogin(page, cicalferConfig, {
      user: loginUser,
      pass: decryptedPass
    });

    console.log('2. Adicionando item ao carrinho: "CABO FLEX 100M COBRECOM 2,50MM" ...');
    await quoteEngine.adicionarItem(page, cicalferConfig, {
      ref: '10672',
      termo: 'CABO FLEX 100M COBRECOM 2,50MM AM',
      quantidade: 5
    });

    console.log('3. Navegando para o carrinho e executando extração via novos seletores...');
    await page.goto(cicalferConfig.selectors.cart_url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Salvar print do carrinho real
    const printPath = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_cicalfer_carrinho_dom.png');
    await page.screenshot({ path: printPath, fullPage: true });
    console.log(`Print do carrinho salvo em: ${printPath}`);

  } catch (err) {
    console.error('Erro na inspeção do carrinho:', err);
  } finally {
    await browser.close();
  }
})();
