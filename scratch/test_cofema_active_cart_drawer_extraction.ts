import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaActiveCartDrawerExtraction() {
  console.log('=== TESTE DE EXTRAÇÃO DIRETA DA GAVETA DO CARRINHO ATIVO NO COFEMA ===\n');

  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const fornDbRecord = await db.fornecedores.getById(cofemaFornecedorId);
  const emailLogin = fornDbRecord?.emailLogin || '';
  const senhaLogin = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada);

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });
    await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // 1. Abrir gaveta do carrinho no header
    console.log('1. Abrindo gaveta do carrinho no Header...');
    const cartTrigger = page.locator('header button:has(svg), header a:has(svg)').first();
    if (await cartTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cartTrigger.evaluate((el: any) => el.click());
      await page.waitForTimeout(2500);
    }

    // 2. Extrair dados da gaveta ativa
    const drawerExtracted = await page.evaluate(() => {
      const drawer = document.querySelector('[role="dialog"], [class*="drawer"], [class*="sheet"], [class*="offcanvas"], div[class*="cart"]') || document.body;
      const text = drawer.innerText || '';

      if (text.includes('vazio') || text.includes('Nenhum item') || text.includes('0 produtos')) {
        return {
          cartUrl: window.location.href,
          containersFoundCount: 0,
          produtos: [],
          errosExtracao: [],
          resumo: {
            resumoTabelaEncontrada: true,
            totalItens: 0,
            despesaAcessoria: 0,
            totalPedido: 0.00
          }
        };
      }

      // Procurar cards de produtos na gaveta
      const cardNodes = Array.from(drawer.querySelectorAll('div')).filter(d => (d.innerText || '').includes('SKU:') && (d.innerText || '').includes('R$'));
      const items = [];
      const seenSkus = new Set();

      cardNodes.forEach(node => {
        const itemText = node.innerText || '';
        const skuMatch = itemText.match(/SKU:\s*(\d+)/i);
        const sku = skuMatch ? skuMatch[1] : null;

        if (sku && !seenSkus.has(sku)) {
          seenSkus.add(sku);
          const lines = itemText.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines.find(l => !l.startsWith('SKU:') && !l.startsWith('R$') && l.length > 3) || lines[0] || 'Produto Cofema';

          const inputEl = node.querySelector('input[type="number"], input[value]');
          let qtd = 1;
          if (inputEl && (inputEl as HTMLInputElement).value) {
            qtd = parseInt((inputEl as HTMLInputElement).value, 10) || 1;
          } else {
            const qtdMatch = itemText.match(/(\d+)\s*un/i);
            if (qtdMatch) qtd = parseInt(qtdMatch[1], 10);
          }

          const prices = Array.from(itemText.matchAll(/R\$\s*([\d\.,]+)/gi)).map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')));
          let unitPrice = prices.length > 0 ? prices[0] : 0;
          let totalVal = prices.length > 1 ? prices[1] : (unitPrice * Math.max(qtd, 1));

          if (prices.length === 1 && qtd > 1) {
            totalVal = unitPrice;
            unitPrice = Math.round((totalVal / qtd) * 100) / 100;
          }

          items.push({
            nomeProduto: title,
            codigoProduto: sku,
            quantidade: qtd,
            precoUnitario: Math.round(unitPrice * 100) / 100,
            totalItem: Math.round(totalVal * 100) / 100,
            rawUnitPriceStr: `R$ ${unitPrice.toFixed(2)}`
          });
        }
      });

      const totalMatch = text.match(/Total\s*Carrinho:?\s*R\$\s*([\d\.,]+)/i) || text.match(/Total:?\s*R\$\s*([\d\.,]+)/i);
      const totalPedido = totalMatch ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) : items.reduce((acc, i) => acc + i.totalItem, 0);

      return {
        cartUrl: window.location.href,
        containersFoundCount: items.length,
        produtos: items,
        errosExtracao: [],
        resumo: {
          resumoTabelaEncontrada: true,
          totalItens: items.length,
          despesaAcessoria: 0,
          totalPedido: Math.round(totalPedido * 100) / 100
        }
      };
    });

    console.log('\n=== JSON BRUTO EXTRAÍDO DA GAVETA ATIVA ===');
    console.log(JSON.stringify(drawerExtracted, null, 2));

  } finally {
    await browser.close();
  }
}

testCofemaActiveCartDrawerExtraction().catch(console.error);
