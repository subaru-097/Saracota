// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { chromium } from 'playwright';
import path from 'path';

async function capturarModalUi() {
  console.log('📸 CAPTURANDO PRINT DO NOVO LAYOUT DO MODAL...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Fazer login normal na interface
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@saracota.com.br');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2500);

    // 2. Ir para /cotacoes
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Se a aba Resultado Banco Real existir, clicar nela
    const abaResultado = page.locator('button', { hasText: 'Resultado Banco Real' });
    if (await abaResultado.isVisible()) {
      await abaResultado.click();
      await page.waitForTimeout(1500);
    }

    // 3. Clicar no primeiro card de resumo por fornecedor
    const cardSupplier = page.locator('div:has-text("Resumo por Fornecedor Cotado") + div > div').first();
    if (await cardSupplier.isVisible()) {
      await cardSupplier.click();
      await page.waitForTimeout(1500);
    } else {
      // Se não houver cotação ativa, abrir o modal diretamente alterando a URL ou clicando em 'Cotação'
      console.log('Nenhum card visível no momento, tentando primeiro card de fornecedor disponível.');
      const anyCard = page.locator('.cursor-pointer').first();
      if (await anyCard.isVisible()) {
        await anyCard.click();
        await page.waitForTimeout(1500);
      }
    }

    const printPath = path.join(process.cwd(), 'docs', 'historico', 'prints', '2026-09-10_novo_layout_modal_resultado_cicalfer.png');
    await page.screenshot({ path: printPath, fullPage: true });
    console.log(`✅ Print do modal salvo em: ${printPath}`);

    const artifactPath = path.join(process.cwd(), '..', '..', '..', '..', '.gemini', 'antigravity-ide', 'brain', '6a4fd8ec-1ccb-4116-a0a6-1cae06dc161c', '2026-09-10_novo_layout_modal_resultado_cicalfer.png');
    await page.screenshot({ path: artifactPath, fullPage: true });
    console.log(`✅ Copy salva no artifact: ${artifactPath}`);
  } catch (e) {
    console.error('Erro na captura do print:', e);
  } finally {
    await browser.close();
  }
}

capturarModalUi();
