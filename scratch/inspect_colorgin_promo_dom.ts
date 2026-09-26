const { chromium } = require('playwright');
const { db } = require('../lib/db/client');
const quoteEngine = require('../core/services/supplier-quote-engine');

async function main() {
  console.log('🔍 [INSPEÇÃO DETALHADA DE PROMOÇÃO - 4 ITENS COLORGIN]');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // 1. Login
    console.log('\n--- 1. LOGIN ---');
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

    // 2. Buscar COLORGIN SPRAY DECOR no grid de busca
    console.log('\n--- 2. INSPEÇÃO DO GRID DE BUSCA (COLORGIN SPRAY DECOR PRETO) ---');
    await page.goto('https://www.construja.com.br/produtos?pagina=1&busca=COLORGIN%20SPRAY%20DECOR%20PRETO', { waitUntil: 'commit' });
    await page.waitForTimeout(3000);

    const searchGridInspection = await page.evaluate(function() {
      const allRSElements = Array.from(document.querySelectorAll('*')).filter(function(e) {
        const txt = (e.innerText || '').trim();
        return e.children.length === 0 && /^R\$\s*[\d\.,]+/i.test(txt);
      }).map(function(e) {
        const style = window.getComputedStyle(e);
        const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
        return {
          tag: e.tagName,
          class: e.className,
          text: e.innerText.trim(),
          inlineStyle: e.getAttribute('style') || '',
          computedTextDecoration: style.textDecorationLine || style.textDecoration || '',
          parentTextDecoration: parentStyle ? (parentStyle.textDecorationLine || parentStyle.textDecoration || '') : '',
          parentClass: e.parentElement ? e.parentElement.className : ''
        };
      });

      return {
        allRSElementsOnGrid: allRSElements
      };
    });

    console.log('Inspeção do Grid de Busca:');
    console.log(JSON.stringify(searchGridInspection, null, 2));

    // 3. Adicionar o item ao carrinho
    const qtyInput = page.locator('input.QuantidadeMaisMenos_input__grKxO, input[type="number"]').first();
    if (await qtyInput.isVisible().catch(() => false)) {
      await qtyInput.fill('1');
      await qtyInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // 4. Abrir o carrinho e inspecionar o container do item
    console.log('\n--- 3. INSPEÇÃO DO GAVETA DO CARRINHO (CONTAINER E PREÇOS) ---');
    const openCartBtn = page.locator('#botao-abrir-carrinho').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const cartDrawerInspection = await page.evaluate(function() {
      const containers = Array.from(document.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]'));

      const details = containers.map(function(c, idx) {
        const titleEl = c.querySelector('.ProdutoCompactCarrinho_productTitle__n7FXX, span[class*="productTitle"], a');
        const titleText = titleEl ? titleEl.innerText.trim() : 'NÃO ENCONTRADO';

        const allRSInside = Array.from(c.querySelectorAll('*')).filter(function(e) {
          const txt = (e.innerText || '').trim();
          return /^R\$\s*[\d\.,]+/i.test(txt);
        }).map(function(e) {
          const style = window.getComputedStyle(e);
          const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
          return {
            tag: e.tagName,
            class: e.className,
            text: e.innerText.trim(),
            inlineStyle: e.getAttribute('style') || '',
            computedTextDecoration: style.textDecorationLine || style.textDecoration || '',
            parentTextDecoration: parentStyle ? (parentStyle.textDecorationLine || parentStyle.textDecoration || '') : '',
            parentClass: e.parentElement ? e.parentElement.className : '',
            closestDelOrStrike: Boolean(e.closest('del, s, strike, [style*="line-through"], [class*="through"], [class*="muted"], [class*="old"], [class*="riscado"]'))
          };
        });

        return {
          idx: idx,
          titleText: titleText,
          allRSInside: allRSInside
        };
      });

      return {
        containersCount: containers.length,
        details: details
      };
    });

    console.log('Inspeção da Gaveta do Carrinho:');
    console.log(JSON.stringify(cartDrawerInspection, null, 2));

  } catch (err) {
    console.error('❌ Erro durante inspeção:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
