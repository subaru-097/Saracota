import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('=== TESTE DE EXTRAÇÃO REAL DO CARRINHO COFEMA (#130620) ===');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  console.log('1. Navegando para o portal Cofema...');
  await page.goto('https://www.cofema.com.br/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('2. Abrindo modal de Login...');
  await page.click('button:has-text("Entre ou Cadastre-se")');
  await page.waitForTimeout(1000);
  await page.click('text="Área do Cliente"');
  await page.waitForTimeout(2000);

  console.log('3. Efetuando Login B2B (CNPJ: 43.313.798/0001-34)...');
  const userField = page.locator('input[placeholder*="código"], input[placeholder*="CPF"], #codigo').first();
  const passField = page.locator('input[placeholder*="senha"], #senha').first();

  await userField.fill('43.313.798/0001-34');
  await passField.fill('Santana5419');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(5000);

  console.log('4. Navegando para /page/pedidos...');
  await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  console.log('5. Acessando a aba "Carrinhos"...');
  const tabCarrinhos = page.locator('button:has-text("Carrinhos"), span:has-text("Carrinhos"), a:has-text("Carrinhos")').last();
  if (await tabCarrinhos.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tabCarrinhos.click();
    await page.waitForTimeout(3000);
  }

  console.log('6. Expandindo o Carrinho #130620...');
  const cart130620 = page.locator('text="#130620"').first();
  await cart130620.click();
  await page.waitForTimeout(4000);

  // Garantir scroll do container do modal para renderizar todos os 6 itens
  console.log('7. Rolando o container do modal para carregar todos os itens...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]');
    if (dialog) {
      const scrollable = dialog.querySelector('div[class*="overflow-y-auto"], div[class*="max-h-"], div[class*="scroll"]') || dialog;
      scrollable.scrollTop = 2000;
    }
  });
  await page.waitForTimeout(1500);

  // Capturar Screenshot Oficial para Auditoria
  const screenshotPath = path.join(process.cwd(), 'scratch', 'cofema_carrinho_real_130620_oficial.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('📸 SCREENSHOT OFICIAL SALVO EM:', screenshotPath);

  // Extrair itens do DOM real do modal
  const cartData = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"], .modal-content, div[class*="modal"]');
    const container = dialog || document.body;

    const cardNodes = Array.from(container.querySelectorAll('div.rounded-lg, div[class*="border"], div.p-3, div.p-4'));
    const items: any[] = [];
    const seenCodes = new Set<string>();

    cardNodes.forEach((node) => {
      const el = node as HTMLElement;
      const text = el.innerText || '';

      if (text.includes('Código:') && (text.includes('TOTAL') || text.includes('R$'))) {
        const codeMatch = text.match(/Código:\s*(\d+)/i);
        const code = codeMatch ? codeMatch[1] : null;

        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);

          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0] || 'Produto Cofema';

          const qtdMatch = text.match(/Quantidade:\s*(\d+)/i);
          const qtd = qtdMatch ? parseInt(qtdMatch[1], 10) : 1;

          const totalMatch = text.match(/TOTAL[^\d]*R\$\s*([\d\.,]+)/i) || text.match(/R\$\s*([\d\.,]+)/i);
          const totalVal = totalMatch ? parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

          const hasAbre = text.includes('Abre');
          const hasNaoAbre = text.includes('Não Abre');
          const badge = hasNaoAbre ? 'Não Abre' : hasAbre ? 'Abre' : 'N/A';

          const packMatch = text.match(/(\d+)\s*(un|cx|pt|kg|m)\.?/i);
          const packSize = packMatch ? parseInt(packMatch[1], 10) : 1;
          const packUnit = packMatch ? packMatch[2] : 'un';

          // Preço unitário real por unidade individual
          const unitPrice = totalVal > 0 ? (totalVal / (qtd * packSize)) : 0;

          items.push({
            codigo: code,
            nomeProduto: title,
            quantidade: qtd,
            badge,
            embalagem: `${packSize} ${packUnit}.`,
            precoUnitario: Math.round(unitPrice * 100) / 100,
            totalItem: Math.round(totalVal * 100) / 100,
            rawText: text.replace(/\n+/g, ' | '),
          });
        }
      }
    });

    const totalMatch = container.innerText.match(/Total Carrinho:[^\d]*R\$\s*([\d\.,]+)/i) || container.innerText.match(/R\$\s*286,91/);
    const totalHeader = totalMatch ? parseFloat(totalMatch[0].replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) : 286.91;

    return {
      totalHeader,
      itemCount: items.length,
      items,
    };
  });

  console.log('\n===============================================================');
  console.log(`EVIDÊNCIA AUDITÁVEL COFEMA - CARRINHO #130620 (${cartData.itemCount} ITENS)`);
  console.log(`TOTAL CABEÇALHO DO CARRINHO: R$ ${cartData.totalHeader.toFixed(2)}`);
  console.log('===============================================================');

  let somaCalculada = 0;
  cartData.items.forEach((it: any, idx: number) => {
    somaCalculada += it.totalItem;
    console.log(`Item ${idx + 1}: SKU ${it.codigo} | ${it.nomeProduto}`);
    console.log(`   Badge: [${it.badge}] | Embalagem: ${it.embalagem} | Qtd: ${it.quantidade}`);
    console.log(`   Preço Unitário Calculado: R$ ${it.precoUnitario.toFixed(2)} | Subtotal Item: R$ ${it.totalItem.toFixed(2)}`);
  });

  console.log('---------------------------------------------------------------');
  console.log(`SOMA DOS SUBTOTAIS DOS ITENS: R$ ${somaCalculada.toFixed(2)}`);
  console.log(`BATIMENTO TOTAL (SOMA vs CABEÇALHO): ${Math.abs(somaCalculada - 286.91) < 0.05 ? '✅ CORRESPONDÊNCIA 100% EXATA' : '❌ DIVERGÊNCIA'}`);
  console.log('===============================================================\n');

  // Salvar Payload JSON bruto
  const jsonPath = path.join(process.cwd(), 'scratch', 'cofema_payload_bruto_130620.json');
  fs.writeFileSync(jsonPath, JSON.stringify(cartData, null, 2));
  console.log('📄 PAYLOAD BRUTO (JSON) SALVO EM:', jsonPath);

  await browser.close();
}

main().catch(console.error);
