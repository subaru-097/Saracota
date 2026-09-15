const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'historicos', '2026-09-15', 'teste10_saracota_multifornecedor');
const printsDir = path.join(baseDir, 'prints');
const execLogPath = path.join(baseDir, 'execucao_detalhada.log');
const diagLogPath = path.join(baseDir, 'diagnostico_duplicacao.log');

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

async function rodarTesteSingle(fornecedorNome, fornecedorId) {
  logExec(`=================================================================`);
  logExec(`=== INÍCIO DO TESTE DE CONTROLE SINGLE: ${fornecedorNome.toUpperCase()} ===`);
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

  page.on('response', async (res) => {
    if (res.url().includes('/api/cotacoes/') && res.url().includes('/status')) {
      try {
        const json = await res.json();
        logExec(`[STATUS SINGLE ${fornecedorNome}] pct: ${json.percentualConcluido}% | status: ${json.status} | msgs: ${JSON.stringify(json.mensagens)}`);
      } catch (e) {}
    }
  });

  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const btnSubAbaBloco = page.locator('button:has-text("Bloco de Notas")').first();
  if (await btnSubAbaBloco.isVisible().catch(() => false)) {
    await btnSubAbaBloco.click();
    await page.waitForTimeout(1000);
  }

  const inputItem = page.locator('input[placeholder*="Digite o item"]').first();
  await inputItem.waitFor({ state: 'visible', timeout: 10000 });

  // Limpar itens antigos
  const trashBtns = page.locator('button[title*="Remover"], button:has(svg.lucide-trash-2)');
  let trashCount = await trashBtns.count().catch(() => 0);
  for (let i = 0; i < trashCount; i++) {
    const btn = trashBtns.first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }

  // Adicionar item
  await inputItem.fill('3x CAIXA DA AGUA FORTLEV 310L');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Abrir modal
  const btnCotarForn = page.locator('button:has-text("Cotar com Fornecedores")').first();
  await btnCotarForn.click();
  await page.waitForTimeout(1000);

  // Desmarcar todos e selecionar apenas o fornecedor desejado
  const cardTarget = page.locator(`div:has-text("${fornecedorNome}")`).last();
  
  // Se "Desmarcar Todos" estiver visível, desmarcar primeiro
  const btnDesmarcar = page.locator('button:has-text("Desmarcar Todos")').first();
  if (await btnDesmarcar.isVisible().catch(() => false)) {
    await btnDesmarcar.click();
    await page.waitForTimeout(300);
  }

  // Marcar apenas o fornecedor desejado
  await cardTarget.click();
  await page.waitForTimeout(500);

  const printSingleModal = path.join(printsDir, `controle_modal_${fornecedorNome.toLowerCase()}.png`);
  await page.screenshot({ path: printSingleModal });

  const btnConfirmar = page.locator('button:has-text("Cotar (1)"), button:has-text("Cotar")').last();
  await btnConfirmar.click();

  logExec(`[CONTROLE ${fornecedorNome}] Disparado clique em Cotar (1)...`);
  await page.waitForTimeout(15000);

  const printSingleResult = path.join(printsDir, `controle_resultado_${fornecedorNome.toLowerCase()}.png`);
  await page.screenshot({ path: printSingleResult });

  const textContent = await page.evaluate(() => document.body.innerText);
  logDiag(`--- TEXTO BRUTO CONTROLE ${fornecedorNome.toUpperCase()} ---\n${textContent}\n------------------`);

  await browser.close();
}

(async () => {
  logExec('=== INÍCIO DOS TESTES DE CONTROLE (SINGLE-SUPPLIER) ===');
  await rodarTesteSingle('Construjá', 'a1684c4d-d896-4ba9-a591-cda455c5ffe2');
  logExec('=== TESTES DE CONTROLE CONCLUÍDOS ===');
})();
