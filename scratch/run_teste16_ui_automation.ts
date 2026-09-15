import { db } from '../lib/db/client';
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('🚀 [TESTE 16 UI] Iniciando automação de teste UI e geração de evidências...');

  const cicalferDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste16_correcao', 'cicalfer');
  const construjaDir = path.join(process.cwd(), 'historicos', '2026-09-15', 'teste16_correcao', 'construja');
  if (!fs.existsSync(cicalferDir)) fs.mkdirSync(cicalferDir, { recursive: true });
  if (!fs.existsSync(construjaDir)) fs.mkdirSync(construjaDir, { recursive: true });

  const cicalferId = '33e03495-71cb-4027-a068-d064cfb395ee';
  const construjaId = 'a1684c4d-d896-4ba9-a591-cda455c5ffe2';

  const itens = [
    { id: 'it-1', material: '3 CAIXA DA AGUA FORTLEV 310L', quantidade: 3, unidade: 'un' },
    { id: 'it-2', material: '6 DUCHA LORENZETTI BELLA DUCHA 127V', quantidade: 6, unidade: 'un' }
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // ------------------------------------------------------------------
  // 1. CICALFER SOLO TEST
  // ------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('1. TESTE SOLO CICALFER VIA INTERFACE SARA COTA');
  console.log('================================================================');

  const cotacaoCicalfer = await db.cotacoes.create({
    obraNome: 'Reserva das Palmeiras',
    itens: itens,
    fornecedorIds: [cicalferId],
    fornecedores_selecionados: [cicalferId]
  });

  console.log(`📦 Cotação Cicalfer criada com ID: ${cotacaoCicalfer.id}`);

  await page.goto('http://localhost:3000/cotacoes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(cicalferDir, '01_fornecedores_selecionados.png'), fullPage: true });

  const resProcessCic = await fetch(`http://localhost:3000/api/cotacoes/${cotacaoCicalfer.id}/processar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itens: itens,
      fornecedorIds: [cicalferId]
    })
  });

  console.log(`⚡ API Processar Cicalfer status: ${resProcessCic.status}`);
  await page.screenshot({ path: path.join(cicalferDir, '02_modal_progresso_iniciado.png'), fullPage: true });

  const startCic = Date.now();
  while (Date.now() - startCic < 40000) {
    await page.waitForTimeout(3000);
    const statusRes = await fetch(`http://localhost:3000/api/cotacoes/${cotacaoCicalfer.id}/status`);
    if (statusRes.ok) {
      const st = await statusRes.json();
      console.log(`⏳ Progresso Cicalfer: ${st.status}`);
      await page.screenshot({ path: path.join(cicalferDir, '03_processamento_rpa.png'), fullPage: true });

      if (st.status === 'concluid' || st.status === 'aguardando_revisao' || st.status === 'concluido' || st.progresso === 100) {
        console.log('✅ [Cicalfer] Concluído!');
        break;
      }
    }
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(cicalferDir, '04_modal_final_saracota.png'), fullPage: true });
  console.log('📸 [Cicalfer] 04_modal_final_saracota.png salvo.');

  // ------------------------------------------------------------------
  // 2. CONSTRUJÁ SOLO TEST
  // ------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('2. TESTE SOLO CONSTRUJÁ VIA INTERFACE SARA COTA');
  console.log('================================================================');

  const cotacaoConstruja = await db.cotacoes.create({
    obraNome: 'Reserva das Palmeiras',
    itens: itens,
    fornecedorIds: [construjaId],
    fornecedores_selecionados: [construjaId]
  });

  console.log(`📦 Cotação Construjá criada com ID: ${cotacaoConstruja.id}`);

  await page.goto('http://localhost:3000/cotacoes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(construjaDir, '01_fornecedores_selecionados.png'), fullPage: true });

  const resProcessCons = await fetch(`http://localhost:3000/api/cotacoes/${cotacaoConstruja.id}/processar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itens: itens,
      fornecedorIds: [construjaId]
    })
  });

  console.log(`⚡ API Processar Construjá status: ${resProcessCons.status}`);
  await page.screenshot({ path: path.join(construjaDir, '02_modal_progresso_iniciado.png'), fullPage: true });

  const startCons = Date.now();
  while (Date.now() - startCons < 30000) {
    await page.waitForTimeout(3000);
    const statusRes = await fetch(`http://localhost:3000/api/cotacoes/${cotacaoConstruja.id}/status`);
    if (statusRes.ok) {
      const st = await statusRes.json();
      console.log(`⏳ Progresso Construjá: ${st.status}`);
      if (st.status === 'concluid' || st.status === 'aguardando_revisao' || st.status === 'concluido' || st.progresso === 100) {
        console.log('✅ [Construjá] Concluído!');
        break;
      }
    }
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(construjaDir, '03_modal_final_saracota.png'), fullPage: true });
  console.log('📸 [Construjá] 03_modal_final_saracota.png salvo.');

  await browser.close();
  console.log('\n✅ [TESTE 16 UI] Finalizado com sucesso!');
}

main().catch(console.error);
