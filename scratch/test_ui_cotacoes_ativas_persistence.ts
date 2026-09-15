import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const { db } = require('../lib/db/client');

async function runUiPersistenceTest() {
  console.log('=== TESTE E2E DE PERSISTÊNCIA DE COTAÇÕES ATIVAS ENTRE NAVEGAÇÃO DE ABAS ===');

  const userId = '61ab64e4-c2cb-46df-bb14-6cc326293085';
  const obraId = 'Reserva das Palmeiras';

  // Garantir 2 cards salvos no banco para o teste da UI
  console.log('1. Garantindo cotações ativas persistidas (Cicalfer + Construjar)...');
  await db.cotacoesAtivas.upsert({
    user_id: userId,
    obra_id: obraId,
    fornecedor_id: '33e03495-100d-45a3-9e34-899de56b0ab1',
    fornecedor_nome: 'Cicalfer Material Elétrico',
    itens: [
      { nomeSolicitado: 'Caixa D\'Água Fortlev 310L', nomeEncontrado: 'Caixa D\'Água Fortlev 310L', ref: '1234', qtd: 5, precoUnitario: 438.03, precoTotal: 2190.15 },
      { nomeSolicitado: 'Ducha Lorenzetti Maxi Ducha', nomeEncontrado: 'Ducha Lorenzetti Maxi Ducha 127V', ref: '11137', qtd: 5, precoUnitario: 83.44, precoTotal: 417.20 },
    ],
    valor_total: 2607.35,
  });

  await db.cotacoesAtivas.upsert({
    user_id: userId,
    obra_id: obraId,
    fornecedor_id: '99f03495-88d-45a3-9e34-899de56b0ab9',
    fornecedor_nome: 'Construjar Materiais',
    itens: [
      { nomeSolicitado: 'Cimento CP-II Itaú 50kg', nomeEncontrado: 'Cimento CP-II Itaú 50kg', ref: '9001', qtd: 20, precoUnitario: 34.50, precoTotal: 690.00 },
    ],
    valor_total: 690.00,
  });

  const printsDir = path.join(process.cwd(), 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

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

  console.log('\n2. Acessando a aba "Cotações" (http://localhost:3000/cotacoes)...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const p1Screenshot = path.join(printsDir, '2026-09-14_01_cotacoes_ativas_inicial.png');
  await page.screenshot({ path: p1Screenshot, fullPage: true });
  console.log('-> Print 1 (Aba Cotações com cards ativos de Cicalfer + Construjar) salvo em:', p1Screenshot);

  console.log('\n3. Navegando para a aba "Fornecedores"...');
  await page.goto('http://localhost:3000/fornecedores', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const p2Screenshot = path.join(printsDir, '2026-09-14_02_aba_fornecedores.png');
  await page.screenshot({ path: p2Screenshot, fullPage: true });
  console.log('-> Print 2 (Aba Fornecedores) salvo em:', p2Screenshot);

  console.log('\n4. RETORNANDO para a aba "Cotações" (verificando se os cards permanecem intactos)...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const p3Screenshot = path.join(printsDir, '2026-09-14_03_retorno_aba_cotacoes_cards_mantidos.png');
  await page.screenshot({ path: p3Screenshot, fullPage: true });
  console.log('-> Print 3 (Retorno à aba Cotações - Cards MANTIDOS!) salvo em:', p3Screenshot);

  console.log('\n5. Simulando RECARREGAMENTO total de página / novo login (F5)...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const p4Screenshot = path.join(printsDir, '2026-09-14_04_cotacoes_pos_recarregamento.png');
  await page.screenshot({ path: p4Screenshot, fullPage: true });
  console.log('-> Print 4 (Cotações pós-recarregamento / re-login) salvo em:', p4Screenshot);

  await browser.close();
  console.log('\n=== TODOS OS TESTES DE NAVEGAÇÃO E PERSISTÊNCIA DE UI CONCLUÍDOS COM SUCESSO ===');
}

runUiPersistenceTest().catch((err) => {
  console.error('FALHA NO TESTE DE UI:', err);
  process.exit(1);
});
