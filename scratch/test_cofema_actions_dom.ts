import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const userCnpj = '43.313.798/0001-34';
const userSenha = 'Santana5419';

const historyDir = path.join(process.cwd(), 'historicos', 'debug_cofema_actions');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

async function run() {
  console.log('--- TEST COFEMA ACTIONS CELL DOM ---');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const entreBtn = page.locator('button:has-text("Entre ou Cadastre-se")').first();
    if (await entreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entreBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await page.getByText('Área do Cliente', { exact: true }).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.locator('#login-cnpj, input[name="login"], input[placeholder*="CNPJ"], input[type="text"]').first().fill(userCnpj);
      await page.locator('#login-senha, input[name="senha"], input[type="password"]').first().fill(userSenha);
      await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
      await page.waitForTimeout(5000);
    }

    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const carrinhosTab = page.locator('button:has-text("Carrinhos")').first();
    if (await carrinhosTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await carrinhosTab.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // Inspect the exact action icons HTML in the row
    const actionsHTML = await page.evaluate(() => {
      const row = document.querySelector('table tbody tr, div[class*="table"] tr');
      if (!row) return 'NO_ROW';
      const actionTd = row.children[1] || row.querySelector('td:nth-child(2)');
      const idTd = row.children[0] || row.querySelector('td:nth-child(1)');
      return {
        idTdText: idTd ? idTd.innerText : '',
        idTdHtml: idTd ? idTd.innerHTML : '',
        actionTdText: actionTd ? actionTd.innerText : '',
        actionTdHtml: actionTd ? actionTd.innerHTML : '',
        rowHtml: row.outerHTML
      };
    });
    console.log('Actions HTML:', JSON.stringify(actionsHTML, null, 2));

    // Try clicking the 3rd SVG/icon in actionTd or clicking the #130620 link
    console.log('Clicking 3rd action element...');
    const actionEls = page.locator('table tbody tr td').nth(1).locator('svg, button, a, div');
    const aCount = await actionEls.count();
    console.log(`Action elements count: ${aCount}`);

    for (let i = 0; i < aCount; i++) {
      console.log(`Clicking action element ${i}...`);
      await actionEls.nth(i).click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(historyDir, `action_${i}.png`) });

      // Check if modal or detail view appeared
      const pageInfo = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"], .offcanvas, div[class*="modal"], div[class*="Sheet"]');
        return {
          dialogText: dialog ? dialog.innerText.substring(0, 500) : 'NO_DIALOG',
          currentUrl: window.location.href
        };
      });
      console.log(`Action ${i} page info:`, pageInfo);
    }

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
