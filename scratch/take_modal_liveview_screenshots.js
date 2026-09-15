const { chromium } = require('playwright');
const path = require('path');

async function captureModalScreenshots() {
  console.log('🚀 Iniciando navegacao Playwright para disparar cotação Cicalfer e capturar modal...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\2fbca413-b577-4db3-a64c-3c348416032e';

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });

    // Clicar em Solicitar Cotação ou Nova Cotação
    const btnSolicitar = page.locator('button:has-text("Solicitar Cotação"), button:has-text("Nova Cotação")').first();
    if (await btnSolicitar.isVisible().catch(() => false)) {
      await btnSolicitar.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: path.join(artifactDir, 'cicalfer_etapa2_modal_selecao.png') });
      console.log('  📸 Screenshot Modal Seleção salvo!');

      // Confirmar envio
      const btnConfirmar = page.locator('button:has-text("Confirmar"), button:has-text("Solicitar"), button:has-text("Iniciar")').first();
      if (await btnConfirmar.isVisible().catch(() => false)) {
        await btnConfirmar.click();
        await page.waitForTimeout(2000);
      }
    }

    // Capturar modal de progresso
    await page.screenshot({ path: path.join(artifactDir, 'cicalfer_etapa2_modal_progresso.png') });
    console.log('  📸 Screenshot Modal Progresso salvo!');

    // Procurar botão de Transmissão ao vivo / Live View
    const btnLiveView = page.locator('button:has-text("Transmissão ao vivo"), button:has-text("Live View")').first();
    if (await btnLiveView.isVisible().catch(() => false)) {
      await btnLiveView.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(artifactDir, 'cicalfer_etapa2_liveview_modal.png') });
      console.log('  📸 Screenshot Live View Modal salvo!');
    }

  } catch (e) {
    console.error('Erro ao capturar screenshots de modal:', e.message);
  } finally {
    await browser.close();
  }
}

captureModalScreenshots().catch(console.error);
