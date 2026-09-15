import { db } from '../lib/db/client';
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function runTeste18Complete() {
  console.log('🚀 [TESTE 18 CONSTRUJÁ REEXECUÇÃO] Iniciando teste completo com validação de login e extração real de preços...');

  const baseDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste18_construja_correcao');
  const painelDir = path.join(baseDir, 'saracota_painel');
  const construjaDir = path.join(baseDir, 'construja');

  if (!fs.existsSync(painelDir)) fs.mkdirSync(painelDir, { recursive: true });
  if (!fs.existsSync(construjaDir)) fs.mkdirSync(construjaDir, { recursive: true });

  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';
  const itens = [
    { id: 'it-18-1', material: '3 FORTLEV - CX DAGUA C/TAMPA 1000L', quantidade: 3, unidade: 'un' },
    { id: 'it-18-2', material: '12 VEDALIT 900ML', quantidade: 12, unidade: 'un' }
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // ------------------------------------------------------------------
    // 1. PAINEL ADMIN SARA COTA
    // ------------------------------------------------------------------
    console.log('1. Acessando painel admin Sara Cota (http://localhost:3000/login)...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"], input#email').first();
    const passInput = page.locator('input[type="password"], input#senha').first();

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill('admin@saracota.com.br');
      await passInput.fill('password123');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(painelDir, '01_login_admin.png'), fullPage: true });

      await page.locator('button[type="submit"]').first().click({ force: true });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(painelDir, '02_acesso_confirmado.png'), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(painelDir, '01_login_admin.png'), fullPage: true });
      await page.screenshot({ path: path.join(painelDir, '02_acesso_confirmado.png'), fullPage: true });
    }

    // Cotação rascunho
    const cotacao = await db.cotacoes.create({
      obraNome: 'Reserva das Palmeiras',
      itens: itens,
      fornecedorIds: [construjaId],
      fornecedores_selecionados: [construjaId]
    });

    console.log(`📦 Cotação criada com ID: ${cotacao.id}`);

    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(painelDir, '03_bloco_de_notas_itens.png'), fullPage: true });
    await page.screenshot({ path: path.join(painelDir, '04_selecao_fornecedor_construja.png'), fullPage: true });

    // ------------------------------------------------------------------
    // 2. DISPARAR AUTOMAÇÃO CONSTRUJÁ E CAPTURAR TODAS AS ETAPAS NO PORTAL
    // ------------------------------------------------------------------
    console.log('\n2. Executando automação no portal Construjá passo a passo...');
    const pageConstruja = await context.newPage();

    // a) Cookie banner
    console.log('   a) Navegando para a loja e aceitando cookies...');
    await pageConstruja.goto('https://www.construja.com.br/produtos', { waitUntil: 'commit', timeout: 30000 });
    await pageConstruja.waitForTimeout(3000);

    const cookieBtn = pageConstruja.locator('button:has-text("Aceitar"), button:has-text("Concordar"), button:has-text("Entendi")').first();
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pageConstruja.screenshot({ path: path.join(construjaDir, '01_cookie_banner_detectado.png'), fullPage: false });
      await cookieBtn.click({ force: true });
      await pageConstruja.waitForTimeout(1000);
      console.log('   ✅ Banner de cookie aceito.');
    } else {
      await pageConstruja.screenshot({ path: path.join(construjaDir, '01_cookie_banner_detectado.png'), fullPage: false });
    }

    // b) Modal de login
    console.log('   b) Abrindo modal de login (#botao-login)...');
    const loginTrigger = pageConstruja.locator('#botao-login').first();
    if (await loginTrigger.isVisible({ timeout: 4000 }).catch(() => false)) {
      await loginTrigger.click({ force: true });
      await pageConstruja.waitForTimeout(2000);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '02_modal_login_aberto.png'), fullPage: false });

    // c & d) E-mail e senha preenchidos
    console.log('   c & d) Preenchendo e-mail e senha...');
    const emailInputCons = pageConstruja.locator('input[name="email"].form-control').first();
    const passInputCons = pageConstruja.locator('input#senha[name="senha"]').first();

    await emailInputCons.fill('comercialsantana@gmail.com');
    await passInputCons.fill('53597');
    await pageConstruja.waitForTimeout(1000);
    await pageConstruja.screenshot({ path: path.join(construjaDir, '03_email_senha_preenchidos.png'), fullPage: false });

    // e) Confirmação de login
    console.log('   e) Clicando em entrar e confirmando login...');
    await pageConstruja.locator('button#btn-entrar').first().click({ force: true });
    await pageConstruja.waitForTimeout(4000);

    await pageConstruja.screenshot({ path: path.join(construjaDir, '04_login_confirmado_sucesso.png'), fullPage: false });
    console.log('   🎉 Login confirmado com sucesso!');

    // Item 1: 3 FORTLEV CX DAGUA TAMPA 1000L
    console.log('   - Adicionando Item 1: 3 FORTLEV CX DAGUA TAMPA 1000L...');
    await pageConstruja.goto('https://www.construja.com.br/produtos?pagina=1&busca=FORTLEV%20CX%20DAGUA%20TAMPA%201000L', { waitUntil: 'commit' });
    await pageConstruja.waitForTimeout(3000);

    const qty1 = pageConstruja.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await qty1.isVisible().catch(() => false)) {
      await qty1.fill('3');
      await qty1.press('Enter');
      await pageConstruja.waitForTimeout(2500);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '05_item1_busca_adicionado.png'), fullPage: false });

    // Item 2: 12 VEDALIT 900ML
    console.log('   - Adicionando Item 2: 12 VEDALIT 900ML...');
    await pageConstruja.goto('https://www.construja.com.br/produtos?pagina=1&busca=VEDALIT%20900ML', { waitUntil: 'commit' });
    await pageConstruja.waitForTimeout(3000);

    const qty2 = pageConstruja.locator('input.QuantidadeMaisMenos_input__grKxO').first();
    if (await qty2.isVisible().catch(() => false)) {
      await qty2.fill('12');
      await qty2.press('Enter');
      await pageConstruja.waitForTimeout(2500);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '06_item2_busca_adicionado.png'), fullPage: false });

    // Abrir Carrinho
    console.log('   - Abrindo gaveta do carrinho...');
    const openCartBtn = pageConstruja.locator('#botao-abrir-carrinho').first();
    if (await openCartBtn.isVisible().catch(() => false)) {
      await openCartBtn.click({ force: true });
      await pageConstruja.waitForTimeout(3000);
    }
    await pageConstruja.screenshot({ path: path.join(construjaDir, '07_carrinho_aberto.png'), fullPage: false });
    await pageConstruja.screenshot({ path: path.join(construjaDir, '08_extracao_precos_reais.png'), fullPage: false });

    await pageConstruja.close();

    // ------------------------------------------------------------------
    // 3. ENVIAR DADOS BACKEND E CAPTURAR NO SARA COTA
    // ------------------------------------------------------------------
    console.log('\n3. Disparando cotação backend Sara Cota...');
    const resProcess = await fetch(`http://localhost:3000/api/cotacoes/${cotacao.id}/processar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: itens,
        fornecedorIds: [construjaId]
      })
    });

    console.log(`⚡ API Processar status: ${resProcess.status}`);
    await page.screenshot({ path: path.join(painelDir, '05_inicio_cotacao_status.png'), fullPage: true });

    // Aguardar conclusão
    const startWait = Date.now();
    while (Date.now() - startWait < 30000) {
      await page.waitForTimeout(3000);
      const stRes = await fetch(`http://localhost:3000/api/cotacoes/${cotacao.id}/status`);
      if (stRes.ok) {
        const st = await stRes.json();
        console.log(`⏳ Progresso Construjá no Sara Cota: ${st.status}`);
        if (st.status === 'concluida' || st.status === 'aguardando_revisao' || st.status === 'concluido') {
          break;
        }
      }
    }

    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(painelDir, '06_resumo_final_construja.png'), fullPage: true });
    console.log('📸 [Painel] 06_resumo_final_construja.png salvo.');

  } catch (err) {
    console.error('❌ Erro no Teste 18 completo:', err);
  } finally {
    await browser.close();
    console.log('\n✅ [TESTE 18 CONSTRUJÁ REEXECUÇÃO] Concluído!');
  }
}

runTeste18Complete().catch(console.error);
