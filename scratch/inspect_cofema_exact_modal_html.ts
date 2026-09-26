import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { decryptAES256 } from '../lib/security/vault';

async function inspectCofemaExactModalHTML() {
  console.log('=== INSPECCIONANDO HTML EXATO DO MODAL COFEMA ===');
  const forn = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const loginUser = (forn as any).emailLogin || (forn as any).login_salvo;
  const rawPass = (forn as any).rawSenhaCriptografada || (forn as any).senha_login;
  const pass = decryptAES256(rawPass);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const { cofemaRealizarLogin, cofemaAdicionarItem } = require('../core/services/supplier-quote-engine/cofemaExtractor');
  const config = { slug: 'cofema', nome: 'Cofema Atacadista' };
  await cofemaRealizarLogin(page, config, { user: loginUser, pass });

  // Adicionar Chave Inglesa
  await cofemaAdicionarItem(page, config, { termo: 'Chave Inglesa 12 Brasfort', quantidade: 5, skuFornecedor: '296503' });

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

  const domInspection = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') || document.querySelector('.modal-content') || document.body;
    return {
      innerText: dialog.innerText,
      outerHTML: dialog.outerHTML.substring(0, 3000)
    };
  });

  console.log('DOM INNERTEXT:\n', domInspection.innerText);
  console.log('DOM OUTERHTML:\n', domInspection.outerHTML);

  await browser.close();
}

inspectCofemaExactModalHTML().catch(console.error);
