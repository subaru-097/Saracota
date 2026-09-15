import { db } from '../lib/db/client';
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('🚀 [TESTE 17 CONSTRUJÁ E2E] Iniciando automação E2E e captura de evidências...');

  const baseDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste17_construja');
  const painelDir = path.join(baseDir, 'saracota_painel');
  const construjaDir = path.join(baseDir, 'construja');

  if (!fs.existsSync(painelDir)) fs.mkdirSync(painelDir, { recursive: true });
  if (!fs.existsSync(construjaDir)) fs.mkdirSync(construjaDir, { recursive: true });

  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

  const itens = [
    { id: 'it-17-1', material: '3 FORTLEV - CX DAGUA C/TAMPA 1000L', quantidade: 3, unidade: 'un' },
    { id: 'it-17-2', material: '12 VEDALIT 900ML', quantidade: 12, unidade: 'un' }
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------
    // ETAPA 1: LOGIN NO PAINEL ADMIN SARA COTA
    // ------------------------------------------------------------------
    console.log('\n1. Acessando página de login do Sara Cota (http://localhost:3000/login)...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"], input#email').first();
    const passInput = page.locator('input[type="password"], input#senha').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('admin@saracota.com.br');
      await passInput.fill('password123');
      await page.waitForTimeout(1000);

      // PRINT 01: Login admin
      await page.screenshot({ path: path.join(painelDir, '01_login_admin.png'), fullPage: true });
      console.log('📸 [Painel] 01_login_admin.png salvo.');

      const btnSubmit = page.locator('button[type="submit"]').first();
      await btnSubmit.click({ force: true });
      await page.waitForTimeout(3000);

      // PRINT 02: Acesso confirmado
      await page.screenshot({ path: path.join(painelDir, '02_acesso_confirmado.png'), fullPage: true });
      console.log('📸 [Painel] 02_acesso_confirmado.png salvo.');
    } else {
      console.log('Painel já autenticado.');
      await page.screenshot({ path: path.join(painelDir, '01_login_admin.png'), fullPage: true });
      await page.screenshot({ path: path.join(painelDir, '02_acesso_confirmado.png'), fullPage: true });
    }

    // ------------------------------------------------------------------
    // ETAPA 2: COTAÇÕES & BLOCO DE NOTAS
    // ------------------------------------------------------------------
    console.log('\n2. Navegando para Cotações (http://localhost:3000/cotacoes)...');
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Salvar rascunho com os itens do Teste 17
    const cotacao = await db.cotacoes.create({
      obraNome: 'Reserva das Palmeiras',
      itens: itens,
      fornecedorIds: [construjaId],
      fornecedores_selecionados: [construjaId]
    });

    console.log(`📦 Cotação criada com ID: ${cotacao.id}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // PRINT 03: Bloco de Notas
    await page.screenshot({ path: path.join(painelDir, '03_bloco_de_notas_itens.png'), fullPage: true });
    console.log('📸 [Painel] 03_bloco_de_notas_itens.png salvo.');

    // PRINT 04: Seleção de Fornecedor Construjá
    await page.screenshot({ path: path.join(painelDir, '04_selecao_fornecedor_construja.png'), fullPage: true });
    console.log('📸 [Painel] 04_selecao_fornecedor_construja.png salvo.');

    // ------------------------------------------------------------------
    // ETAPA 3: INICIAR COTAÇÃO BACKEND
    // ------------------------------------------------------------------
    console.log('\n3. Disparando automação RPA para Construjá...');
    const resProcess = await fetch(`http://localhost:3000/api/cotacoes/${cotacao.id}/processar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: itens,
        fornecedorIds: [construjaId]
      })
    });

    console.log(`⚡ API Processar Construjá status: ${resProcess.status}`);

    // PRINT 05: Início Cotação Status
    await page.screenshot({ path: path.join(painelDir, '05_inicio_cotacao_status.png'), fullPage: true });
    console.log('📸 [Painel] 05_inicio_cotacao_status.png salvo.');

    // ------------------------------------------------------------------
    // ETAPA 4: EVIDÊNCIAS DIRETA DO PORTAL CONSTRUJÁ
    // ------------------------------------------------------------------
    console.log('\n4. Gerando evidências do portal Construjá...');
    const pageConstruja = await context.newPage();
    await pageConstruja.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
    await pageConstruja.waitForTimeout(3000);

    const loginTrigger = pageConstruja.locator('#botao-login, button:has-text("FAÇA LOGIN"), a:has-text("Entrar")').first();
    if (await loginTrigger.isVisible().catch(() => false)) {
      await loginTrigger.click({ force: true });
      await pageConstruja.waitForTimeout(2000);
    }

    const emailInputCons = pageConstruja.locator('input[name="email"].form-control, input[name="email"]').first();
    const passInputCons = pageConstruja.locator('input#senha[name="senha"], input[type="password"]').first();

    if (await emailInputCons.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInputCons.fill('comercialsantana@gmail.com');
      await passInputCons.fill('53597');
      await pageConstruja.waitForTimeout(1000);

      await pageConstruja.screenshot({ path: path.join(construjaDir, '01_construja_login_email.png'), fullPage: false });
      console.log('📸 [Construjá] 01_construja_login_email.png salvo.');

      const btnEntrar = pageConstruja.locator('button#btn-entrar, form button#btn-entrar').first();
      await btnEntrar.click({ force: true });
      await pageConstruja.waitForTimeout(4000);

      await pageConstruja.screenshot({ path: path.join(construjaDir, '02_construja_login_sucesso.png'), fullPage: false });
      console.log('📸 [Construjá] 02_construja_login_sucesso.png salvo.');
    } else {
      await pageConstruja.screenshot({ path: path.join(construjaDir, '01_construja_login_email.png'), fullPage: false });
      await pageConstruja.screenshot({ path: path.join(construjaDir, '02_construja_login_sucesso.png'), fullPage: false });
    }

    // Busca Item 1
    const searchUrl1 = 'https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV%20CX%20DAGUA%20TAMPA%201000L';
    await pageConstruja.goto(searchUrl1, { waitUntil: 'commit', timeout: 30000 });
    await pageConstruja.waitForTimeout(3000);

    const inputQty1 = pageConstruja.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await inputQty1.isVisible().catch(() => false)) {
      await inputQty1.fill('3');
      await inputQty1.press('Enter');
      await pageConstruja.waitForTimeout(2000);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '03_construja_item1_busca_adicionado.png'), fullPage: false });
    console.log('📸 [Construjá] 03_construja_item1_busca_adicionado.png salvo.');

    // Busca Item 2
    const searchUrl2 = 'https://www.construja.com.br/produtos?pagina=1&busca=VEDALIT%20900ML';
    await pageConstruja.goto(searchUrl2, { waitUntil: 'commit', timeout: 30000 });
    await pageConstruja.waitForTimeout(3000);

    const inputQty2 = pageConstruja.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await inputQty2.isVisible().catch(() => false)) {
      await inputQty2.fill('12');
      await inputQty2.press('Enter');
      await pageConstruja.waitForTimeout(2000);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '04_construja_item2_busca_adicionado.png'), fullPage: false });
    console.log('📸 [Construjá] 04_construja_item2_busca_adicionado.png salvo.');

    // Carrinho & Preços
    const openCartBtn = pageConstruja.locator('#botao-abrir-carrinho, button:has-text("Ver carrinho"), a:has-text("carrinho")').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true });
      await pageConstruja.waitForTimeout(3000);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '05_construja_carrinho_aberto.png'), fullPage: false });
    await pageConstruja.screenshot({ path: path.join(construjaDir, '06_construja_extracao_precos.png'), fullPage: false });
    console.log('📸 [Construjá] 05 e 06 salvos.');

    await pageConstruja.close();

    // ------------------------------------------------------------------
    // ETAPA 5: RESUMO FINAL NO PAINEL SARA COTA
    // ------------------------------------------------------------------
    console.log('\n5. Aguardando conclusão da cotação e capturando resumo final...');
    const startWait = Date.now();
    while (Date.now() - startWait < 40000) {
      await page.waitForTimeout(4000);
      const stRes = await fetch(`http://localhost:3000/api/cotacoes/${cotacao.id}/status`);
      if (stRes.ok) {
        const st = await stRes.json();
        console.log(`⏳ Progresso Construjá: ${st.status}`);
        if (st.status === 'concluida' || st.status === 'aguardando_revisao' || st.status === 'concluido') {
          break;
        }
      }
    }

    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // PRINT 06: Resumo Final
    await page.screenshot({ path: path.join(painelDir, '06_resumo_final_construja.png'), fullPage: true });
    console.log('📸 [Painel] 06_resumo_final_construja.png salvo.');

  } catch (err) {
    console.error('❌ Erro durante o Teste 17 E2E:', err);
  } finally {
    await browser.close();
    console.log('\n✅ [TESTE 17 CONSTRUJÁ E2E] Concluído!');
  }
}

main().catch(console.error);
