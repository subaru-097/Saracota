const https = require('https');

const postData = JSON.stringify({
  fornecedorId: '33e03495-100d-45a3-9e34-899de56b0ab1',
  fornecedorNome: 'Cicalfer Material Elétrico',
  fornecedorUrl: 'https://cicalfer.com.br/',
  itens: [
    { texto: 'Chuveiro Lorenzetti Maxi Ducha 220v', quantidade: 5 },
    { texto: 'Fita crepe', quantidade: 1 },
    { texto: 'Disco de corte Starrett', quantidade: 1 },
    { texto: 'Luva de PVC 100mm', quantidade: 1 },
    { texto: 'Furadeira de impacto 1/2"', quantidade: 1 },
  ],
});

const options = {
  hostname: 'saracota.vercel.app',
  path: '/api/browserbase/session',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('RESPONSE:', body);
  });
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
