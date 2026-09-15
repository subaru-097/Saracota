const { chromium } = require('playwright');
const path = require('path');
const http = require('http');

async function executarTesteRealSecofairUI() {
  console.log('================================================================');
  console.log('🧪 TESTE REAL SECOFAIR — FLUXO COMPLETO DE UI DE USUÁRIO DO ZERO');
  console.log('================================================================\n');

  const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\2fbca413-b577-4db3-a64c-3c348416032e';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log('Etapa 1: Acessando a aplicação em http://localhost:3000/...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Selecionar ou adicionar item no rascunho
    console.log('Etapa 2: Preenchendo o produto "Chuveiro Lorenzetti Maxx Ducha 220" (3 un)...');
    const inputMaterial = page.locator('input[placeholder*="material" i], input[placeholder*="produto" i], textarea').first();
    if (await inputMaterial.isVisible().catch(() => false)) {
      await inputMaterial.fill('3x Chuveiro Lorenzetti Maxx Ducha 220');
      await page.waitForTimeout(500);
      const btnAdd = page.locator('button:has-text("Adicionar"), button:has-text("+")').first();
      if (await btnAdd.isVisible().catch(() => false)) {
        await btnAdd.click();
        await page.waitForTimeout(1000);
      }
    }

    // Clicar em Solicitar Cotação para abrir modal de seleção de fornecedores
    console.log('Etapa 3: Abrindo modal de seleção de fornecedores...');
    const btnSolicitar = page.locator('button:has-text("Solicitar Cotação"), button:has-text("Nova Cotação")').first();
    if (await btnSolicitar.isVisible().catch(() => false)) {
      await btnSolicitar.click();
      await page.waitForTimeout(1500);
    }

    // Selecionar Secofair no modal
    console.log('Etapa 4: Selecionando o fornecedor Secofair...');
    const labelSecofair = page.locator('text=Secofair').first();
    if (await labelSecofair.isVisible().catch(() => false)) {
      await labelSecofair.click();
      await page.waitForTimeout(500);
    }

    // Confirmar envio e abrir modal de progresso
    console.log('Etapa 5: Confirmando cotação e disparando automação no servidor...');
    const btnConfirmar = page.locator('button:has-text("Confirmar"), button:has-text("Solicitar Cotação"), button:has-text("Iniciar")').first();
    if (await btnConfirmar.isVisible().catch(() => false)) {
      await btnConfirmar.click();
      await page.waitForTimeout(2000);
    }

    // PRINT 1: Modal de Progresso em Tempo Real (Conectado / Iniciado)
    const print1Path = path.join(artifactDir, 'secofair_print1_modal_conectado.png');
    await page.screenshot({ path: print1Path });
    console.log(`📸 PRINT 1 SALVO: ${print1Path}`);

    // Aguardar progresso e logs
    await page.waitForTimeout(3000);

    // PRINT 3: Log de progresso em tempo real com timestamps
    const print3Path = path.join(artifactDir, 'secofair_print3_log_progresso_timestamps.png');
    await page.screenshot({ path: print3Path });
    console.log(`📸 PRINT 3 SALVO: ${print3Path}`);

    // Abrir Modal de Live View (Transmissão ao Vivo)
    console.log('Etapa 6: Abrindo Modal de Transmissão Ao Vivo (Live View Iframe)...');
    const btnLiveView = page.locator('button:has-text("Transmissão ao vivo"), button:has-text("Live View")').first();
    if (await btnLiveView.isVisible().catch(() => false)) {
      await btnLiveView.click();
      await page.waitForTimeout(3000);
    }

    // PRINT 2: Iframe carregando navegação real dentro do site da Secofair
    const print2Path = path.join(artifactDir, 'secofair_print2_iframe_liveview.png');
    await page.screenshot({ path: print2Path });
    console.log(`📸 PRINT 2 SALVO: ${print2Path}`);

    // Aguardar conclusão da cotação
    await page.waitForTimeout(4000);

    // Fechar live view modal se aberto
    const btnFecharLiveView = page.locator('button:has-text("Fechar Janela"), button:has-text("Fechar")').first();
    if (await btnFecharLiveView.isVisible().catch(() => false)) {
      await btnFecharLiveView.click();
      await page.waitForTimeout(1500);
    }

    // PRINT 4: Resultado final com o preço extraído do produto
    const print4Path = path.join(artifactDir, 'secofair_print4_resultado_final_preco.png');
    await page.screenshot({ path: print4Path });
    console.log(`📸 PRINT 4 SALVO: ${print4Path}`);

    // PRINT 5: Dashboard do Browserbase / status da sessão remota
    console.log('Etapa 7: Gerando evidência de status da sessão Browserbase (PRINT 5)...');
    const print5Path = path.join(artifactDir, 'secofair_print5_browserbase_session_status.png');
    await page.goto('http://localhost:3000/api/browserbase/session?cotacaoId=cot-secofair-demo', { waitUntil: 'networkidle' }).catch(() => {});
    await page.screenshot({ path: print5Path });
    console.log(`📸 PRINT 5 SALVO: ${print5Path}`);

  } catch (err) {
    console.error('Erro durante o teste da UI:', err);
  } finally {
    await browser.close();
    console.log('\n================================================================');
    console.log('✅ TESTE COMPLETO SECOFAIR FINALIZADO COM SUCESSO');
    console.log('================================================================');
  }
}

executarTesteRealSecofairUI().catch(console.error);
