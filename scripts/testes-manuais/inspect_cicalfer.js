// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Iniciando inspeção usando o supplier-quote-engine com login e filial reais...');
  const quoteEngine = require('../core/services/supplier-quote-engine');
  const cicalferConfig = require('../config/suppliers/cicalfer.json');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

  try {
    // 1. Login e Filial
    console.log('1. Executando realizarLogin na Cicalfer...');
    await quoteEngine.realizarLogin(page, cicalferConfig, {
      user: 'admin@saracota.com.br',
      pass: 'password123'
    });

    // 2. Busca 1: Termo do cliente "Cabo Flexível SIL 750V 2,5mm Azul"
    console.log('\n--- BUSCA 1: "Cabo Flexível SIL 750V 2,5mm Azul" ---');
    let searchInput = page.locator(cicalferConfig.selectors.search_input).first();
    await searchInput.fill('');
    await searchInput.fill('Cabo Flexível SIL 750V 2,5mm Azul');
    await page.locator(cicalferConfig.selectors.search_button).first().click({ force: true });
    await page.waitForTimeout(4000);

    let b1Result = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        hasProdutoNaoEncontrado: bodyText.includes('Produto não encontrado'),
        prices: bodyText.match(/R\$\s*\d+[\.,]\d{2}/g) || [],
        inputsCount: document.querySelectorAll('input').length
      };
    });
    console.log('Resultado Busca 1:', b1Result);

    // 3. Busca 2: Termo real do fornecedor "CABO FLEX 100M COBRECOM 2,50MM"
    console.log('\n--- BUSCA 2: "CABO FLEX 100M COBRECOM 2,50MM" ---');
    searchInput = page.locator(cicalferConfig.selectors.search_input).first();
    await searchInput.fill('');
    await searchInput.fill('CABO FLEX 100M COBRECOM 2,50MM');
    await page.locator(cicalferConfig.selectors.search_button).first().click({ force: true });
    await page.waitForTimeout(5000);

    const printPath = path.join(process.cwd(), 'docs', 'historico', 'prints', '07_inspecao_busca_cicalfer.png');
    await page.screenshot({ path: printPath, fullPage: false });
    console.log(`Print salvo em: ${printPath}`);

    // Inspecionar o DOM dos produtos encontrados na Busca 2
    const domInspection = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const prices = bodyText.match(/R\$\s*\d+[\.,]\d{2}/g) || [];

      const inputs = Array.from(document.querySelectorAll('input')).map((inp, idx) => ({
        index: idx,
        tagName: inp.tagName,
        type: inp.type,
        name: inp.name,
        id: inp.id,
        className: inp.className,
        outerHTML: inp.outerHTML,
        parentClass: inp.parentElement ? inp.parentElement.className : ''
      }));

      const quantityInputsExact = Array.from(document.querySelectorAll('input.QuantidadeMaisMenos_input__grKxO')).map(i => ({
        className: i.className,
        outerHTML: i.outerHTML
      }));

      const quantityInputsAny = Array.from(document.querySelectorAll('input[type="number"], input[class*="Quantidade"], input[class*="input"]')).map(i => ({
        className: i.className,
        outerHTML: i.outerHTML
      }));

      return {
        url: window.location.href,
        pricesFoundCount: prices.length,
        pricesFoundSample: prices.slice(0, 5),
        hasQuantInputExactClass: document.querySelector('input.QuantidadeMaisMenos_input__grKxO') !== null,
        quantityInputsExact,
        quantityInputsAny,
        inputs
      };
    });

    console.log('\n--- DOM INSPECTION RESULT (LOGGED IN) ---');
    console.log(JSON.stringify(domInspection, null, 2));

  } catch (err) {
    console.error('Erro na inspeção:', err);
  } finally {
    await browser.close();
  }
})();
