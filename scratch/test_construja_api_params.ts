async function testConstrujaParams() {
  console.log('Testing query parameters for https://api.construja.com.br/v1/busca ...\n');

  // Test 1: page=2
  const resPage2 = await fetch('https://api.construja.com.br/v1/busca?page=2', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data2 = await resPage2.json();
  console.log(`Test page=2: status=${resPage2.status}, current_page=${data2.paginator?.current_page}, items_count=${data2.itens?.length}`);
  if (data2.itens?.length > 0) {
    console.log('Sample item:', data2.itens[0].id, '-', data2.itens[0].descComp);
  }

  // Test 2: per_page=100
  const res100 = await fetch('https://api.construja.com.br/v1/busca?page=1&per_page=100', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data100 = await res100.json();
  console.log(`\nTest per_page=100: status=${res100.status}, per_page=${data100.paginator?.per_page}, items_count=${data100.itens?.length}`);

  // Test 3: inspect keys of item object
  if (data2.itens?.length > 0) {
    console.log('\nKeys of Construja item:', Object.keys(data2.itens[0]));
    console.log('Sample item detail:', JSON.stringify(data2.itens[0], null, 2));
  }
}

testConstrujaParams().catch(console.error);
