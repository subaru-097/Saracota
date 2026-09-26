import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function inspectCicalferLoggedInCatalog() {
  console.log('🔍 Testando navegação autenticada e extração de catálogo na Cicalfer...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitorar requisições para descobrir a API de catálogo/busca da Cicalfer
  const apiRequests: string[] = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('api.cicalfer.com.br') || url.includes('/v1/produtos') || url.includes('busca')) {
      apiRequests.push(`[${res.status()}] ${url}`);
    }
  });

  try {
    await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Login
    const loginTrigger = page.locator('button#botao-login, .componentes-button_login, a:has-text("Entrar"), text=Entrar | Cadastrar').first();
    if (await loginTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginTrigger.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('santanacomercial2021@gmail.com');
      await page.locator('input#senha[name="senha"], input[type="password"]').first().fill('871935');
      await page.waitForTimeout(1000);
      await page.locator('button#btn-entrar, form button#btn-entrar').first().click({ force: true });
      await page.waitForTimeout(4000);

      const filialEntrega = page.locator('.ModalClienteFilial_selectedTitle__uJhF8, .modal:has-text("ENTREGA")').first();
      if (await filialEntrega.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filialEntrega.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        const confirmBtn = page.locator('span:has-text("Confirmar seleção"), button:has-text("Confirmar")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }
    }

    // Navegar para a página de produtos
    console.log('Navegando para https://cicalfer.com.br/produtos...');
    await page.goto('https://cicalfer.com.br/produtos', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const titleText = await page.title();
    console.log('Título da página:', titleText);

    // Capturar seletores de produtos e categorias
    const infoDOM = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/produtos"], a[href*="/categoria"]'));
      const textSample = document.body ? document.body.innerText.substring(0, 1500) : '';
      const cardSelectors = Array.from(document.querySelectorAll('div[class*="Produto"], div[class*="Card"], div[class*="Item"], div.col-6')).length;
      return {
        cardCount: cardSelectors,
        sampleText: textSample,
        linkCount: links.length,
      };
    });

    console.log('DOM Info:', JSON.stringify(infoDOM, null, 2));

    console.log('\n--- REQUISIÇÕES DE API CAPTURADAS ---');
    apiRequests.forEach((req) => console.log(req));

  } catch (err: any) {
    console.error('Erro na inspeção:', err.message);
  } finally {
    await browser.close();
  }
}

inspectCicalferLoggedInCatalog();
