import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function runDiagnosticoConstruja() {
  console.log('================================================================================');
  console.log('🔍 DIAGNÓSTICO DETALHADO CONSTRUJÁ: PAGINAÇÃO 96 ITENS & VALIDAÇÃO DE PREÇOS');
  console.log('================================================================================\n');

  const screenshotsDir = path.join(process.cwd(), 'scratch', 'screenshots_construja');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  }).catch(() => chromium.launch({ headless: true }));

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  console.log('--- DIAGNÓSTICO 1: INSPEÇÃO DE DROPDOWN REACT-SELECT E PARÂMETROS DE URL ---');
  console.log('1. Acessando https://www.construja.com.br/produtos...');
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator('button:has-text("Aceitar"), button:has-text("Concordar"), #lgpd-aceitar').first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // 1.a Texto atual selecionado no dropdown
  const selectedTextBefore = await page.evaluate(() => {
    const singleValue = document.querySelector('.react-select__single-value, [class*="singleValue"]');
    const container = document.querySelector('.react-select__control');
    return {
      singleValueText: singleValue?.textContent?.trim() || '',
      containerText: container?.textContent?.trim() || ''
    };
  });
  console.log('📌 Texto selecionado ANTES do clique:', selectedTextBefore);

  // Screenshot ANTES do clique
  const screenshotBeforePath = path.join(screenshotsDir, '01_before_select_click.png');
  await page.screenshot({ path: screenshotBeforePath, fullPage: false });
  console.log(`📸 Screenshot salvo: ${screenshotBeforePath}`);

  // 1.b Clicar e listar opções disponíveis
  console.log('2. Clicando no container react-select para abrir o menu...');
  const selectControl = page.locator('.react-select__control').first();
  await selectControl.click({ force: true });
  await page.waitForTimeout(1000);

  const availableOptions = await page.evaluate(() => {
    const options = Array.from(document.querySelectorAll('.react-select__option, [class*="option"]'));
    return options.map(o => ({ text: o.textContent?.trim(), id: o.id, className: o.className }));
  });
  console.log('📌 Opções disponíveis no dropdown:', availableOptions);

  // Screenshot COM MENU ABERTO / OPÇÃO 96
  const screenshotOpenPath = path.join(screenshotsDir, '02_dropdown_options_open.png');
  await page.screenshot({ path: screenshotOpenPath, fullPage: false });
  console.log(`📸 Screenshot salvo: ${screenshotOpenPath}`);

  // Clicar na opção 96
  const option96 = page.locator('.react-select__option:has-text("96"), [id*="react-select"]:has-text("96")').first();
  if (await option96.isVisible().catch(() => false)) {
    console.log('3. Clicando na opção "96 / página"...');
    await option96.click({ force: true });
    await page.waitForTimeout(3000);
  } else {
    console.log('3. Digitando "96" e selecionando via teclado...');
    await page.keyboard.type('96');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
  }

  // Screenshot DEPOIS do clique em 96
  const screenshotAfterPath = path.join(screenshotsDir, '03_after_select_96.png');
  await page.screenshot({ path: screenshotAfterPath, fullPage: false });
  console.log(`📸 Screenshot salvo: ${screenshotAfterPath}`);

  const cardsCountAfter96 = await page.evaluate(() => document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length);
  console.log(`📊 Total de Cards visíveis no DOM após selecionar 96: ${cardsCountAfter96}`);

  // Verificar se após ir para a Página 2 o dropdown reseta ou se a URL ganha parâmetros
  console.log('4. Clicando na Página 2 para testar se o dropdown reseta...');
  const page2Btn = page.locator('button').filter({ hasText: /^2$/ }).first();
  if (await page2Btn.isVisible().catch(() => false)) {
    await page2Btn.click();
    await page.waitForTimeout(3000);
  }

  const selectedTextPage2 = await page.evaluate(() => {
    const singleValue = document.querySelector('.react-select__single-value, [class*="singleValue"]');
    const container = document.querySelector('.react-select__control');
    return {
      singleValueText: singleValue?.textContent?.trim() || '',
      containerText: container?.textContent?.trim() || '',
      url: window.location.href,
      cardsCount: document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length
    };
  });
  console.log('📌 Estado na PÁGINA 2:', selectedTextPage2);

  // Testar se parâmetros de URL como ?per_page=96 ou ?size=96 funcionam
  console.log('\n5. Testando parâmetros de URL (?perPage=96, ?limit=96, ?tamanho=96)...');
  for (const paramStr of ['?perPage=96', '?itemsPerPage=96', '?size=96', '?limit=96', '?porPagina=96']) {
    const testUrl = `https://www.construja.com.br/produtos${paramStr}`;
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const countParam = await page.evaluate(() => document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]').length);
    console.log(`  - URL "${paramStr}" -> Cards no DOM: ${countParam}`);
  }

  console.log('\n--- DIAGNÓSTICO 2: INSPEÇÃO DE PREÇOS E ESTRUTURA DO HTML ---');
  await page.goto('https://www.construja.com.br/produtos', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(3000);

  // Capturar 5 produtos de exemplo
  const sampleProducts = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div[class*="CardProduto_cardBodyContainer"]')).slice(0, 5);
    return containers.map((c, idx) => {
      const titleEl = c.querySelector('[class*="CardProduto_tituloCardProduto"]');
      const rawTitle = titleEl?.textContent?.trim() || '';

      // Todos os elementos internos do container de preço
      const priceContainer = c.querySelector('[class*="preco"], [class*="Preco"], [class*="valor"], [class*="Valor"], div.d-flex.flex-column');
      const priceContainerHtml = priceContainer ? priceContainer.outerHTML : c.innerHTML;

      const wholeEl = c.querySelector('[class*="valorUnitarioDestaque"], [class*="valorUnitario"], span.fw-bold');
      const wholeText = wholeEl?.textContent?.trim() || '';

      const fullCardText = c.textContent?.trim() || '';

      return {
        idx: idx + 1,
        rawTitle,
        priceContainerHtml: priceContainerHtml.substring(0, 400),
        wholeText,
        fullCardTextSnippet: fullCardText.substring(0, 150)
      };
    });
  });

  console.log('\n🔍 EXAME DOS 5 PRODUTOS DE EXEMPLO:');
  sampleProducts.forEach(p => {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`PRODUTO #${p.idx}: "${p.rawTitle}"`);
    console.log(`HTML Bruto do Container de Preço:\n${p.priceContainerHtml}`);
    console.log(`Texto extraído pelo seletor de preço: "${p.wholeText}"`);
    console.log(`Snippet de texto do card: "${p.fullCardTextSnippet.replace(/\n+/g, ' ')}"`);
  });

  // Tirar screenshot da área de cards de produtos de exemplo
  const screenshotCardsPath = path.join(screenshotsDir, '04_cards_price_sample.png');
  await page.screenshot({ path: screenshotCardsPath, fullPage: false });
  console.log(`\n📸 Screenshot da grade de produtos salvo em: ${screenshotCardsPath}`);

  await browser.close();

  // Escrever resumo do diagnóstico em JSON no scratch
  const diagSummaryPath = path.join(process.cwd(), 'scratch', 'diagnostico_summary.json');
  fs.writeFileSync(diagSummaryPath, JSON.stringify({
    selectedTextBefore,
    availableOptions,
    selectedTextPage2,
    cardsCountAfter96,
    sampleProducts
  }, null, 2), 'utf-8');
}

runDiagnosticoConstruja().catch(console.error);
