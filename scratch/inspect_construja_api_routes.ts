async function testConstrujaApi() {
  console.log('Testing Construjá REST API endpoints...');

  const urls = [
    'https://api.construja.com.br/v1/vitrines/home',
    'https://api.construja.com.br/v1/produtos',
    'https://api.construja.com.br/v1/categorias',
    'https://api.construja.com.br/v1/busca',
    'https://construja.com.br/api/produtos',
    'https://construja.com.br/api/busca'
  ];

  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': 'https://construja.com.br/'
        }
      });
      console.log(`URL: ${u} | Status: ${res.status}`);
      if (res.status === 200) {
        const text = await res.text();
        console.log(`Snippet: ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`URL: ${u} | Error: ${e.message}`);
    }
  }
}

testConstrujaApi().catch(console.error);
