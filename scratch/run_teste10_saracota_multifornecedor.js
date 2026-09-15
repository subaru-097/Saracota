const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'historicos', '2026-09-15', 'teste10_saracota_multifornecedor');
const printsDir = path.join(baseDir, 'prints');
fs.mkdirSync(printsDir, { recursive: true });

const execLogPath = path.join(baseDir, 'execucao_detalhada.log');
const diagLogPath = path.join(baseDir, 'diagnostico_duplicacao.log');
const jsonResultPath = path.join(baseDir, 'resultado_saracota.json');

fs.writeFileSync(execLogPath, '');
fs.writeFileSync(diagLogPath, '');

function logExec(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync(execLogPath, line);
}

function logDiag(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync(diagLogPath, line);
}

(async () => {
  logExec('=================================================================');
  logExec('=== INÍCIO DO DIAGNÓSTICO TESTE 10: SARACOTA MULTI-FORNECEDOR ===');
  logExec('=================================================================');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // Injetar sessão de dev autenticada no localStorage
  await page.addInitScript(() => {
    localStorage.setItem('saracota_active_user', JSON.stringify({
      id: 'usr-demo-123',
      email: 'comprador@saracota.com.br',
      nome: 'Comprador SaraCota',
      role: 'colaborador',
      cargo: 'comprador',
      clienteId: 'cli-default'
    }));
  });

  page.on('console', (msg) => {
    logExec(`[BROWSER CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      logExec(`[HTTP REQ] ${req.method()} ${req.url()}`);
      if (req.method() === 'POST' && req.postData()) {
        logExec(`[HTTP REQ BODY] ${req.postData()}`);
      }
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('/api/')) {
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch (e) {}
      logExec(`[HTTP RES ${res.status()}] ${res.url()} -> ${bodyText.substring(0, 400)}`);
    }
  });

  logExec('Passo 1: Navegando para http://localhost:3000/cotacoes com sessão injetada...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Garantir sub-aba Bloco de Notas ativa
  const btnSubAbaBloco = page.locator('button:has-text("Bloco de Notas")').first();
  if (await btnSubAbaBloco.isVisible().catch(() => false)) {
    logExec('Clicando na sub-aba "Bloco de Notas"...');
    await btnSubAbaBloco.click();
    await page.waitForTimeout(1000);
  }

  // Localizar campo de entrada do item
  const inputItem = page.locator('input[placeholder*="Digite o item"]').first();
  await inputItem.waitFor({ state: 'visible', timeout: 15000 });
  logExec('Campo de entrada de itens localizado com sucesso!');

  // Limpar itens antigos do rascunho
  const trashBtns = page.locator('button[title*="Remover"], button:has(svg.lucide-trash-2)');
  let trashCount = await trashBtns.count().catch(() => 0);
  if (trashCount > 0) {
    logExec(`Limpando ${trashCount} item(ns) rascunho antigo(s)...`);
    for (let i = 0; i < trashCount; i++) {
      const btn = trashBtns.first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  }

  // Adicionar Item 1: 3x CAIXA DA AGUA FORTLEV 310L
  logExec('Passo 2.1: Inserindo Item 1 ("3x CAIXA DA AGUA FORTLEV 310L")...');
  await inputItem.fill('3x CAIXA DA AGUA FORTLEV 310L');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Adicionar Item 2: 6x DUCHA LORENZETTI BELLA DUCHA 127V
  logExec('Passo 2.2: Inserindo Item 2 ("6x DUCHA LORENZETTI BELLA DUCHA 127V")...');
  await inputItem.fill('6x DUCHA LORENZETTI BELLA DUCHA 127V');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Preencher Nome da Obra / CNPJ
  const inputObra = page.locator('input[placeholder*="Obra"], input[placeholder*="obra"]').first();
  if (await inputObra.isVisible().catch(() => false)) {
    logExec('Garantindo Obra: "Reserva das Palmeiras"...');
    await inputObra.fill('Reserva das Palmeiras');
    await page.waitForTimeout(500);
  }

  // Clicar em "Cotar com Fornecedores"
  logExec('Passo 3: Clicando em "Cotar com Fornecedores"...');
  const btnCotarForn = page.locator('button:has-text("Cotar com Fornecedores")').first();
  await btnCotarForn.click();
  await page.waitForTimeout(1000);

  // Verificar seleção de Cicalfer e Construjá no modal
  logExec('Passo 4: Verificando fornecedores selecionados no modal...');
  const btnConfirmar = page.locator('button:has-text("Cotar ("), button:has-text("Cotar")').last();
  
  if (await btnConfirmar.isDisabled()) {
    logExec('Botão Cotar está desabilitado. Clicando em "Selecionar Fornecedores com RPA Ativo"...');
    const btnSelRpa = page.locator('button:has-text("Selecionar Fornecedores com RPA Ativo")').first();
    await btnSelRpa.click();
    await page.waitForTimeout(500);
  } else {
    logExec('Fornecedores com RPA já vieram pré-selecionados por padrão!');
  }

  await page.waitForTimeout(500);

  // Print 0: Modal com fornecedores selecionados
  await page.screenshot({ path: path.join(printsDir, '00_modal_fornecedores_selecionados.png') });
  logExec('Screenshot do modal salvo em 00_modal_fornecedores_selecionados.png');

  // Disparar Cotação Multi-Fornecedor
  logExec('Passo 5: Clicando em "Cotar" para disparar cotação multi-fornecedor...');
  await btnConfirmar.click();
  const tsStartClick = new Date().toISOString();
  logExec(`[TIMELINE] Timestamp do clique no botão Cotar: ${tsStartClick}`);

  // PRINT 1: Momento imediato após clicar em "Cotar"
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(printsDir, '01_apos_clicar_cotar.png') });
  logExec('PRINT 1 salvo: 01_apos_clicar_cotar.png');

  // PRINT 2: 2 segundos após clique (redirecionamento ou modal de progresso)
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(printsDir, '02_redirecionamento_ou_progresso.png') });
  logExec('PRINT 2 salvo: 02_redirecionamento_ou_progresso.png');

  // PRINT 3: 5 segundos após clique (indicador de progresso ou tela intermediária)
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(printsDir, '03_progresso_ou_resultado_intermediario.png') });
  logExec('PRINT 3 salvo: 03_progresso_ou_resultado_intermediario.png');

  // Aguardar finalização do processamento backend
  logExec('Aguardando 20 segundos adicionais para observação do fluxo completo...');
  await page.waitForTimeout(20000);

  // PRINT 4: Resultado final exibido
  await page.screenshot({ path: path.join(printsDir, '04_resultado_final.png') });
  logExec('PRINT 4 salvo: 04_resultado_final.png');

  // Extrair texto completo da interface para diagnóstico
  const textContent = await page.evaluate(() => document.body.innerText);
  logDiag('=================================================================');
  logDiag('=== CONTEÚDO BRUTO EXTRAÍDO DA INTERFACE DO USUÁRIO (TEXTO) ===');
  logDiag('=================================================================');
  logDiag(textContent);

  // Extrair snapshot dos elementos de fornecedores renderizados
  const suppliersRendered = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rounded-2xl, .rounded-xl'));
    return cards.map(c => c.innerText).filter(t => t.includes('Cicalfer') || t.includes('Construjá') || t.includes('Lojista'));
  });
  logDiag(`[RENDERED CARDS DETECTADOS] Count: ${suppliersRendered.length}`);
  suppliersRendered.forEach((txt, idx) => {
    logDiag(`--- CARD ${idx + 1} ---\n${txt}\n------------------`);
  });

  // Salvar snapshot JSON
  const jsonOutput = {
    testName: 'Teste 10 - Multi-fornecedor (Cicalfer + Construjá)',
    timestamp: new Date().toISOString(),
    urlFinal: page.url(),
    renderedCardsCount: suppliersRendered.length,
    renderedCards: suppliersRendered,
  };
  fs.writeFileSync(jsonResultPath, JSON.stringify(jsonOutput, null, 2));

  logExec('=== TESTE 10 MULTI-FORNECEDOR CONCLUÍDO ===');
  await browser.close();
})().catch((err) => {
  logExec(`[FATAL ERROR TESTE 10] ${err.stack || err}`);
  process.exit(1);
});
