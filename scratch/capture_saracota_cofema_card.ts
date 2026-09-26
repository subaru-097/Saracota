import { chromium } from 'playwright';
import path from 'path';

async function captureModalEvidence() {
  console.log('📷 Capturando evidência visual do modal da Saracota com o card Cofema...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // 1. Injetar usuário no localStorage para bypass do login
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const mockUser = {
      id: 'usr-admin-1',
      email: 'admin@saracota.com.br',
      nome: 'Administrador Sara Cota',
      role: 'proprietario',
      cargo: 'proprietario',
      clienteId: 'cli-default'
    };
    localStorage.setItem('saracota_active_user', JSON.stringify(mockUser));
  });

  // 2. Navegar para a página de cotações
  console.log('Navegando para http://localhost:3000/cotacoes...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 3. Se houver cotações ou botão de ver resultado, abrir
  const cotacaoRow = page.locator('tr, div.rounded-2xl, div[class*="border"]').filter({ hasText: 'Cofema' }).first();
  if (await cotacaoRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Cotação Cofema visível na lista. Clicando...');
    await cotacaoRow.click({ force: true });
    await page.waitForTimeout(2000);
  }

  const verResultadoBtn = page.locator('button:has-text("Resultado"), button:has-text("Ver Resultado"), button:has-text("Detalhes")').first();
  if (await verResultadoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Clicando em Ver Resultado...');
    await verResultadoBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  const artifactPath = path.join(
    process.cwd(),
    '..',
    '..',
    '.gemini',
    'antigravity-ide',
    'brain',
    '9afe03c5-78ef-4c7e-acb1-fbf735c49ad2',
    'evidencia_modal_cofema_saracota.png'
  );

  await page.screenshot({ path: artifactPath, fullPage: true });
  console.log(`📸 Evidência salva com sucesso em: ${artifactPath}`);

  await browser.close();
}

captureModalEvidence().catch(console.error);
