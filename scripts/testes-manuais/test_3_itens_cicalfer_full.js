// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const printsDir = path.join(process.cwd(), 'docs', 'historico', 'prints');
  if (!fs.existsSync(printsDir)) {
    fs.mkdirSync(printsDir, { recursive: true });
  }

  console.log('=== EXECUÇÃO REAL 3 ITENS CICALFER SEM CÓDIGO DE REFERÊNCIA ===');
  const quoteEngine = require('../core/services/supplier-quote-engine');
  const cicalferConfig = require('../config/suppliers/cicalfer.json');

  const loginUser = 'santanacomercial2021@gmail.com';
  const decryptedPass = 'password123';

  console.log(`Credenciais de acesso: User "${loginUser}"`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 868 } });

  try {
    // ETAPA 1: Login automático
    console.log('1. Efetuando login automático na Cicalfer...');
    await quoteEngine.realizarLogin(page, cicalferConfig, {
      user: loginUser,
      pass: decryptedPass
    });

    const p1Path = path.join(printsDir, '2026-09-10_cicalfer_3itens_01_login.png');
    await page.screenshot({ path: p1Path, fullPage: false });
    console.log(`Saved: ${p1Path}`);

    // Lista de itens para cotar SOMENTE pela descrição
    const itensCotacao = [
      { termo: 'CABO FLEX 100M COBRECOM 2,50MM AM', quantidade: 5, printSuffix: '02_busca_item1.png' },
      { termo: 'BROXA ROMA RETANGULAR 15,5 X 5,5CM', quantidade: 12, printSuffix: '02_busca_item2.png' },
      { termo: 'ALICATE BICO CHATO MTX 6', quantidade: 12, printSuffix: '02_busca_item3.png' }
    ];

    // ETAPA 2: Adicionar cada um dos 3 produtos pela descrição
    for (let i = 0; i < itensCotacao.length; i++) {
      const item = itensCotacao[i];
      console.log(`\nCotando Item ${i + 1}/3: "${item.termo}" (Qtd: ${item.quantidade})...`);
      
      try {
        await quoteEngine.adicionarItem(page, cicalferConfig, {
          termo: item.termo,
          quantidade: item.quantidade
        });
      } catch (e) {
        console.warn(`Aviso ao adicionar item "${item.termo}":`, e.message);
      }

      const pSearchPath = path.join(printsDir, `2026-09-10_cicalfer_3itens_${item.printSuffix}`);
      await page.screenshot({ path: pSearchPath, fullPage: false });
      console.log(`Saved: ${pSearchPath}`);
    }

    // ETAPA 3: Ir para o carrinho
    console.log('\n3. Navegando para o carrinho de compras...');
    await page.goto(cicalferConfig.selectors.cart_url, { waitUntil: 'commit', timeout: 30000 });
    await page.waitForTimeout(3000);

    const p3Path = path.join(printsDir, '2026-09-10_cicalfer_3itens_03_carrinho_montado.png');
    await page.screenshot({ path: p3Path, fullPage: true });
    console.log(`Saved: ${p3Path}`);

    // ETAPA 4: Extrair dados e tirar print da tabela de resumo do carrinho
    console.log('\n4. Extraindo dados do carrinho (par por par e resumo do pedido)...');
    const cartData = await quoteEngine.extrairCarrinho(page, cicalferConfig);
    console.log('Dados extraídos do carrinho:', JSON.stringify(cartData, null, 2));

    const p4Path = path.join(printsDir, '2026-09-10_cicalfer_3itens_04_resumo_carrinho.png');
    await page.screenshot({ path: p4Path, fullPage: false });
    console.log(`Saved: ${p4Path}`);

  } catch (err) {
    console.error('Erro na execução dos 3 itens:', err);
  } finally {
    await browser.close();
  }
})();
