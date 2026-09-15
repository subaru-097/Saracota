const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const timeTag = '14-09_15h31';
const historyDir = path.join(__dirname, '..', 'docs', 'historico', `Correcao Leitura Frontend Cotacoes - ${timeTag}`);
const printsDir = path.join(historyDir, 'prints');

if (!fs.existsSync(printsDir)) {
  fs.mkdirSync(printsDir, { recursive: true });
}

async function captureFrontendUi() {
  console.log('=== CAPTURANDO PRINTS REAIS DO FRONTEND SARACOTA ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // 1. Acessar /login e preencher formulário
  console.log('Navegando para http://localhost:3000/login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[name="email"]', { timeout: 5000 });
  await page.fill('input[name="email"]', 'colaborador@saracota.com.br');
  await page.fill('input[name="password"]', '123456');
  
  await page.click('button[type="submit"]');
  console.log('Aguardando redirecionamento após login...');
  await page.waitForTimeout(2500);

  if (!page.url().includes('/cotacoes')) {
    console.log(`URL atual: ${page.url()}. Forçando navegação para /cotacoes...`);
    await page.goto('http://localhost:3000/cotacoes');
  }

  await page.waitForTimeout(3500); // Aguarda `carregarCotacoesDoBanco`

  // 2. Clicar na aba "Resultado Banco Real"
  console.log('Clicando na aba "Resultado Banco Real"...');
  const abaBancoReal = page.getByText('Resultado Banco Real');
  if (await abaBancoReal.isVisible().catch(() => false)) {
    await abaBancoReal.click();
    await page.waitForTimeout(2000);
  }

  // Print 03: Tela da aba Resultado Banco Real com cotação e produtos reais
  const print03Path = path.join(printsDir, '03-saracota-resultado-banco-real-produtos.png');
  await page.screenshot({ path: print03Path, fullPage: true });
  console.log(`✓ Print 03 salvo: ${print03Path}`);

  // 3. Clicar no texto "Cicalfer Material Elétrico" exato
  console.log('Clicando no texto "Cicalfer Material Elétrico"...');
  const elementoCicalfer = page.getByText('Cicalfer Material Elétrico').first();
  await elementoCicalfer.click();
  await page.waitForTimeout(2000);

  // Print 04: Modal com os 5 produtos reais
  const print04Path = path.join(printsDir, '04-saracota-modal-detalhes-5-produtos.png');
  await page.screenshot({ path: print04Path, fullPage: true });
  console.log(`✓ Print 04 salvo (Modal Detalhes): ${print04Path}`);

  await browser.close();
  console.log('=== PRINTS CAPTURADOS COM SUCESSO ===');
}

captureFrontendUi().catch(err => {
  console.error('Erro ao capturar UI:', err);
  process.exit(1);
});
