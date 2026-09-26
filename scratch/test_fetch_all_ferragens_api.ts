import * as fs from 'fs';

async function fetchAllFerragens() {
  console.log('🚀 Iniciando download dos 12.816 produtos de Ferragens (Categoria 01) via API direta...');
  const startTime = Date.now();

  const categoryCode = '01';
  const limit = 100;
  let page = 1;
  let totalPages = 1;
  let totalRecords = 0;
  const allProducts: any[] = [];

  while (page <= totalPages) {
    const res = await fetch('https://www.cofema.com.br/api/produto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': `https://www.cofema.com.br/page/categoria/${categoryCode}`
      },
      body: JSON.stringify({
        action: 'fetchProdutosByCategoria',
        categoriaCodigo: categoryCode,
        params: {
          sortBy: 'PERC_PROMOCAO',
          descending: true,
          filters: { TIPO_GRUPO_CODIGO: categoryCode, FILIAL: '0101' },
          limit,
          page
        }
      })
    });

    if (res.status !== 200) {
      console.error(`Erro HTTP ${res.status} na página ${page}`);
      break;
    }

    const data = await res.json();
    totalRecords = data.totalRecords || totalRecords;
    totalPages = data.totalPages || totalPages;

    const records = data.records || [];
    allProducts.push(...records);

    if (page % 10 === 0 || page === totalPages) {
      console.log(`  Progress: Página ${page}/${totalPages} (${allProducts.length}/${totalRecords} produtos baixados)`);
    }

    page++;
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ TESTE DE API DIRECTA CONCLUÍDO EM ${durationSec} SEGUNDOS!`);
  console.log(`📊 Total Anunciado: ${totalRecords}`);
  console.log(`📊 Total Baixado via API: ${allProducts.length}`);
  console.log(`📊 Taxa de Sucesso / Cobertura: ${((allProducts.length / totalRecords) * 100).toFixed(2)}%`);

  // Unicidade
  const uniqueSkus = new Set(allProducts.map(p => p.codigo));
  console.log(`📊 SKUs Únicos Confirmados: ${uniqueSkus.size}`);

  fs.writeFileSync('scratch/cofema_ferragens_api_sample.json', JSON.stringify(allProducts, null, 2));
}

fetchAllFerragens().catch(console.error);
