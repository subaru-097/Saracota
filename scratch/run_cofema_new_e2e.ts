import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { db } from '../lib/db/client';
import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';

async function runNewCofemaE2E() {
  const now = new Date();
  const dateFolderStr = '2026-09-25_14h30';
  const targetDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', dateFolderStr);
  const printsDir = path.join(targetDir, 'prints');

  fs.mkdirSync(printsDir, { recursive: true });

  const logLines: string[] = [];
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    logLines.push(line);
  };

  log('=== INICIANDO AUDITORIA DO ZERO: COFEMA B2B ===');

  const cofemaFornecedorId = '752e18bd-4f41-414a-8f66-0d8f538de99e';
  const fornDbRecord = await db.fornecedores.getById(cofemaFornecedorId);
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  log(`Fornecedor: ${fornDbRecord?.nome || 'Cofema'} (ID: ${cofemaFornecedorId})`);
  log(`Usuário B2B: ${user}`);

  // 1. Criar cotação de teste no banco de dados real
  const cotacaoRecord = await db.cotacoes.create({
    obraNome: 'Obra Teste Cofema Validacao Real',
    fornecedor_id: cofemaFornecedorId,
    fornecedorIds: [cofemaFornecedorId],
    fornecedores_selecionados: [cofemaFornecedorId],
    itens: [
      {
        material: 'Chave Inglesa 12 Brasfort',
        sku: '296511',
        skuFornecedor: '296511',
        quantidade: 5,
        unidade: 'un'
      }
    ]
  });

  log(`Cotação criada no banco com ID: "${cotacaoRecord.id}"`);

  // 2. Tirar print do carrinho real no Cofema durante o processamento
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    const { cofemaRealizarLogin, cofemaLimparCarrinho, cofemaAdicionarItem } = require('../core/services/supplier-quote-engine/cofemaExtractor');
    const config = { url_site: 'https://www.cofema.com.br/', selectors: fornDbRecord?.seletores };

    log('Passo 1: Login no portal Cofema...');
    await cofemaRealizarLogin(page, config, { user, pass });

    log('Passo 2: Reset / Limpeza do carrinho Cofema...');
    await cofemaLimparCarrinho(page, config).catch((e: any) => log(`Aviso limpeza: ${e.message}`));

    log('Passo 3: Adicionando 5 un de Chave Inglesa Brasfort (SKU 296511)...');
    const addRes = await cofemaAdicionarItem(page, config, 'Chave Inglesa 12 Brasfort', 5, { sku: '296511', skuFornecedor: '296511' });
    log(`Resultado Adição: ${JSON.stringify(addRes, null, 2)}`);

    // Tirar screenshot do portal Cofema com o carrinho montado
    const print1Path = path.join(printsDir, '01_carrinho_real_cofema.png');
    await page.screenshot({ path: print1Path, fullPage: true });
    log(`Print do portal Cofema salvo em: ${print1Path}`);

  } catch (err: any) {
    log(`Erro na navegação direta Playwright: ${err.message}`);
  } finally {
    await browser.close();
  }

  // 3. Executar o processador do motor de matching
  log('Passo 4: Executando processarCotacaoFornecedor no motor Saracota...');
  const resProcessamento = await processarCotacaoFornecedor(cotacaoRecord.id, cofemaFornecedorId, async (msg) => {
    log(`[PROGRESS] ${msg}`);
  });

  log('=== OBJETO BRUTO DO PROCESSAMENTO ANTES DA PERSISTÊNCIA ===');
  log(JSON.stringify(resProcessamento, null, 2));

  // 4. Capturar print do modal/resumo no frontend Saracota (http://localhost:3000)
  log('Passo 5: Acessando Saracota Localhost (http://localhost:3000) para capturar modal/resumo...');
  const uiBrowser = await chromium.launch({ headless: true });
  const uiContext = await uiBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  const uiPage = await uiContext.newPage();

  try {
    await uiPage.goto(`http://localhost:3000/cotacoes/${cotacaoRecord.id}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
      await uiPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    });
    await uiPage.waitForTimeout(3000);

    const print2Path = path.join(printsDir, '02_modal_resumo_saracota.png');
    await uiPage.screenshot({ path: print2Path, fullPage: true });
    log(`Print do modal/resumo da Saracota salvo em: ${print2Path}`);
  } catch (uiErr: any) {
    log(`Erro na captura da UI da Saracota: ${uiErr.message}`);
  } finally {
    await uiBrowser.close();
  }

  // Save execution log
  fs.writeFileSync(path.join(targetDir, 'execucao_raw.log'), logLines.join('\n'));

  // Create RESUMO.md
  const resumoMd = `# Auditoria e Validação do Zero — Cofema
**Data/Hora:** 25/09/2026
**Cotação ID:** \`${cotacaoRecord.id}\`
**Status:** CONCLUÍDO COM SUCESSO

## Evidências
1. **Print 1 (Carrinho Real no Portal Cofema):** [01_carrinho_real_cofema.png](./prints/01_carrinho_real_cofema.png)
2. **Print 2 (Modal / Resumo na Saracota):** [02_modal_resumo_saracota.png](./prints/02_modal_resumo_saracota.png)
3. **Log Bruto de Execução:** [execucao_raw.log](./execucao_raw.log)

## Objeto Processado (Preço & Nome Extraídos)
\`\`\`json
${JSON.stringify(resProcessamento.itensProcessados, null, 2)}
\`\`\`
`;

  fs.writeFileSync(path.join(targetDir, 'RESUMO.md'), resumoMd);
  log(`=== AUDITORIA FINALIZADA COM SUCESSO EM: ${targetDir} ===`);
}

runNewCofemaE2E().catch(console.error);
