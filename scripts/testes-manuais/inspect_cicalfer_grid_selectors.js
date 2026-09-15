// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== INSPEÇÃO DOS SELETORES DA GRADE DE RESULTADOS DA BUSCA NA CICALFER ===');
  const quoteEngine = require('../core/services/supplier-quote-engine');
  const cicalferConfig = require('../config/suppliers/cicalfer.json');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

  try {
    console.log('1. Login na Cicalfer com santanacomercial2021@gmail.com...');
    await quoteEngine.realizarLogin(page, cicalferConfig, {
      user: 'santanacomercial2021@gmail.com',
      pass: 'password123'
    });

    console.log('2. Buscando pelo termo: "Cabo Flexível SIL 750V 2,5mm Azul"...');
    const searchInput = page.locator(cicalferConfig.selectors.search_input).first();
    await searchInput.fill('Cabo Flexível SIL 750V 2,5mm Azul');
    await page.locator(cicalferConfig.selectors.search_button).first().click({ force: true });
    await page.waitForTimeout(5000);

    const gridInspection = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        className: i.className,
        outerHTML: i.outerHTML,
        visible: i.offsetWidth > 0 && i.offsetHeight > 0
      }));

      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        innerText: b.innerText.slice(0, 50),
        className: b.className,
        outerHTML: b.outerHTML.slice(0, 150)
      }));

      return {
        url: window.location.href,
        inputs,
        buttonsSample: buttons.slice(0, 15)
      };
    });

    console.log('\n--- RESULTADO DA INSPEÇÃO DA GRADE DE BUSCA ---');
    console.log(JSON.stringify(gridInspection, null, 2));

  } catch (err) {
    console.error('Erro na inspeção:', err);
  } finally {
    await browser.close();
  }
})();
