async function testNodeFetchKeys() {
  const res = await fetch('https://www.cofema.com.br/api/produto', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Referer': 'https://www.cofema.com.br/page/categoria/01',
      'Accept': 'application/json, text/plain, */*'
    },
    body: JSON.stringify({
      action: 'fetchProdutosByCategoria',
      categoriaCodigo: '01',
      params: {
        sortBy: 'PERC_PROMOCAO',
        descending: true,
        filters: { TIPO_GRUPO_CODIGO: '01', FILIAL: '0101' },
        limit: 5,
        page: 1
      }
    })
  });

  const data = await res.json();
  console.log('Keys of record 0:', Object.keys(data.records[0]));
  console.log('Record 0:', JSON.stringify(data.records[0], null, 2));
}

testNodeFetchKeys();
