import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  console.log('1. Navigating to Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('2. Opening Login modal...');
  await page.click('button:has-text("Entre ou Cadastre-se")');
  await page.waitForTimeout(1000);

  await page.click('text="Área do Cliente"');
  await page.waitForTimeout(2000);

  console.log('3. Filling login credentials (CNPJ: 43.313.798/0001-34)...');
  const userField = page.locator('input[placeholder*="código"], input[placeholder*="CPF"], #codigo').first();
  const passField = page.locator('input[placeholder*="senha"], #senha').first();

  await userField.fill('43.313.798/0001-34');
  await passField.fill('Santana5419');
  await page.waitForTimeout(500);

  console.log('4. Submitting login...');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(5000);

  // Take screenshot after login
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_logged_in.png') });
  console.log('Saved screenshot after login');

  console.log('5. Navigating to /page/pedidos...');
  await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  // Screenshot of /page/pedidos
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_pedidos_page.png'), fullPage: true });

  console.log('6. Clicking Carrinhos tab...');
  const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos"), div:has-text("Carrinhos")').last();
  if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tabCarrinhos.click();
    await page.waitForTimeout(3000);
  }

  // Screenshot after clicking Carrinhos
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_carrinhos_tab.png'), fullPage: true });

  console.log('7. Searching for Cart #130620 or top cart...');
  const cart130620 = page.locator('text="#130620"').first();
  if (await cart130620.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Found #130620! Clicking...');
    await cart130620.click();
  } else {
    console.log('Clicking first cart row or view button...');
    const firstRowAction = page.locator('tr td:has-text("#"), tr button, tr svg, tr .fa-eye').first();
    await firstRowAction.click({ force: true });
  }

  await page.waitForTimeout(4000);

  // Save screenshot of expanded cart modal
  const cartModalScreen = path.join(process.cwd(), 'scratch', 'cofema_cart_130620_modal.png');
  await page.screenshot({ path: cartModalScreen, fullPage: true });
  console.log('Saved screenshot of cart modal:', cartModalScreen);

  // Extract all lines, badges ("Abre"/"Não Abre"), prices, quantities from modal
  const cartExtraction = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]');
    const container = modal || document.body;

    const rows = Array.from(container.querySelectorAll('tr, div[class*="item-row"], div[class*="product-row"]'));
    const items: any[] = [];

    rows.forEach((r, idx) => {
      const text = (r as HTMLElement).innerText || '';
      // Look for badges (Abre / Não Abre / Embalagem / etc.)
      const badges = Array.from(r.querySelectorAll('.badge, span[class*="badge"], span[class*="tag"], button')).map(b => b.textContent?.trim());
      
      if (text.includes('R$') || text.includes('UN') || text.includes('CX') || text.includes('KG') || text.length > 20) {
        items.push({
          rowIdx: idx,
          badges,
          rawText: text.replace(/\n+/g, ' | '),
        });
      }
    });

    const totalText = container.textContent || '';
    const matchTotal = totalText.match(/Total[^\d]*R\$\s*([\d\.,]+)/i) || totalText.match(/R\$\s*([\d\.,]+)/g);

    return {
      totalFound: matchTotal ? matchTotal[0] : null,
      itemCount: items.length,
      items,
      fullHTML: container.innerHTML,
    };
  });

  console.log('\n=== EVIDÊNCIA REAL DO CARRINHO ===');
  console.log('Total Extraído:', cartExtraction.totalFound);
  console.log('Quantidade de Linhas:', cartExtraction.itemCount);
  console.log('Itens parsed:', JSON.stringify(cartExtraction.items, null, 2));

  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'cofema_cart_dom.html'), cartExtraction.fullHTML);

  await browser.close();
}

main().catch(console.error);
