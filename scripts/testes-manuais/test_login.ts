// ATENÇÃO: Não executar simultaneamente com a aplicação web em produção/dev — pode conflitar com o motor RPA ativo (ver lock em matchingEngine.ts)

import { chromium } from 'playwright';

async function testarFluxoLogin() {
  console.log('🧪 TESTANDO FLUXOS DE LOGIN (FALHA DE SERVIDORES VS LOGIN TESTE)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
  });

  try {
    console.log('\n--- 1. TESTE COM USUÁRIO NÃO-TESTE (Deverá exibir mensagem de erro clara) ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('#email', 'usuario.desconhecido@construtora.com.br');
    await page.fill('#password', 'senha123456');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);
    const erroVisible = await page.textContent('.text-rose-400');
    console.log(`Mensagem de erro exibida na tela: "${erroVisible?.trim()}"`);

    console.log('\n--- 2. TESTE COM USUÁRIO PROPRIETÁRIO (Deverá entrar no /painel) ---');
    await page.fill('#email', 'admin@saracota.com.br');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log(`URL final após login: ${currentUrl}`);

    if (currentUrl.includes('/painel')) {
      console.log('🎉 ✅ TESTE DE LOGIN E REDIRECIONAMENTO AO PAINEL 100% SUCESSO!');
    } else {
      console.error('❌ Falha no redirecionamento final.');
    }
  } catch (err) {
    console.error('❌ Erro durante o teste:', err);
  } finally {
    await browser.close();
  }
}

testarFluxoLogin();
