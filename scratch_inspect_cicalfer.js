const { chromium } = require('playwright');

async function inspectCicalferNetwork() {
  console.log('🚀 Iniciando navegação no site da Cicalfer para inspecionar requisições de adicao de carrinho...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const requestsCaptured = [];

  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    if (url.includes('cart') || url.includes('carrinho') || url.includes('add') || url.includes('item') || url.includes('wc-api') || url.includes('api')) {
      requestsCaptured.push({ method, url, postData: request.postData() });
      console.log(`📡 [REQUEST CAPTURED] ${method} ${url}`);
    }
  });

  try {
    console.log('Navegando para https://www.cicalfer.com.br...');
    await page.goto('https://www.cicalfer.com.br', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Página Cicalfer carregada. URL final:', page.url());

    // Tentar localizar um produto na home ou busca
    const searchInput = page.locator('input[type="search"], input[name="s"], input[placeholder*="buscar" i]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('cabo 2,5mm');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      console.log('Busca realizada. URL:', page.url());
    }
  } catch (err) {
    console.error('⚠️ Erro ao navegar na Cicalfer:', err.message);
  } finally {
    await browser.close();
    console.log('\n📊 Resumo de requisições capturadas:', requestsCaptured.length);
    requestsCaptured.forEach((r, idx) => console.log(` [${idx + 1}] ${r.method} ${r.url}`));
  }
}

inspectCicalferNetwork();
