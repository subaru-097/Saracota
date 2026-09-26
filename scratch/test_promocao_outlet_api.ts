async function testPromocaoOutlet() {
  console.log('Testing Promocao and Outlet endpoints...\n');

  // Promocao
  const resProm = await fetch('https://www.cofema.com.br/api/produto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      action: 'fetchProdutosByPromocao',
      params: { limit: 100, page: 1, filters: { FILIAL: '0101' } }
    })
  });
  const dataProm = await resProm.json();
  console.log(`Promocao: totalRecords = ${dataProm.totalRecords} | records = ${dataProm.records?.length}`);

  // fetchProdutos for Outlet or Exibir Home
  const resHome = await fetch('https://www.cofema.com.br/api/produto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      action: 'fetchProdutos',
      params: { limit: 100, page: 1, sortBy: 'PERC_PROMOCAO', descending: true, filters: { OUTLET: 1, FILIAL: '0101' } }
    })
  });
  const dataHome = await resHome.json();
  console.log(`Outlet: totalRecords = ${dataHome.totalRecords} | records = ${dataHome.records?.length}`);
}

testPromocaoOutlet().catch(console.error);
