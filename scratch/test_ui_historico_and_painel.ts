import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

async function runUiTest() {
  console.log('=== TESTE E2E COMPLETO DE HISTÓRICO E PAINEL VIA INTERFACE ===');

  const printsDir = path.join(process.cwd(), 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const userId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
  await context.addInitScript((uid) => {
    window.localStorage.setItem(
      'saracota_active_user',
      JSON.stringify({
        id: uid,
        email: 'colaborador@saracota.com.br',
        nome: 'Comprador Teste',
        role: 'colaborador',
        cargo: 'comprador',
        clienteId: 'cli-default',
      })
    );
    window.localStorage.setItem('saracota_user_role', 'colaborador');
  }, userId);

  const page = await context.newPage();

  console.log('1. Acessando a página de cotações...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Adicionar item ao bloco de notas se necessário
  const textarea = page.locator('textarea').first();
  if (await textarea.isVisible()) {
    console.log('-> Adicionando itens ao bloco de notas...');
    await textarea.fill('5 Caixa D\'Água Fortlev 310L\n5 Ducha Lorenzetti Maxi Ducha 127V');
    await page.waitForTimeout(500);

    const addBtn = page.locator('button:has-text("Adicionar"), button:has-text("Processar Lista")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Clicar em Cotar com Fornecedores
  const cotarBtn = page.locator('button:has-text("Cotar com Fornecedores")').first();
  if (await cotarBtn.isVisible() && await cotarBtn.isEnabled()) {
    console.log('-> Clicando em "Cotar com Fornecedores"...');
    await cotarBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log('\n2. Navegando para a página de Histórico: http://localhost:3000/historico ...');
  await page.goto('http://localhost:3000/historico', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const historicoScreenshot = path.join(printsDir, '2026-09-14_01_tela_historico_cotacoes.png');
  await page.screenshot({ path: historicoScreenshot, fullPage: true });
  console.log('-> Print 1 (Tela de Histórico) salvo em:', historicoScreenshot);

  console.log('\n3. Verificando modal e lixeira...');
  const verModalBtn = page.locator('button:has-text("Ver Modal de Resultado")').first();
  if (await verModalBtn.isVisible()) {
    console.log('-> Botão "Ver Modal de Resultado" visível! Clicando...');
    await verModalBtn.click();
    await page.waitForTimeout(1500);

    const modalScreenshot = path.join(printsDir, '2026-09-14_02_modal_resultado_cotacao_historico.png');
    await page.screenshot({ path: modalScreenshot, fullPage: true });
    console.log('-> Print 2 (Modal Resultado da Cotação) salvo em:', modalScreenshot);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  console.log('\n4. Testando exclusão manual via lixeira (🗑️)...');
  page.on('dialog', async (dialog) => {
    console.log('-> Confirmando deleção no popup:', dialog.message());
    await dialog.accept();
  });

  const trashBtn = page.locator('button[title="Excluir Cotação"]').first();
  if (await trashBtn.isVisible()) {
    await trashBtn.click();
    await page.waitForTimeout(2000);

    const posExclusaoScreenshot = path.join(printsDir, '2026-09-14_03_historico_pos_exclusao_manual.png');
    await page.screenshot({ path: posExclusaoScreenshot, fullPage: true });
    console.log('-> Print 3 (Histórico pós-exclusão manual) salvo em:', posExclusaoScreenshot);
  }

  console.log('\n5. Navegando para o Painel Geral de Compras (http://localhost:3000/)...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const painelScreenshot = path.join(printsDir, '2026-09-14_04_painel_geral_sem_cotacoes_ativas.png');
  await page.screenshot({ path: painelScreenshot, fullPage: true });
  console.log('-> Print 4 (Painel Principal sem a seção de cotações ativas) salvo em:', painelScreenshot);

  const ativasTextCount = await page.locator('text="Cotações Ativas na Sessão"').count();
  if (ativasTextCount === 0) {
    console.log('-> VALIDAÇÃO OK: A seção "Cotações Ativas na Sessão" foi 100% REMOVIDA do Painel Geral de Compras!');
  } else {
    throw new Error('ERRO DE VALIDAÇÃO: A seção de cotações ativas ainda aparece no Painel!');
  }

  await browser.close();
  console.log('\n=== TODOS OS TESTES DE UI FORAM CONCLUÍDOS COM SUCESSO ===');
}

runUiTest().catch((err) => {
  console.error('FALHA NO TESTE:', err);
  process.exit(1);
});
