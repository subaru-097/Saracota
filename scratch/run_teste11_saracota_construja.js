const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'historicos', '2026-09-15', 'teste11_saracota_construja');
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
  logExec('=== INÍCIO DO DIAGNÓSTICO TESTE 11: CONSTRUJÁ SOLO NA SARACOTA ===');
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
      logExec(`[HTTP RES ${res.status()}] ${res.url()} -> ${bodyText.substring(0, 500)}`);
    }
  });

  logExec('Passo 1: Navegando para http://localhost:3000/cotacoes...');
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

  // Adicionar Item 1: 3x Caixa d'Água Fortlev 310L
  logExec('Passo 2.1: Inserindo Item 1 ("3x Caixa d\'Água Fortlev 310L")...');
  await inputItem.fill('3x Caixa d\'Água Fortlev 310L');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Adicionar Item 2: 6x Ducha Lorenzetti Bella Ducha 127V
  logExec('Passo 2.2: Inserindo Item 2 ("6x Ducha Lorenzetti Bella Ducha 127V")...');
  await inputItem.fill('6x Ducha Lorenzetti Bella Ducha 127V');
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

  // Desmarcar todos e marcar APENAS Construjá
  logExec('Passo 4: Selecionando APENAS o fornecedor Construjá no modal...');
  const cardConstruja = page.locator('div:has-text("Construjá")').last();
  const btnDesmarcar = page.locator('button:has-text("Desmarcar Todos")').first();
  
  if (await btnDesmarcar.isVisible().catch(() => false)) {
    logExec('Desmarcando fornecedores pré-selecionados...');
    await btnDesmarcar.click();
    await page.waitForTimeout(300);
  }

  logExec('Marcando o card da Construjá...');
  await cardConstruja.click();
  await page.waitForTimeout(500);

  // Screenshot 00: Modal com apenas Construjá marcado
  await page.screenshot({ path: path.join(printsDir, '00_modal_apenas_construja.png') });
  logExec('Screenshot do modal salvo em 00_modal_apenas_construja.png');

  // Disparar Cotação para Construjá
  logExec('Passo 5: Clicando no botão "Cotar (1)" para disparar cotação da Construjá...');
  const btnConfirmar = page.locator('button:has-text("Cotar (1)"), button:has-text("Cotar")').last();
  await btnConfirmar.click();
  const tsStartClick = new Date().toISOString();
  logExec(`[TIMELINE] Timestamp do clique no botão Cotar: ${tsStartClick}`);

  // Screenshot 01: Imediatamente após clicar em Cotar
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(printsDir, '01_apos_clicar_cotar.png') });
  logExec('Screenshot 01 salvo em 01_apos_clicar_cotar.png');

  // Screenshot 02: 2s após (redirecionamento ou modal de progresso)
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(printsDir, '02_redirecionamento_ou_progresso.png') });
  logExec('Screenshot 02 salvo em 02_redirecionamento_ou_progresso.png');

  // Observar por 25 segundos a evolução do backend e polling
  logExec('Passo 6: Monitorando status do servidor por 25s...');
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(3000);
    logExec(`Check ${i}/8 (${i * 3}s): URL = ${page.url()}`);
    if (i === 2) {
      await page.screenshot({ path: path.join(printsDir, '03_progresso_intermediario.png') });
      logExec('Screenshot 03 salvo em 03_progresso_intermediario.png');
    }
  }

  // Screenshot 04: Tela final após o tempo de espera
  await page.screenshot({ path: path.join(printsDir, '04_resultado_final.png') });
  logExec('Screenshot 04 salvo em 04_resultado_final.png');

  // Extrair texto completo da tela para diagnóstico
  const textContent = await page.evaluate(() => document.body.innerText);
  logDiag('=================================================================');
  logDiag('=== CONTEÚDO BRUTO EXTRAÍDO DA INTERFACE DO USUÁRIO (TEXTO) ===');
  logDiag('=================================================================');
  logDiag(textContent);

  // Extrair snapshot dos cards de fornecedores renderizados
  const suppliersRendered = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rounded-2xl, .rounded-xl'));
    return cards.map(c => c.innerText).filter(t => t.includes('Construjá') || t.includes('Cicalfer') || t.includes('Lojista'));
  });
  logDiag(`[RENDERED CARDS DETECTADOS] Count: ${suppliersRendered.length}`);
  suppliersRendered.forEach((txt, idx) => {
    logDiag(`--- CARD ${idx + 1} ---\n${txt}\n------------------`);
  });

  const jsonOutput = {
    testName: 'Teste 11 - Construjá Solo na SaraCota',
    timestamp: new Date().toISOString(),
    urlFinal: page.url(),
    renderedCardsCount: suppliersRendered.length,
    renderedCards: suppliersRendered,
  };
  fs.writeFileSync(jsonResultPath, JSON.stringify(jsonOutput, null, 2));

  logExec('=== TESTE 11 CONSTRUJÁ SOLO CONCLUÍDO ===');
  await browser.close();
})().catch((err) => {
  logExec(`[FATAL ERROR TESTE 11] ${err.stack || err}`);
  process.exit(1);
});
