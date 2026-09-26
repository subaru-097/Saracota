import { chromium } from 'playwright';
import { db } from '../lib/db/client';
import { cofemaRealizarLogin } from '../core/services/supplier-quote-engine/cofemaExtractor';

async function testCofemaNav() {
  const fornDbRecord = await db.fornecedores.getById('752e18bd-4f41-414a-8f66-0d8f538de99e');
  const user = fornDbRecord?.emailLogin || fornDbRecord?.login_salvo || '43.313.798/0001-34';
  const pass = require('../lib/security/vault').decryptAES256(fornDbRecord.rawSenhaCriptografada || fornDbRecord.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const config = { url_site: 'https://www.cofema.com.br/' };

  try {
    await cofemaRealizarLogin(page, config, { user, pass });
    console.log('Login OK. URL:', page.url());

    // Inspecionar todos os links e botões do header
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('header') || document.body;
      const links = Array.from(header.querySelectorAll('a, button, input')).map(el => ({
        tag: el.tagName,
        text: (el.innerText || '').trim(),
        href: el.getAttribute('href'),
        placeholder: el.getAttribute('placeholder'),
        class: el.className
      }));
      return links;
    });

    console.log('Elementos do Header:\n', JSON.stringify(headerInfo, null, 2));

    // Testar busca usando client-side router ou window.location ou typing
    console.log('Testando navegação via client-side router push...');
    await page.evaluate(() => {
      // Se for React/Next.js/SPA, usar router se disponível, ou setSearchParam
      window.location.href = '/page/busca?q=296511';
    });
    await page.waitForTimeout(4000);

    console.log('URL após client-side nav:', page.url());
    const isBlocked = await page.evaluate(() => document.body.innerText.includes('Acesso bloqueado'));
    console.log('Acesso bloqueado?', isBlocked);

    if (!isBlocked) {
      const prodsCount = await page.evaluate(() => document.querySelectorAll('button:has-text("Adicionar"), button:has-text("carrinho")').length);
      console.log('Produtos encontrados na tela:', prodsCount);
    } else {
      // Se window.location.href foi bloqueado, testar com click/fetch/SPA router
      console.log('Testando busca via fetch API do Next.js / API Cofema...');
      const apiRes = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/produtos?busca=296511');
          return await res.json();
        } catch (e: any) {
          return e.message;
        }
      });
      console.log('API Res:', apiRes);
    }

  } finally {
    await browser.close();
  }
}

testCofemaNav();
