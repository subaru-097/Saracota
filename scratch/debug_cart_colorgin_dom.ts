import { chromium } from 'playwright';

async function debugCartColorginDom() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.construja.com.br/produtos');
  await page.waitForTimeout(3000);

  // Login
  const loginTrigger = page.locator('#botao-login').first();
  if (await loginTrigger.isVisible()) {
    await loginTrigger.click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('input[name="email"].form-control').first().fill('comercialsantana@gmail.com');
    await page.locator('input#senha[name="senha"]').first().fill('53597');
    await page.locator('button#btn-entrar').first().click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Open cart drawer
  const openCartBtn = page.locator('#botao-abrir-carrinho').first();
  await openCartBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Inspect all price elements in cart drawer
  const domInfo = await page.evaluate(() => {
    const container = document.querySelector('.offcanvas, #compra-rapida-carrinho') || document.body;
    const items = Array.from(container.querySelectorAll('.ProdutoCompactCarrinho_itemContainer__Eaq76, div[class*="itemContainer"]'));
    
    return items.map((item, iIdx) => {
      const allRSElements = Array.from(item.querySelectorAll('*')).filter(e => {
        const txt = (e.innerText || '').trim();
        return /^R\$\s*[\d\.,]+/i.test(txt) && e.children.length === 0; // leaf nodes only
      });

      return {
        itemIdx: iIdx,
        itemText: item.innerText,
        priceLeafNodes: allRSElements.map(e => {
          const style = window.getComputedStyle(e);
          const parentStyle = e.parentElement ? window.getComputedStyle(e.parentElement) : null;
          return {
            tagName: e.tagName,
            className: e.className,
            innerText: e.innerText,
            outerHTML: e.outerHTML,
            parentOuterHTML: e.parentElement ? e.parentElement.outerHTML : null,
            textDecorationLine: style.textDecorationLine,
            parentTextDecorationLine: parentStyle ? parentStyle.textDecorationLine : null,
            closestSemDesconto: Boolean(e.closest('[class*="SemDesconto"], [class*="sem-desconto"], [class*="PrecoSemDesconto"]')),
            closestLineThrough: Boolean(e.closest('.text-decoration-line-through, .line-through, .text-muted, .price-old, del, s, strike'))
          };
        })
      };
    });
  });

  console.log('=== CART DOM INSPECTION RESULTS ===');
  console.log(JSON.stringify(domInfo, null, 2));

  await browser.close();
}

debugCartColorginDom().catch(err => console.error(err));
