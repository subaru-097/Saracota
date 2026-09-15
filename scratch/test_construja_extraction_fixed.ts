import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function testExtractionFixed() {
  console.log('🧪 [TESTE 18 EXTRATOR FIX] Testando extração de preços no modal do carrinho...');

  const baseDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste18_construja_correcao');
  const construjaDir = path.join(baseDir, 'construja');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // 1. LOGIN
    await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi")').first();
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    const loginTrigger = page.locator('#botao-login').first();
    if (await loginTrigger.isVisible().catch(() => false)) {
      await loginTrigger.click({ force: true });
      await page.waitForTimeout(1500);
      await page.locator('input[name="email"].form-control').first().fill('comercialsantana@gmail.com');
      await page.locator('input#senha[name="senha"]').first().fill('53597');
      await page.locator('button#btn-entrar').first().click({ force: true });
      await page.waitForTimeout(3500);
    }

    // 2. BUSCAR ITEM 1 (3 FORTLEV CX DAGUA TAMPA 1000L)
    console.log('Buscando Item 1...');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV%20CX%20DAGUA%20TAMPA%201000L', { waitUntil: 'commit' });
    await page.waitForTimeout(2500);
    const qty1 = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await qty1.isVisible().catch(() => false)) {
      await qty1.fill('3');
      await qty1.press('Enter');
      await page.waitForTimeout(2000);
    }

    // 3. BUSCAR ITEM 2 (12 VEDALIT 900ML)
    console.log('Buscando Item 2...');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=VEDALIT%20900ML', { waitUntil: 'commit' });
    await page.waitForTimeout(2500);
    const qty2 = page.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await qty2.isVisible().catch(() => false)) {
      await qty2.fill('12');
      await qty2.press('Enter');
      await page.waitForTimeout(2000);
    }

    // 4. ABRIR CARRINHO (#botao-abrir-carrinho)
    console.log('Abrindo gaveta do carrinho (#botao-abrir-carrinho)...');
    const openCart = page.locator('#botao-abrir-carrinho').first();
    await openCart.click({ force: true });
    await page.waitForTimeout(3000);

    // PRINT DO CARRINHO ABERTO COM ITENS
    await page.screenshot({ path: path.join(construjaDir, '07_carrinho_aberto_com_itens.png'), fullPage: false });

    // 5. EXTRAÇÃO NO CONTEXTO DO MODAL
    const extractedData = await page.evaluate(() => {
      const items: any[] = [];
      const rows = document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="ProdutoCompactCarrinho_itemContainer"]');
      rows.forEach(r => {
        const titleEl = r.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, a[href*="/produto/"], div[class*="productTitle"]');
        const priceEls = Array.from(r.querySelectorAll('.fs-14.fw-bold, span[class*="fw-bold"], span.fw-bold'));
        const qtyEl = r.querySelector('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]');

        if (titleEl) {
          const prices = priceEls.map(e => (e as HTMLElement).innerText.trim()).filter(t => t.includes('R$') || t.includes(','));
          items.push({
            produto: (titleEl as HTMLElement).innerText.trim(),
            precoUnitarioStr: prices[0] || 'R$ 0,00',
            precoTotalItemStr: prices[prices.length - 1] || prices[0] || 'R$ 0,00',
            quantidade: qtyEl ? (qtyEl as HTMLInputElement).value : '1'
          });
        }
      });

      // Extrair total do pedido
      const totalPedEl = Array.from(document.querySelectorAll('tr, table, div')).find(el => (el as HTMLElement).innerText && (el as HTMLElement).innerText.includes('Total pedido'));
      return {
        itens: items,
        resumoTexto: totalPedEl ? (totalPedEl as HTMLElement).innerText.substring(0, 200) : ''
      };
    });

    console.log('\n================================================================');
    console.log('🎉 RESULTADO REAL DA EXTRAÇÃO DO PORTAL CONSTRUJÁ:');
    console.log(JSON.stringify(extractedData, null, 2));
    console.log('================================================================\n');

    await page.screenshot({ path: path.join(construjaDir, '08_extracao_valores_reais_sucesso.png'), fullPage: false });

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await browser.close();
  }
}

testExtractionFixed().catch(console.error);
