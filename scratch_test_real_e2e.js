const { BrowserbaseService } = require('./lib/services/automacao/browserbaseService');
const { chromium } = require('playwright');

async function testarFornecedorE2E(fornecedorId, fornecedorNome) {
  console.log('\n====================================================');
  console.log(`🧪 TESTE REAL E2E BROWSERBASE: ${fornecedorNome} (${fornecedorId})`);
  console.log('====================================================');

  console.log(`\n📡 1. Criando sessão remota via BrowserbaseService para ${fornecedorNome}...`);
  const sessaoInfo = await BrowserbaseService.criarSessaoRemota();

  console.log('\n📊 Resumo da Sessão Criada:');
  console.log('   - Session ID:', sessaoInfo.sessionId);
  console.log('   - Connect URL (CDP):', sessaoInfo.connectUrl);
  console.log('   - Live View URL:', sessaoInfo.liveViewUrl);

  console.log(`\n🤖 2. Executando automação Playwright via CDP para ${fornecedorNome}...`);
  try {
    await BrowserbaseService.executarMontagemCarrinhoRemoto({
      fornecedorId,
      itens: [
        { texto: 'Cabo flexível 2.5mm', quantidade: 2 },
        { texto: 'Disjuntor Bipolar 20A', quantidade: 3 },
      ],
    });
    console.log(`\n✅ [BROWSERBASE WORKER] Automação finalizada para ${fornecedorNome}!`);
  } catch (err) {
    console.error(`\n❌ [BROWSERBASE WORKER ERRO COMPLETO] Falha na automação para ${fornecedorNome}:`, err);
  }

  // 3. Inspeção visual da Live View URL gerada usando Playwright headless
  console.log(`\n🖼️ 3. Inspecionando renderização visual da Live View URL em iframe (${sessaoInfo.liveViewUrl})...`);
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(sessaoInfo.liveViewUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    const urlFinal = page.url();
    const content = (await page.content()).toLowerCase();

    console.log('   - Título da página renderizada:', title);
    console.log('   - URL final da página:', urlFinal);
    console.log('   - Contém "reset password"?', content.includes('reset password') || content.includes('reset your password') ? 'SIM ❌' : 'NÃO ✅');
    console.log('   - Contém branding "browserbase"?', content.includes('browserbase made it possible') ? 'SIM ❌' : 'NÃO ✅');

    await browser.close();
  } catch (inspectErr) {
    console.warn('   ⚠️ Aviso ao inspecionar renderização:', inspectErr.message);
  }
}

async function executarTodosOsTestes() {
  await testarFornecedorE2E('forn-cicalfer', 'Cicalfer Material Elétrico');
  await testarFornecedorE2E('forn-construja', 'Construjá Distribuidora');

  console.log('\n====================================================');
  console.log('🏆 SUÍTE DE TESTES E2E CICALFER & CONSTRUJÁ CONCLUÍDA!');
  console.log('====================================================\n');
}

executarTodosOsTestes();
