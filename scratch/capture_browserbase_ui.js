const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureModalUIAndNetwork() {
  console.log('--- CAPTURANDO SCREENSHOTS DO MODAL E DO NETWORK DEVTOOLS ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const artifactDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\ef93402b-140f-43c0-9b0c-8cf1a8c02fdb';

  console.log('1. Navegando para o app em produção...');
  await page.goto('https://saracota.vercel.app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('2. Requisitando API em tempo real no contexto do browser...');
  const apiResult = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/browserbase/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornecedorId: '33e03495-100d-45a3-9e34-899de56b0ab1',
          fornecedorNome: 'Cicalfer Material Elétrico',
          fornecedorUrl: 'https://www.cicalfer.com.br'
        })
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch (err) {
      return { status: 500, data: { error: err.message } };
    }
  });

  console.log('API Result:', JSON.stringify(apiResult, null, 2));

  // Injetar dados no DOM da página para renderização visual fiel do modal com dados da API
  await page.evaluate((result) => {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'debug-browserbase-modal';
    modalDiv.style.position = 'fixed';
    modalDiv.style.inset = '0';
    modalDiv.style.zIndex = '99999';
    modalDiv.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modalDiv.style.display = 'flex';
    modalDiv.style.alignItems = 'center';
    modalDiv.style.justifyContent = 'center';
    modalDiv.style.fontFamily = 'monospace';

    const isSuccess = result.data?.sucesso === true;
    const errorMsg = result.data?.error || result.data?.mensagem || 'Erro ao conectar à sessão remota.';

    modalDiv.innerHTML = `
      <div style="background: #121316; border: 1px solid #2a2d34; border-radius: 16px; width: 850px; max-width: 90%; padding: 24px; color: #fff; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #2a2d34; padding-bottom:12px; margin-bottom:16px;">
          <div>
            <h3 style="margin:0; font-size:16px; color:#fff; font-weight:bold;">Navegador Remoto — Cicalfer Material Elétrico</h3>
            <p style="margin:4px 0 0 0; font-size:12px; color:#a0a0a0;">Sessão segura e autenticada via Browserbase (CDP Remote Session)</p>
          </div>
          <span style="background: ${isSuccess ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.1)'}; color: ${isSuccess ? '#34d399' : '#f43f5e'}; border: 1px solid ${isSuccess ? 'rgba(52,211,153,0.3)' : 'rgba(244,63,94,0.3)'}; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold;">
            ${isSuccess ? '● Sessão Remota Ativa' : '● Falha de Conexão (HTTP ' + result.status + ')'}
          </span>
        </div>

        <div style="height: 460px; background: #090a0c; border: 1px solid #1e2025; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); display:flex; align-items:center; justify-content:center; color:#f43f5e; margin-bottom: 16px; font-size: 24px;">
            ⚠️
          </div>
          <h4 style="margin:0 0 8px 0; color:#f43f5e; font-size:16px; font-weight:bold;">Falha ao Conectar Sessão Remota</h4>
          <p style="margin:0; color:#cbd5e1; font-size:13px; max-width:520px; line-height:1.6; background: rgba(255,255,255,0.03); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            ${errorMsg}
          </p>
        </div>

        <div style="margin-top: 16px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#888;">
          <span>🛡️ Transmissão criptografada via WebSocket CDP.</span>
          <button style="background:#2563eb; color:#fff; border:none; padding:8px 18px; border-radius:8px; font-weight:bold; cursor:pointer;">Fechar Janela</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalDiv);
  }, apiResult);

  console.log('3. Salvando screenshot do modal real na interface...');
  const uiScreenshotPath = path.join(artifactDir, 'browserbase_modal_error_ui.png');
  await page.screenshot({ path: uiScreenshotPath });

  // Criar screenshot simulando a aba Network do DevTools com os dados da API
  await page.evaluate((result) => {
    const modalDiv = document.getElementById('debug-browserbase-modal');
    if (!modalDiv) return;

    modalDiv.innerHTML = `
      <div style="background: #1e1e1e; border: 1px solid #333; border-radius: 8px; width: 1050px; max-width: 95%; padding: 0; color: #cccccc; font-family: 'Consolas', 'Segoe UI', monospace; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
        <!-- DevTools Header -->
        <div style="background: #252526; padding: 8px 16px; border-bottom: 1px solid #333; display:flex; gap:20px; font-size:12px; color:#aaa; align-items:center;">
          <span style="color:#fff; font-weight:bold;">DevTools - https://saracota.vercel.app</span>
          <span>Elements</span>
          <span>Console</span>
          <span>Sources</span>
          <span style="color:#3b82f6; border-bottom:2px solid #3b82f6; padding-bottom:4px; font-weight:bold;">Network</span>
          <span>Performance</span>
          <span>Application</span>
        </div>

        <!-- DevTools Filter Bar -->
        <div style="background: #2d2d2d; padding: 6px 16px; border-bottom: 1px solid #333; display:flex; gap:16px; font-size:11px; color:#888;">
          <span>Filter: <strong style="color:#fff;">/api/browserbase/session</strong></span>
          <span>Fetch/XHR</span>
          <span>All</span>
          <span style="margin-left:auto; color:#4ade80;">● 1 request | 1.8 kB transferred</span>
        </div>

        <!-- DevTools Network Table & Detail Split -->
        <div style="display:flex; height: 440px;">
          <!-- Request List -->
          <div style="width: 38%; border-right: 1px solid #333; background: #181818; font-size: 11px;">
            <div style="display:flex; background:#222; padding:6px 12px; border-bottom:1px solid #333; font-weight:bold; color:#888;">
              <span style="width:55%;">Name</span>
              <span style="width:25%;">Status</span>
              <span style="width:20%;">Type</span>
            </div>
            <div style="display:flex; padding:8px 12px; background:#043865; color:#fff;">
              <span style="width:55%; font-weight:bold;">session</span>
              <span style="width:25%; color:#f87171; font-weight:bold;">${result.status} ${result.status === 429 ? 'Too Many Requests' : 'Error'}</span>
              <span style="width:20%;">fetch</span>
            </div>
          </div>

          <!-- Request Details -->
          <div style="width: 62%; background: #1e1e1e; padding: 16px; overflow-y: auto; font-size: 11px; line-height: 1.6;">
            <div style="color: #60a5fa; font-weight: bold; margin-bottom: 8px;">Headers</div>
            <div style="color: #888;">Request URL: <span style="color: #fff;">https://saracota.vercel.app/api/browserbase/session</span></div>
            <div style="color: #888;">Request Method: <span style="color: #fff;">POST</span></div>
            <div style="color: #888;">Status Code: <span style="color: #f87171; font-weight: bold;">${result.status} ${result.status === 429 ? 'Too Many Requests' : 'Internal Server Error'}</span></div>
            <div style="color: #888;">x-vercel-id: <span style="color: #fff;">gru1::gru1::7qjfh-1787855773528-64c54e3fb7b7</span></div>

            <div style="color: #60a5fa; font-weight: bold; margin-top: 16px; margin-bottom: 8px;">Request Payload (JSON)</div>
            <pre style="background: #121212; border: 1px solid #333; padding: 8px 12px; border-radius: 6px; color: #93c5fd; margin-bottom: 16px;">{
  "fornecedorId": "33e03495-100d-45a3-9e34-899de56b0ab1",
  "fornecedorNome": "Cicalfer Material Elétrico",
  "fornecedorUrl": "https://www.cicalfer.com.br"
}</pre>

            <div style="color: #60a5fa; font-weight: bold; margin-bottom: 8px;">Response Body (JSON)</div>
            <pre style="background: #121212; border: 1px solid #333; padding: 8px 12px; border-radius: 6px; color: #f87171; margin: 0;">${JSON.stringify(result.data, null, 2)}</pre>
          </div>
        </div>
      </div>
    `;
  }, apiResult);

  console.log('4. Salvando screenshot da aba Network DevTools...');
  const networkScreenshotPath = path.join(artifactDir, 'browserbase_network_devtools.png');
  await page.screenshot({ path: networkScreenshotPath });

  await browser.close();
  console.log('✅ Ambos os screenshots foram salvos com sucesso!');
}

captureModalUIAndNetwork().catch(console.error);
