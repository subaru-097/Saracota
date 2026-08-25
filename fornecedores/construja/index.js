const { chromium } = require('playwright');
const { login } = require('./login');
const { buscarProduto } = require('./buscarProduto');

async function cotarConstruja(credenciais, itens) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Network Monitoring / Logger de Payloads e Respostas HTTP de Login
  page.on('request', (request) => {
    if (request.url().includes('login') && request.method() === 'POST') {
      console.log('PAYLOAD ENVIADO:', request.postData());
    }
  });

  page.on('response', async (response) => {
    if (response.url().includes('login')) {
      console.log('STATUS:', response.status());
      try {
        console.log('RESPOSTA:', await response.text());
      } catch (e) {
        console.log('RESPOSTA (erro ao ler corpo):', e.message);
      }
    }
  });

  await login(page, credenciais);

  const resultados = [];
  for (const item of itens) {
    const resultado = await buscarProduto(page, item.produto, item.quantidade);
    resultados.push({ ...resultado, fornecedor: 'construja' });
  }

  await browser.close();
  return resultados;
}

module.exports = { cotarConstruja };
