// Script oficial de execução E2E do teste real via interface web da Saracota
// Data de Execução: 2026-09-14 13:25

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const timestampFolder = '2026-09-14_13h25_teste-real-e2e-pos-fases-1-2-3';
const baseDir = path.join('c:\\Users\\User\\Desktop\\Saracota', 'docs', 'historico', timestampFolder);
const printsDir = path.join(baseDir, 'prints');

const logFile = path.join(baseDir, 'logs-completo.txt');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function writeLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    page.on('console', msg => writeLog(`[BROWSER CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`));
    page.on('pageerror', err => writeLog(`[BROWSER UNCAUGHT ERROR] ${err.message}`));

    writeLog('Navegando para http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Adicionar Item "Cabo Flex 2.5mm"
    const inputItem = page.locator('input[placeholder*="item" i], input[placeholder*="material" i]').first();
    if (await inputItem.isVisible()) {
      await inputItem.fill('Cabo Flex 2.5mm');
      const addBtn = page.locator('button:has-text("Adicionar"), button:has-text("+")').first();
      if (await addBtn.isVisible()) await addBtn.click();
    }

    // Disparar Cotação com Fornecedores
    const cotarBtn = page.locator('button:has-text("Cotar com Fornecedores")').first();
    await cotarBtn.click();
    await page.waitForTimeout(1000);

    // Selecionar Cicalfer
    const cicalferLabel = page.locator('label:has-text("Cicalfer"), div:has-text("Cicalfer")').first();
    if (await cicalferLabel.isVisible()) await cicalferLabel.click();

    // Confirmar
    const confirmBtn = page.locator('button:has-text("Cotar ("), button:has-text("Cotar")').last();
    await confirmBtn.click();
    await page.waitForTimeout(1500);

    // Print 01
    await page.screenshot({ path: path.join(printsDir, '01-modal-progresso-cotacao.png'), fullPage: true });

    // Aguardar conclusão RPA
    await page.waitForTimeout(25000);

    // Print 03 & 04
    await page.screenshot({ path: path.join(printsDir, '03-preco-extraido-relatorio-saracota.png'), fullPage: true });
    await page.screenshot({ path: path.join(printsDir, '04-tela-final-cotacao-concluida.png'), fullPage: true });

  } finally {
    if (browser) await browser.close();
    logStream.end();
  }
})();
