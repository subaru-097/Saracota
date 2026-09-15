// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

(async () => {
  const printsDir = path.join(process.cwd(), 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log('1. Acessando SaraCota UI em http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('#email', 'colaborador@saracota.com.br');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/cotacoes', { timeout: 15000 }).catch(async () => {
      await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    });

    await page.waitForTimeout(3000);

    // Mudar para subAba "Resultado Banco Real"
    const btnResultado = page.locator('button:has-text("Resultado Banco Real")').first();
    if (await btnResultado.isVisible()) {
      await btnResultado.click();
      await page.waitForTimeout(2000);
    }

    // PRINT C: Tela principal de resultados no SaraCota UI
    const printC = path.join(printsDir, '2026-09-10_ui_03_resultado_final_saracota.png');
    await page.screenshot({ path: printC, fullPage: true });
    console.log(`📸 [PRINT C SALVO] ${printC}`);

    // Clicar no card/linha da Cicalfer para abrir o modal com os itens e o botão "Ir para o Fornecedor"
    const cardCicalfer = page.locator('div:has-text("Cicalfer")').last();
    if (await cardCicalfer.isVisible()) {
      await cardCicalfer.click();
      await page.waitForTimeout(1500);
    }

    // PRINT C MODAL: Modal de detalhes com os 3 produtos, preços e totais
    const printCModal = path.join(printsDir, '2026-09-10_ui_03b_modal_resultado_saracota.png');
    await page.screenshot({ path: printCModal, fullPage: true });
    console.log(`📸 [PRINT C MODAL SALVO] ${printCModal}`);

    // Clicar ou abrir a URL do carrinho Cicalfer no browser
    console.log('2. Acessando o portal Cicalfer para capturar o carrinho montado...');
    const pageCicalfer = await context.newPage();
    await pageCicalfer.goto('https://cicalfer.com.br/carrinho', { waitUntil: 'networkidle', timeout: 35000 }).catch(() => {});
    await pageCicalfer.waitForTimeout(3000);

    // PRINT D: Carrinho Cicalfer no portal do fornecedor
    const printD = path.join(printsDir, '2026-09-10_ui_04_carrinho_cicalfer_confirmado.png');
    await pageCicalfer.screenshot({ path: printD, fullPage: true });
    console.log(`📸 [PRINT D SALVO] ${printD}`);

    console.log('Captura de telas de resultado concluída com sucesso!');
  } catch (err) {
    console.error('Erro na captura:', err);
  } finally {
    await browser.close();
  }
})();
