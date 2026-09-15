const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function verifyModal() {
  console.log('🚀 Iniciando verificação do modal de fornecedores no browser...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Digitar 1 item no bloco de compras
    const inputItem = page.locator('input[placeholder*="Adicionar"], input[type="text"]').first();
    if (await inputItem.isVisible().catch(() => false)) {
      await inputItem.fill('1x DUCHA LORENZETTI');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Clicar em "Cotar com Fornecedores"
    const cotarBtn = page.locator('button:has-text("Cotar com Fornecedores"), button:has-text("Enviar"), button:has-text("Cotar")').first();
    if (await cotarBtn.isVisible().catch(() => false)) {
      console.log('Clicando em "Cotar com Fornecedores"...');
      await cotarBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }

    const screenshotPath = path.join(__dirname, 'modal_fornecedores_validado.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot do modal salvo: ${screenshotPath}`);

    const modalText = await page.evaluate(() => document.body.innerText);

    const hasSecofair = modalText.toLowerCase().includes('secofair');
    const hasConstruja = modalText.toLowerCase().includes('construjá') || modalText.toLowerCase().includes('construja');
    const hasMegaleste = modalText.toLowerCase().includes('megaleste');
    const hasCicalfer = modalText.toLowerCase().includes('cicalfer');

    console.log(`- Secofair presente?: ${hasSecofair ? '❌ SIM (ERRO)' : '✅ NÃO (CORRETO)'}`);
    console.log(`- Construjá presente?: ${hasConstruja ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`- Megaleste presente?: ${hasMegaleste ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`- Cicalfer presente?: ${hasCicalfer ? '✅ SIM' : '❌ NÃO'}`);

    const supplierStatus = await page.evaluate(() => {
      const results = [];
      const cards = Array.from(document.querySelectorAll('div, label, tr'));
      cards.forEach(card => {
        const text = card.textContent || '';
        if (text.includes('Construjá') || text.includes('Cicalfer') || text.includes('Megaleste') || text.includes('Secofair')) {
          if (card.children.length > 0 && card.children.length < 10) {
            results.push({
              nome: text.includes('Construjá') ? 'Construjá' : text.includes('Cicalfer') ? 'Cicalfer' : text.includes('Megaleste') ? 'Megaleste' : 'Secofair',
              hasRpaBadge: text.includes('RPA') || text.includes('Autônomo') || text.includes('Ativo'),
              fullTextSnippet: text.substring(0, 120).replace(/\s+/g, ' ')
            });
          }
        }
      });
      return results;
    });

    console.log('\n--- DETALHAMENTO DE FORNECEDORES NO MODAL UI ---');
    console.log(JSON.stringify(supplierStatus, null, 2));

  } catch (err) {
    console.error('❌ Erro na verificação:', err);
  } finally {
    await browser.close();
  }
}

verifyModal();
