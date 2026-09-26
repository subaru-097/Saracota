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
  console.log('1. Navigating to Cofema home...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('2. Opening Login modal...');
  await page.click('button:has-text("Entre ou Cadastre-se")');
  await page.waitForTimeout(1000);

  await page.click('text="Área do Cliente"');
  await page.waitForTimeout(2000);

  console.log('3. Submitting CNPJ credentials...');
  const userField = page.locator('input[placeholder*="código"], input[placeholder*="CPF"], #codigo').first();
  const passField = page.locator('input[placeholder*="senha"], #senha').first();

  await userField.fill('43.313.798/0001-34');
  await passField.fill('Santana5419');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(5000);

  console.log('4. Navigating to /page/pedidos...');
  await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  console.log('5. Opening Carrinhos tab...');
  const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
  if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tabCarrinhos.click();
    await page.waitForTimeout(3000);
  }

  console.log('6. Opening Cart #130620...');
  const cart130620 = page.locator('text="#130620"').first();
  await cart130620.click();
  await page.waitForTimeout(4000);

  // Take initial modal screenshot
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_modal_top.png') });

  // Scroll the modal container down to reveal all items
  console.log('7. Scrolling modal items container...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]');
    if (dialog) {
      const scrollable = dialog.querySelector('div[class*="overflow-y-auto"], div[class*="max-h-"], div[class*="scroll"]') || dialog;
      scrollable.scrollTop = 1000;
    }
  });
  await page.waitForTimeout(1500);

  // Take scrolled screenshot
  await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'cofema_modal_scrolled.png') });

  // Extract ALL item cards from the modal DOM
  const extractionResult = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]');
    const container = dialog || document.body;

    // Item cards in Cofema modal use flex containers with borders or rounded corners
    const cardNodes = Array.from(container.querySelectorAll('div.rounded-lg, div[class*="border"], div.p-3, div.p-4'));

    const items: any[] = [];
    const seenTitles = new Set<string>();

    cardNodes.forEach((node) => {
      const el = node as HTMLElement;
      const text = el.innerText || '';

      // Check if this node is an individual product card (has Código or Total or price)
      if (text.includes('Código:') && (text.includes('TOTAL') || text.includes('R$'))) {
        const titleMatch = text.split('\n')[0]?.trim() || '';
        if (titleMatch && !seenTitles.has(titleMatch)) {
          seenTitles.add(titleMatch);

          const codeMatch = text.match(/Código:\s*(\d+)/i);
          const qtdMatch = text.match(/Quantidade:\s*(\d+)/i);
          const totalMatch = text.match(/TOTAL\s*R\$\s*([\d\.,]+)/i) || text.match(/R\$\s*([\d\.,]+)/i);

          const hasAbre = text.includes('Abre');
          const hasNaoAbre = text.includes('Não Abre');

          const badgeText = hasNaoAbre ? 'Não Abre' : hasAbre ? 'Abre' : 'Sem Badge';

          // Pack size match (e.g., 1 un., 5 un., 12 un.)
          const packMatch = text.match(/(\d+)\s*(un|cx|pt|kg|m)\.?/i);

          items.push({
            title: titleMatch,
            codigo: codeMatch ? codeMatch[1] : null,
            quantidadePedida: qtdMatch ? parseInt(qtdMatch[1], 10) : 1,
            badge: badgeText,
            embalagem: packMatch ? packMatch[0] : '1 un.',
            totalStr: totalMatch ? totalMatch[1] : '0,00',
            fullText: text.replace(/\n+/g, ' | '),
          });
        }
      }
    });

    // Also get the main Total Carrinho text
    const totalCarrinhoMatch = container.innerText.match(/Total Carrinho:[^\d]*R\$\s*([\d\.,]+)/i) || container.innerText.match(/R\$\s*286,91/);

    return {
      totalCarrinhoText: totalCarrinhoMatch ? totalCarrinhoMatch[0] : null,
      totalItemsFound: items.length,
      items,
    };
  });

  console.log('\n==================================================');
  console.log('TOTAL CARRINHO (CABEÇALHO):', extractionResult.totalCarrinhoText);
  console.log('TOTAL DE ITENS NO DOM:', extractionResult.totalItemsFound);
  console.log('==================================================');
  console.log(JSON.stringify(extractionResult.items, null, 2));

  await browser.close();
}

main().catch(console.error);
