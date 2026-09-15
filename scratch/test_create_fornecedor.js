const http = require('http');

const postData = JSON.stringify({
  nome: 'Fornecedor Teste Produção Real',
  categoria: 'Elétrica',
  whatsapp: '(11) 98888-7777',
  urlPortalB2B: 'https://www.fornecedorteste.com.br',
  login: 'compras@fornecedorteste.com.br',
  senha: 'SenhaSegura123!',
  observacoes: 'Teste de cadastro no Supabase real'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/fornecedores',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log('📡 TESTANDO POST /api/v1/fornecedores...');
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('STATUS HTTP:', res.statusCode);
    console.log('RESPOSTA:', body);
  });
});

req.on('error', (e) => console.error('Erro na requisição:', e));
req.write(postData);
req.end();
