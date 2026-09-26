import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function testCofemaCartModal() {
  console.log('=== INSPECCIONANDO MODAL DE PEDIDO COFEMA ===');
  const forn = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const loginUser = (forn as any).emailLogin || (forn as any).login_salvo;
  const rawPass = (forn as any).rawSenhaCriptografada || (forn as any).senha_login;
  const pass = decryptAES256(rawPass);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const { cofemaRealizarLogin, cofemaAdicionarItem } = require('../core/services/supplier-quote-engine/cofemaExtractor');
  await cofemaRealizarLogin(page, {}, { user: loginUser, pass });

  // Adicionar Chave Inglesa
  await cofemaAdicionarItem(page, {}, { termo: 'Chave Inglesa 12 Brasfort', quantidade: 5, skuFornecedor: '296503' });

  // Ir para pedidos
  await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Click tab Carrinhos
  const tabCarrinhos = page.locator('button:has-text("Carrinhos"), [role="tab"]:has-text("Carrinhos")').first();
  if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tabCarrinhos.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Click first row
  const firstRowCell = page.locator('tbody tr td').first();
  if (await firstRowCell.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstRowCell.click({ force: true });
    await page.waitForTimeout(3000);
  }

  const modalData = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"]') || document.body;
    return {
      modalFound: !!document.querySelector('[role="dialog"]'),
      innerText: modal.innerText,
      html: modal.outerHTML.substring(0, 1500)
    };
  });

  console.log('MODAL DATA:', JSON.stringify(modalData, null, 2));

  await browser.close();
}

testCofemaCartModal().catch(console.error);
