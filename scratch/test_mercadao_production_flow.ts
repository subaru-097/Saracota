import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { db, supabase } from '../lib/db/client';
import { processarCotacaoFornecedor } from '../lib/services/automacao/matchingEngine';

async function runProductionFlowTest() {
  console.log('================================================================');
  console.log('EXECUTANDO TESTE E2E DE PRODUÇÃO PARA MERCADÃO LOJISTA');
  console.log('================================================================');

  const mercadaoId = 'a4042203-b504-4a82-af41-8ffa19ae24a6';

  // 1. Criar cotação no fluxo real da Sara Cota
  const quoteRecord = await db.cotacoes.create({
    obraNome: 'Obra Reserva das Palmeiras - Homologação Produção',
    fornecedor_id: mercadaoId,
    fornecedorIds: [mercadaoId],
    fornecedores_selecionados: [mercadaoId],
    status: 'pendente',
    itens: [
      {
        material: 'Chave Combinada 27mm',
        quantidade: 15,
        unidade: 'un',
        categoria: 'ferramentas'
      }
    ]
  });

  console.log(`✅ Cotação de produção criada no Supabase! ID: "${quoteRecord.id}"`);

  // 2. Disparar o motor de automação central da Sara Cota (processarCotacaoFornecedor)
  console.log('\n--- EXECUTANDO MOTOR DE AUTOMAÇÃO (processarCotacaoFornecedor) ---');
  const resultadoMotor = await processarCotacaoFornecedor(quoteRecord.id, mercadaoId, async (msg: string) => {
    console.log(`  [PROGRESSO MOTOR]: ${msg}`);
  });

  console.log('\n--- RESULTADO DO MOTOR DE AUTOMAÇÃO ---');
  console.log('Sucesso:', resultadoMotor.sucesso);
  console.log('Itens Processados:', JSON.stringify(resultadoMotor.itensProcessados, null, 2));

  if (!resultadoMotor.sucesso) {
    throw new Error('Processamento do motor falhou para Mercadão Lojista!');
  }

  // 3. Capturar print da interface Sara Cota (http://localhost:3000)
  console.log('\n--- CAPTURANDO EVIDÊNCIA DA INTERFACE SARA COTA ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const auditTimestamp = 'teste_producao_2026-09-25_19h25min';
  const evidenceDir = path.join(process.cwd(), 'docs', 'auditorias', 'historico', auditTimestamp);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  try {
    await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    const printPath = path.join(evidenceDir, '01_saracota_modal_resultado_mercadao.png');
    await page.screenshot({ path: printPath, fullPage: true });
    console.log(`📸 Print da interface Sara Cota salvo em: ${printPath}`);

    console.log('\n================================================================');
    console.log('CICLO COMPLETO DE PRODUÇÃO CONCLUÍDO COM SUCESSO!');
    console.log('================================================================');
  } finally {
    await browser.close();
  }
}

runProductionFlowTest().catch((err) => {
  console.error('❌ Falha no teste E2E de produção:', err);
  process.exit(1);
});
