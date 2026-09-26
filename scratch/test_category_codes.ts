async function testCategoryCodes() {
  console.log('Testing category codes 01 to 15...\n');

  for (let i = 1; i <= 15; i++) {
    const code = i.toString().padStart(2, '0');
    try {
      const res = await fetch('https://www.cofema.com.br/api/produto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': `https://www.cofema.com.br/page/categoria/${code}`
        },
        body: JSON.stringify({
          action: 'fetchProdutosByCategoria',
          categoriaCodigo: code,
          params: {
            sortBy: 'PERC_PROMOCAO',
            descending: true,
            filters: { TIPO_GRUPO_CODIGO: code, FILIAL: '0101' },
            limit: 1,
            page: 1
          }
        })
      });

      const data = await res.json();
      const firstItem = data.records?.[0];
      const categoryName = firstItem ? firstItem.tipoGrupoDescricao : 'N/A';
      console.log(`Code "${code}": totalRecords = ${data.totalRecords} | Name = "${categoryName}"`);
    } catch (e: any) {
      console.log(`Code "${code}": ERROR ${e.message}`);
    }
  }
}

testCategoryCodes().catch(console.error);
