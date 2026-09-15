const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runDiagnostic() {
  const outputDir = path.join(__dirname, '..', 'diagnostico_seekoffer');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const networkLogs = [];
  const reportLines = [];
  function log(msg) {
    console.log(msg);
    reportLines.push(msg);
  }

  log('=====================================================');
  log('DIAGNÓSTICO COMPLETO - FORNECEDOR SEEKOFFER');
  log(`Data/Hora: ${new Date().toISOString()}`);
  log('=====================================================\n');

  // Launch browser headful
  log('1. Iniciando Playwright em modo HEADFUL (headless: false)...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // 9. Monitoring Network requests
  page.on('request', req => {
    networkLogs.push(`[REQ] ${req.method()} ${req.url()} (${req.resourceType()})`);
  });

  page.on('response', res => {
    networkLogs.push(`[RES] Status: ${res.status()} | ${res.request().method()} ${res.url()}`);
  });

  page.on('requestfailed', req => {
    networkLogs.push(`[FAIL] ${req.failure()?.errorText || 'Failed'} | ${req.method()} ${req.url()}`);
  });

  // URL test
  const targetUrl = 'https://www.seekoffer.com';
  log(`\n2. Navegando para URL inicial do SeekOffer: ${targetUrl}...`);

  let gotoResponse = null;
  try {
    gotoResponse = await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
    log(`Goto Status HTTP: ${gotoResponse ? gotoResponse.status() : 'N/A'}`);
  } catch (err) {
    log(`ERRO no goto: ${err.message}`);
  }

  // Screenshot 1: Immediately after goto
  const screenshot1Path = path.join(outputDir, '01_pagina_inicial_imediato.png');
  await page.screenshot({ path: screenshot1Path, fullPage: true });
  log(`[SCREENSHOT 1] Salvo em: ${screenshot1Path}`);

  // 3. Wait 3 seconds
  log('\n3. Aguardando 3 segundos para renderização JS...');
  await page.waitForTimeout(3000);

  const screenshot2Path = path.join(outputDir, '02_pagina_inicial_3s.png');
  await page.screenshot({ path: screenshot2Path, fullPage: true });
  log(`[SCREENSHOT 2] Salvo em: ${screenshot2Path}`);

  // 4. Save COMPLETE HTML page.content()
  const html1 = await page.content();
  const html1Path = path.join(outputDir, '01_pagina_inicial.html');
  fs.writeFileSync(html1Path, html1, 'utf-8');
  log(`[HTML 1] Salvo em: ${html1Path} (Tamanho: ${html1.length} caracteres / ${(html1.length/1024).toFixed(2)} KB)`);

  // 5. Check and list IFRAMES
  log('\n5. Verificando a existência de <iframe> na página...');
  const frames = page.frames();
  log(`Total de frames encontrados (incluindo o principal): ${frames.length}`);
  const iframesInfo = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const name = frame.name();
    const url = frame.url();
    if (frame !== page.mainFrame()) {
      iframesInfo.push({ index: i, name, url });
      log(` - Iframe #${i}: Name="${name}", URL="${url}"`);
    }
  }
  if (iframesInfo.length === 0) {
    log(' -> Nenhum iframe secundário detectado na página principal.');
  }

  // 10. Check anti-bot & navigator.webdriver & protection scripts
  log('\n10. Verificando script de proteção / Anti-bot...');
  const antiBotChecks = await page.evaluate(() => {
    let cookieVal = '';
    try { cookieVal = document.cookie || ''; } catch(e) {}
    let bodyHtml = '';
    try { bodyHtml = document.body ? document.body.innerHTML : ''; } catch(e) {}

    return {
      webdriver: navigator.webdriver,
      hasCloudflare: !!(window.Cloudflare || document.title.includes('Just a moment') || bodyHtml.includes('cf-challenge') || document.querySelector('#challenge-running')),
      hasDataDome: !!(window.dd || cookieVal.includes('datadome') || bodyHtml.includes('datadome')),
      hasReCaptcha: !!(window.grecaptcha || document.querySelector('script[src*="recaptcha"]') || document.querySelector('.g-recaptcha')),
      hasHCaptcha: !!(window.hcaptcha || document.querySelector('script[src*="hcaptcha"]') || document.querySelector('.h-captcha')),
      hasAkamai: !!(window._cf_bm || cookieVal.includes('_abck')),
      title: document.title,
      url: window.location.href
    };
  });
  log(` -> navigator.webdriver: ${antiBotChecks.webdriver}`);
  log(` -> Título da página: "${antiBotChecks.title}"`);
  log(` -> URL final atual: ${antiBotChecks.url}`);
  log(` -> Cloudflare detectado: ${antiBotChecks.hasCloudflare}`);
  log(` -> DataDome detectado: ${antiBotChecks.hasDataDome}`);
  log(` -> reCAPTCHA detectado: ${antiBotChecks.hasReCaptcha}`);
  log(` -> hCaptcha detectado: ${antiBotChecks.hasHCaptcha}`);
  log(` -> Akamai / BotProtection detectado: ${antiBotChecks.hasAkamai}`);

  // 6. Simulate click on login modal trigger
  log('\n6. Procurando e simulando clique no botão/link de login...');
  const loginTriggerCandidates = [
    'a:has-text("Entrar")',
    'button:has-text("Entrar")',
    'text="Entrar"',
    'a:has-text("Login")',
    'button:has-text("Login")',
    'text="Login"',
    'a[href*="login"]',
    'a:has-text("Minha Conta")',
    '.login',
    '#login',
    'a:has-text("Acessar")',
    'button:has-text("Acessar")',
    'text="Sign In"',
    'a:has-text("Sign In")',
    'button:has-text("Sign In")'
  ];

  let triggerFound = null;
  for (const sel of loginTriggerCandidates) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        triggerFound = sel;
        log(` -> Botão/link de login localizado com o seletor: "${sel}"`);
        break;
      }
    } catch (e) {}
  }

  if (triggerFound) {
    log(`Clicando no elemento: "${triggerFound}"...`);
    try {
      await page.locator(triggerFound).first().click({ timeout: 5000 });
      log('Clique executado com sucesso.');
    } catch (clickErr) {
      log(`ERRO ao clicar no elemento de login: ${clickErr.message}`);
    }
  } else {
    log(' -> AVISO: Nenhum botão de login/modal padrão ("Entrar", "Login", "Sign In") foi visível no menu.');
    log(' -> Verificando se os campos de login já estão visíveis diretamente na página...');
  }

  // Screenshot 3: Immediately after click
  const screenshot3Path = path.join(outputDir, '03_apos_clique_login.png');
  await page.screenshot({ path: screenshot3Path, fullPage: true });
  log(`[SCREENSHOT 3] Salvo em: ${screenshot3Path}`);

  await page.waitForTimeout(2000);

  // Screenshot 4: Modal aberto
  const screenshot4Path = path.join(outputDir, '04_modal_aberto.png');
  await page.screenshot({ path: screenshot4Path, fullPage: true });
  log(`[SCREENSHOT 4] Salvo em: ${screenshot4Path}`);

  // 7. Save HTML after click
  const html2 = await page.content();
  const html2Path = path.join(outputDir, '02_modal_aberto.html');
  fs.writeFileSync(html2Path, html2, 'utf-8');
  log(`[HTML 2] Salvo em: ${html2Path} (Tamanho: ${html2.length} caracteres / ${(html2.length/1024).toFixed(2)} KB)`);

  // If iframes exist after click, dump their HTML too
  const framesAfterClick = page.frames();
  for (let i = 0; i < framesAfterClick.length; i++) {
    if (framesAfterClick[i] !== page.mainFrame()) {
      try {
        const frameHtml = await framesAfterClick[i].content();
        const frameHtmlPath = path.join(outputDir, `02_iframe_${i}_html.html`);
        fs.writeFileSync(frameHtmlPath, frameHtml, 'utf-8');
        log(`[IFRAME ${i} HTML] Salvo em: ${frameHtmlPath}`);
      } catch (fErr) {
        log(`Não foi possível obter HTML do iframe ${i}: ${fErr.message}`);
      }
    }
  }

  // 8. Locate email and password fields using selectors
  log('\n8. Testando localização dos campos de e-mail e senha com seletores...');
  const testSelectors = [
    { name: 'campo_email (DB/Padrão)', selector: 'input[name="email"]' },
    { name: 'campo_senha (DB/Padrão)', selector: 'input[name="senha"]' },
    { name: 'botao_entrar (DB/Padrão)', selector: 'button[type="submit"]' },
    { name: 'campo_email (Type email)', selector: 'input[type="email"]' },
    { name: 'campo_email (ID/Name login)', selector: '#email, #usuario, #login, input[name*="login"], input[name*="user"]' },
    { name: 'campo_senha (Type password)', selector: 'input[type="password"]' },
    { name: 'campo_senha (ID/Name pass)', selector: '#senha, #password, input[name*="pass"]' }
  ];

  for (const item of testSelectors) {
    try {
      const loc = page.locator(item.selector).first();
      const count = await page.locator(item.selector).count();
      const isAttached = count > 0;
      const isVisible = isAttached ? await loc.isVisible().catch(() => false) : false;
      const isEnabled = isVisible ? await loc.isEnabled().catch(() => false) : false;

      log(` -> Seletor [${item.name}] ("${item.selector}"):`);
      log(`    - Encontrado no DOM (attached): ${isAttached} (quantidade: ${count})`);
      log(`    - Visível na tela (visible): ${isVisible}`);
      log(`    - Habilitado (enabled): ${isEnabled}`);

      if (!isAttached) {
        log(`    - ERRO EXACT: Element not found / detached from DOM.`);
      } else if (!isVisible) {
        log(`    - ERRO EXACT: Element is in DOM but NOT VISIBLE (display:none / hidden).`);
      }
    } catch (err) {
      log(` -> Seletor [${item.name}] ("${item.selector}"): ERRO - ${err.message}`);
    }
  }

  // Also check inside iframes if any exist
  if (framesAfterClick.length > 1) {
    log('\n -> Testando seletores DENTRO dos iframes encontrados:');
    for (let fIdx = 0; fIdx < framesAfterClick.length; fIdx++) {
      const f = framesAfterClick[fIdx];
      if (f === page.mainFrame()) continue;
      log(`  Iframe #${fIdx} (${f.url()}):`);
      for (const item of testSelectors) {
        try {
          const count = await f.locator(item.selector).count();
          if (count > 0) {
            const loc = f.locator(item.selector).first();
            const vis = await loc.isVisible().catch(() => false);
            log(`   - Seletor [${item.name}] DENTRO do Iframe #${fIdx}: ENCONTRADO! Count: ${count}, Visível: ${vis}`);
          }
        } catch (fSelErr) {
          log(`   - Frame #${fIdx} error: ${fSelErr.message}`);
        }
      }
    }
  }

  // 9. Write network log
  const networkLogPath = path.join(outputDir, 'network_log.txt');
  fs.writeFileSync(networkLogPath, networkLogs.join('\n'), 'utf-8');
  log(`\n[NETWORK LOG] ${networkLogs.length} requisições salvas em: ${networkLogPath}`);

  // Write consolidated report text
  const reportPath = path.join(outputDir, 'relatorio_diagnostico.txt');
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
  log(`\n[RELATÓRIO DE DIAGNÓSTICO] Salvo em: ${reportPath}`);

  log('\nDiagnóstico finalizado com sucesso. Fechando navegador...');
  await browser.close();
  log('Navegador fechado.');
}

runDiagnostic().catch(err => {
  console.error('FATAL DIAGNOSTIC ERROR:', err);
});
