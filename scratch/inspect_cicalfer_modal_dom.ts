import { chromium } from 'playwright';

(async () => {
  console.log('=== INSPEÇÃO DO DOM DO MODAL DE LOGIN DA CICALFER ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto('https://cicalfer.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const cookieBtn = page.locator('button:has-text("Aceitar todos"), button:has-text("Aceitar")').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Clicar para abrir modal de login
  await page.click('button#botao-login, a:has-text("Entrar"), .dropdown:has-text("Entrar")');
  await page.waitForTimeout(1500);

  // Inspecionar botões dentro da .modal ou no formulário
  const modalInfo = await page.evaluate(() => {
    const modal = document.querySelector('.modal, div[role="dialog"]');
    if (!modal) return { found: false };

    const inputs = Array.from(modal.querySelectorAll('input')).map(i => ({
      name: i.name,
      id: i.id,
      type: i.type,
      class: i.className
    }));

    const buttons = Array.from(modal.querySelectorAll('button, input[type="submit"], a.btn')).map(b => ({
      id: b.id,
      type: b.getAttribute('type'),
      class: b.className,
      text: b.innerText.trim(),
      tagName: b.tagName
    }));

    return {
      found: true,
      modalClass: modal.className,
      inputs,
      buttons
    };
  });

  console.log('Informações do Modal de Login:', JSON.stringify(modalInfo, null, 2));

  await browser.close();
})();
