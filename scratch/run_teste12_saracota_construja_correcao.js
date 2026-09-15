const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'historicos', '2026-09-15', 'teste12_saracota_construja_correcao');
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

async function rodarCenario(nomeCenario, fornecedoresParaSelecionar, printPrefix) {
  logExec(`=================================================================`);
  logExec(`=== INÍCIO DO CENÁRIO: ${nomeCenario.toUpperCase()} ===`);
  logExec(`=================================================================`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

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
      logExec(`[HTTP REQ ${nomeCenario}] ${req.method()} ${req.url()}`);
      if (req.method() === 'POST' && req.postData()) {
        logExec(`[HTTP REQ BODY ${nomeCenario}] ${req.postData()}`);
      }
    }
  });

  let currentCotacaoId = null;

  page.on('response', async (res) => {
    if (res.url().includes('/api/cotacoes/') && res.url().includes('/processar') && res.status() === 200) {
      try {
        const json = await res.json();
        if (json.cotacaoId) {
          currentCotacaoId = json.cotacaoId;
          logExec(`[API RESPONSE ${nomeCenario}] Processamento iniciado para cotacaoId: ${currentCotacaoId}`);
        }
      } catch (e) {}
    }
  });

  logExec(`Passo 1 (${nomeCenario}): Navegando para http://localhost:3000/cotacoes...`);
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const btnSubAbaBloco = page.locator('button:has-text("Bloco de Notas")').first();
  if (await btnSubAbaBloco.isVisible().catch(() => false)) {
    logExec(`Clicando na sub-aba "Bloco de Notas"...`);
    await btnSubAbaBloco.click();
    await page.waitForTimeout(1000);
  }

  const inputItem = page.locator('input[placeholder*="Digite o item"]').first();
  await inputItem.waitFor({ state: 'visible', timeout: 15000 });

  // Limpar itens antigos
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
  logExec(`Passo 2.1 (${nomeCenario}): Inserindo Item 1 ("3x Caixa d'Água Fortlev 310L")...`);
  await inputItem.fill('3x Caixa d\'Água Fortlev 310L');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Adicionar Item 2: 6x Ducha Lorenzetti Bella Ducha 127V
  logExec(`Passo 2.2 (${nomeCenario}): Inserindo Item 2 ("6x Ducha Lorenzetti Bella Ducha 127V")...`);
  await inputItem.fill('6x Ducha Lorenzetti Bella Ducha 127V');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  // Preencher Nome da Obra
  const inputObra = page.locator('input[placeholder*="Obra"], input[placeholder*="obra"]').first();
  if (await inputObra.isVisible().catch(() => false)) {
    await inputObra.fill('Reserva das Palmeiras');
    await page.waitForTimeout(500);
  }

  // Clicar em Cotar com Fornecedores
  logExec(`Passo 3 (${nomeCenario}): Clicando em "Cotar com Fornecedores"...`);
  const btnCotarForn = page.locator('button:has-text("Cotar com Fornecedores")').first();
  await btnCotarForn.click();
  await page.waitForTimeout(1000);

  // Desmarcar todos primeiro
  const btnDesmarcar = page.locator('button:has-text("Desmarcar Todos")').first();
  if (await btnDesmarcar.isVisible().catch(() => false)) {
    await btnDesmarcar.click();
    await page.waitForTimeout(400);
  }

  // Selecionar fornecedores solicitados
  for (const fornNome of fornecedoresParaSelecionar) {
    logExec(`Marcando fornecedor: "${fornNome}"...`);
    const cardTarget = page.locator(`div:has-text("${fornNome}")`).last();
    if (await cardTarget.isVisible().catch(() => false)) {
      await cardTarget.click();
      await page.waitForTimeout(400);
    }
  }

  // Screenshot do modal
  const printModalPath = path.join(printsDir, `${printPrefix}_00_modal_selecao.png`);
  await page.screenshot({ path: printModalPath });
  logExec(`Screenshot do modal salvo em ${printPrefix}_00_modal_selecao.png`);

  // Disparar Cotação
  logExec(`Passo 5 (${nomeCenario}): Disparando cotação via botão Cotar...`);
  const btnConfirmar = page.locator(`button:has-text("Cotar (${fornecedoresParaSelecionar.length})"), button:has-text("Cotar")`).last();
  await btnConfirmar.click();

  const printClickPath = path.join(printsDir, `${printPrefix}_01_apos_clicar_cotar.png`);
  await page.screenshot({ path: printClickPath });

  logExec(`Aguardando API status/conclusão do robô (${nomeCenario})...`);
  
  // Polling via API de status da cotação
  const startWait = Date.now();
  let finished = false;

  while (Date.now() - startWait < 90000 && !finished) {
    await page.waitForTimeout(3000);
    if (currentCotacaoId) {
      try {
        const statusRes = await page.request.get(`http://localhost:3000/api/cotacoes/${currentCotacaoId}/status`);
        if (statusRes.ok()) {
          const statusJson = await statusRes.json();
          logExec(`[API STATUS POLL ${nomeCenario}] status=${statusJson.status}, percentual=${statusJson.percentualConcluido}%`);
          if (statusJson.status === 'concluido' || statusJson.status === 'erro') {
            logExec(`[POLLING API ${nomeCenario}] Conclusão/fim detectado na API status (${statusJson.status})!`);
            finished = true;
          }
        }
      } catch (e) {}
    } else {
      const textContent = await page.evaluate(() => document.body.innerText);
      if (textContent.includes('Cotação concluída') && (Date.now() - startWait > 15000)) {
        logExec(`[POLLING UI FALLBACK ${nomeCenario}] Conclusão detectada na interface!`);
        finished = true;
      }
    }
  }

  await page.waitForTimeout(3000);

  const printResultPath = path.join(printsDir, `${printPrefix}_04_resultado_final.png`);
  await page.screenshot({ path: printResultPath });
  logExec(`Screenshot do resultado salvo em ${printPrefix}_04_resultado_final.png`);

  const textContentFinal = await page.evaluate(() => document.body.innerText);
  logDiag(`=================================================================`);
  logDiag(`=== CONTEÚDO BRUTO EXTRAÍDO DA UI (${nomeCenario.toUpperCase()}) ===`);
  logDiag(`=================================================================`);
  logDiag(textContentFinal);

  const suppliersRendered = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.rounded-2xl, .rounded-xl'));
    return cards.map(c => c.innerText).filter(t => t.includes('Construjá') || t.includes('Cicalfer') || t.includes('Lojista'));
  });

  logDiag(`[RENDERED CARDS ${nomeCenario}] Count: ${suppliersRendered.length}`);
  suppliersRendered.forEach((txt, idx) => {
    logDiag(`--- CARD ${idx + 1} (${nomeCenario}) ---\n${txt}\n------------------`);
  });

  await browser.close();
  return { nomeCenario, suppliersRendered };
}

(async () => {
  logExec('=================================================================');
  logExec('=== INÍCIO DA BATERIA DE TESTES 12 (POS-CORREÇÃO DE CONFIGS) ===');
  logExec('=================================================================');

  // Parte 1: Construjá Solo
  const resSolo = await rodarCenario('Construjá Solo', ['Construjá'], 'construja_solo');

  // Pausa de 5s entre cenários
  await new Promise(r => setTimeout(r, 5000));

  // Parte 2: Cicalfer + Construjá Sequencial Multi
  const resMulti = await rodarCenario('Cicalfer + Construjá Multi', ['Cicalfer', 'Construjá'], 'cicalfer_construja_multi');

  const jsonResult = {
    testName: 'Teste 12 - Correção de Configs e Resolução Dinâmica de Seletores',
    timestamp: new Date().toISOString(),
    cenarioSolo: resSolo,
    cenarioMulti: resMulti,
  };

  fs.writeFileSync(jsonResultPath, JSON.stringify(jsonResult, null, 2));
  logExec('=== BATERIA DE TESTES 12 FINALIZADA COM SUCESSO ===');
})().catch(err => {
  logExec(`[FATAL ERROR TESTE 12] ${err.stack || err}`);
  process.exit(1);
});
