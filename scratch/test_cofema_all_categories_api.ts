async function inspectGetCat() {
  const res = await fetch('https://www.cofema.com.br/api/categoria', { method: 'GET' });
  console.log(`GET /api/categoria status: ${res.status}`);
  console.log(await res.text());
}
inspectGetCat().catch(console.error);
