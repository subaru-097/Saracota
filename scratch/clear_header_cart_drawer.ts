import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function clearHeaderCartDrawer() {
  console.log('=== PURGA DOS ITENS RESIDUAIS NA GAVETA DO CARRINHO HEADER DO COFEMA ===\n');

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
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    // 1. Clicar no botão do carrinho no Header
    const cartTrigger = page.locator('header button:has(svg), header a:has(svg)').filter({
      has: page.locator('svg')
    }).first();

    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.click({ force: true });
      await page.waitForTimeout(2500);
    }

    // 2. Executar script de purga de todos os itens dentro da gaveta aberta
    const purgeDrawerRes = await page.evaluate(async () => {
      let totalDeleted = 0;
      for (let i = 0; i < 15; i++) {
        const trashBtns = Array.from(document.querySelectorAll('button[title*="Remover"], button[title*="Excluir"], svg.lucide-trash-2, svg.lucide-trash, .cart-item-preco-row button'));
        if (trashBtns.length === 0) break;

        (trashBtns[0] as HTMLElement).click();
        totalDeleted++;
        await new Promise(r => setTimeout(r, 1000));

        // Confirmar se houver modal de confirmação
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('sim') || t.includes('confirmar') || t.includes('excluir');
        });
        if (confirmBtn) {
          (confirmBtn as HTMLElement).click();
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      return { totalDeleted };
    });

    console.log(`Resultado da purga da gaveta: ${JSON.stringify(purgeDrawerRes)}`);
    await page.waitForTimeout(3000);

    // 3. Também verificar se há botão de "Excluir carrinho" ou "Esvaziar" na gaveta
    const deleteCartBtn = page.locator('button[title*="Excluir"], button:has-text("Excluir carrinho"), button:has-text("Esvaziar")').first();
    if (await deleteCartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicando em botão de exclusão do carrinho na gaveta...');
      await deleteCartBtn.evaluate((b: any) => b.click()).catch(() => {});
      await page.waitForTimeout(2000);

      const confirmBtn = page.locator('button:has-text("Sim"), button:has-text("Confirmar"), button:has-text("Excluir")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.evaluate((b: any) => b.click()).catch(() => {});
        await page.waitForTimeout(2500);
      }
    }

    // Recarregar e verificar contagem final de itens
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const remBadgeCount = await page.evaluate(() => {
      const headerText = document.querySelector('header')?.innerText || '';
      const badgeMatch = headerText.match(/\b(\d+)\b/);
      return badgeMatch ? badgeMatch[1] : '0';
    });

    console.log(`\nContagem no badge do Header pós-purga: "${remBadgeCount}"`);

  } finally {
    await browser.close();
  }
}

clearHeaderCartDrawer().catch(console.error);
