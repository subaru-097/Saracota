import { chromium } from 'playwright';

async function testConstrujaFlow() {
  console.log('Testing Construjá category click & pagination flow...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  }).catch(() => chromium.launch({ headless: true }));

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('1. Navigating to https://www.construja.com.br/produtos...');
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Find clickable parent element of span "Todos Produtos" or category span
  console.log('2. Clicking "Todos Produtos" / Category element...');
  const clicked = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span.font-size-14.fw-medium.text-uppercase'));
    const todosSpan = spans.find(s => s.textContent?.trim().toUpperCase().includes('TODOS PRODUTOS')) || spans[0];
    if (todosSpan) {
      let parent: HTMLElement | null = todosSpan as HTMLElement;
      while (parent && parent.tagName !== 'BUTTON' && parent.tagName !== 'A' && !parent.getAttribute('role') && parent.parentElement && parent.parentElement.tagName !== 'BODY') {
        if (parent.classList.contains('cursor-pointer') || parent.onclick) break;
        parent = parent.parentElement;
      }
      if (parent) {
        parent.click();
        return { clickedText: todosSpan.textContent?.trim(), tag: parent.tagName, className: parent.className };
      }
    }
    return null;
  });
  console.log('Click result:', clicked);
  await page.waitForTimeout(2000);

  // 3. Select "96 / página" in react-select
  console.log('3. Selecting 96 per page in react-select...');
  const selectControl = page.locator('.react-select__control, [id*="react-select"]').first();
  if (await selectControl.isVisible().catch(() => false)) {
    await selectControl.click();
    await page.waitForTimeout(500);

    const option96 = page.locator('.react-select__option:has-text("96"), [id*="react-select"]:has-text("96")').first();
    if (await option96.isVisible().catch(() => false)) {
      await option96.click();
      await page.waitForTimeout(2500);
    } else {
      await page.keyboard.type('96');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2500);
    }
  }

  // 4. Read page count and buttons
  const paginationState = await page.evaluate(() => {
    const pageButtons = Array.from(document.querySelectorAll('button, a')).filter(el => el.textContent?.trim().match(/^\d+$/));
    const pageNumbers = pageButtons.map(b => parseInt(b.textContent?.trim() || '1', 10));
    const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
    const cardsCount = document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length;
    return {
      maxPage,
      pageNumbers,
      cardsCount
    };
  });
  console.log('Pagination state:', paginationState);

  // 5. Test clicking page 2
  const nextBtn = page.locator('button:has-text("Próximo"), a:has-text("Próximo"), button:has-text(">")').first();
  if (await nextBtn.isVisible().catch(() => false)) {
    console.log('4. Clicking "Próximo" page button...');
    await nextBtn.click();
    await page.waitForTimeout(3000);

    const page2Cards = await page.evaluate(() => document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length);
    console.log(`Page 2 cards count: ${page2Cards}`);
  }

  await browser.close();
}

testConstrujaFlow().catch(console.error);
