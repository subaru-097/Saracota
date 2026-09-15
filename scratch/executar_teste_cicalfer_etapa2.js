const http = require('http');
const { db } = require('../lib/db/client');

function postJson(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = JSON.stringify(data);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getJson(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

async function executarTesteCicalfer() {
  console.log('================================================================');
  console.log('🧪 TESTE DE COTAÇÃO REAL NA CICALFER — ETAPA 2');
  console.log('================================================================\n');

  const idCicalfer = '33e03495-100d-45a3-9e34-899de56b0ab1';
  const cotacaoId = `cot-cicalfer-etapa2-${Date.now()}`;

  console.log(`1. Criando cotação de teste no banco real: ID "${cotacaoId}"...`);
  await db.cotacoes.create({
    id: cotacaoId,
    obra: 'Obra Exemplo Cicalfer',
    fornecedorIds: [idCicalfer],
    itens: [
      { material: 'Cabo Flexível SIL 750V 2,5mm Azul', quantidade: 100 },
      { material: 'Disjuntor Bipolar Din 32A Steck', quantidade: 5 }
    ]
  });

  console.log('\n2. Disparando automação RPA via POST /api/cotacoes/[cotacaoId]/processar...');
  const processRes = await postJson(`http://localhost:3000/api/cotacoes/${cotacaoId}/processar`, {});
  console.log('  Response:', processRes);

  console.log('\n3. Acompanhando o polling de progresso em tempo real...');
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await getJson(`http://localhost:3000/api/cotacoes/${cotacaoId}/status`);
    console.log(`  [Poll ${i + 1}] Status:`, statusRes.data.status, `| Percentual: ${statusRes.data.percentualConcluido}%`);
    if (statusRes.data.mensagens) {
      console.log('  [Mensagens Ultimas]:', statusRes.data.mensagens.slice(-2));
    }
  }

  console.log('\n4. Verificando resultados de matching salvos...');
  const resultados = await db.cotacoes.obterResultadosMatching(cotacaoId);
  console.log('  Resultados Extraídos:', JSON.stringify(resultados, null, 2));

  console.log('\n================================================================');
  console.log('✅ TESTE DE COTAÇÃO CICALFER FINALIZADO');
  console.log('================================================================');
}

executarTesteCicalfer().catch(console.error);
