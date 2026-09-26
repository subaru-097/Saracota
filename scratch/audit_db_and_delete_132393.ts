import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaExtrairCarrinho } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function auditDbAndDelete132393() {
  console.log('=== AUDITORIA DE BANCO DE DADOS & RESET COMPROVADO DO CARRINHO #132393 ===\n');

  // 1. Consultar banco de dados cotacao_fornecedor_sessoes
  try {
    const sessoes = await db.cotacaoFornecedorSessoes.getAll();
    console.log(`[BANCO DE DADOS] Total de registros em cotacao_fornecedor_sessoes: ${sessoes.length}`);
    const cofemaSessoes = sessoes.filter(s => s.fornecedorId === '752e18bd-4f41-414a-8f66-0d8f538de99e' || s.detalhesItem?.toLowerCase().includes('cofema') || s.status);
    console.log('\n--- REGISTROS RECENTES DE SESSÕES COFEMA NO BANCO DE DADOS ---');
    cofemaSessoes.slice(-5).forEach(s => {
      console.log(JSON.stringify({
        id: s.id,
        cotacaoId: s.cotacaoId,
        fornecedorId: s.fornecedorId,
        status: s.status,
        timestamp: s.createdAt || s.updatedAt,
        session_task_id: s.id,
        valorTotal: s.valorTotal,
        qtdItens: s.qtdItens
      }, null, 2));
    });
  } catch (e: any) {
    console.warn('[BANCO DE DADOS] Erro ao consultar banco:', e.message);
  }

  // 2. Executar login e higiene do carrinho no portal Cofema
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
    console.log('\n2. Efetuando login B2B Cofema...');
    await cofemaRealizarLogin(page, config, { user: emailLogin, pass: senhaLogin });

    console.log('\n3. Executando cofemaLimparCarrinho (com validação pós-limpeza do DOM)...');
    await cofemaLimparCarrinho(page, config);

    console.log('\n4. Executando extração real do carrinho IMEDIATAMENTE pós-limpeza (cofemaExtrairCarrinho)...');
    await page.goto('https://www.cofema.com.br/page/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const rawCartExtracted = await cofemaExtrairCarrinho(page);

    console.log('\n=== JSON BRUTO RETORNADO POR cofemaExtrairCarrinho (PÓS-LIMPEZA) ===');
    console.log(JSON.stringify(rawCartExtracted, null, 2));

  } finally {
    await browser.close();
  }
}

auditDbAndDelete132393().catch(console.error);
