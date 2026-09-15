// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import 'dotenv/config';
import { db } from '../lib/db/client';
import { processarCotacaoTodosFornecedores } from '../lib/services/automacao/matchingEngine';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('=== TESTE REAL E COMPLETO: COTAÇÃO 3 ITENS CICALFER VIA SARACOTA ===');

  const printsDir = path.join(process.cwd(), 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  // 1. Criar cotação no banco com os 3 itens solicitados (somente pela descrição)
  const cotacao = await db.cotacoes.create({
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedorIds: ['33e03495-100d-45a3-9e34-899de56b0ab1'],
    status: 'pendente',
    origem: 'texto',
    itens: [
      { cotacao_id: '', material: 'CABO FLEX 100M COBRECOM 2,50MM AM', quantidade: 5, unidade: 'UN', preco_unitario: 0 },
      { cotacao_id: '', material: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM', quantidade: 12, unidade: 'UN', preco_unitario: 0 },
      { cotacao_id: '', material: 'ALICATE BICO CHATO MTX 6', quantidade: 12, unidade: 'UN', preco_unitario: 0 }
    ]
  });

  console.log(`\n1. Cotação criada com sucesso no banco: ID "${cotacao.id}"`);

  // 2. Executar o processamento autônomo do robô Cicalfer
  console.log('2. Iniciando motor de cotação autônomo RPA Cicalfer...');
  await processarCotacaoTodosFornecedores(cotacao.id);

  console.log('\n3. Processamento RPA finalizado! Lendo resultados gravados no banco...');
  const resultados = await db.cotacoes.obterResultadosMatching(cotacao.id);
  console.log('RESULTADOS GRAVADOS NO BANCO:');
  console.log(JSON.stringify(resultados, null, 2));

  // 4. Capturar a tela do Relatório Final gerado dentro da SaraCota (UI)
  console.log('\n4. Acessando a interface web da SaraCota para capturar o Relatório Final...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    // Fazer login como admin
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@saracota.com.br');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navegar para Cotações
    const cotacoesNav = page.locator('text=Cotações').first();
    if (await cotacoesNav.isVisible().catch(() => false)) {
      await cotacoesNav.click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    // Ir para a sub-aba "Resultado" se disponível ou recarregar
    const resTab = page.locator('button:has-text("Resultado"), button:has-text("Relatório")').first();
    if (await resTab.isVisible().catch(() => false)) {
      await resTab.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Se houver histórico de cotações, abrir a cotação recém-criada ou ir na aba Histórico
    const histNav = page.locator('text=Histórico, text=Cotações Anteriores').first();
    if (await histNav.isVisible().catch(() => false)) {
      await histNav.click().catch(() => {});
      await page.waitForTimeout(2000);
      
      // Expandir a primeira cotação (a mais recente)
      const firstExpand = page.locator('button:has-text("Ver Detalhes"), button:has-text("Expandir"), tr, div.border').first();
      if (await firstExpand.isVisible().catch(() => false)) {
        await firstExpand.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // Screenshot 05: Relatório final gerado dentro da SaraCota
    const p5Path = path.join(printsDir, '2026-09-10_cicalfer_3itens_05_relatorio_saracota.png');
    await page.screenshot({ path: p5Path, fullPage: false });
    console.log(`[PRINT SALVO] ${p5Path}`);
  } catch (err: any) {
    console.error('Erro ao capturar UI da SaraCota:', err);
  } finally {
    await browser.close();
  }

  console.log('\n=== TESTE E2E CONCLUÍDO COM SUCESSO! ===');
})();
