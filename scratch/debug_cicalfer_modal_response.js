const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const VAULT_SECRET = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
function getDerivedKey() { return crypto.createHash('sha256').update(VAULT_SECRET).digest(); }
function decryptAES256(encryptedData) {
  if (!encryptedData) return '';
  try {
    if (encryptedData.startsWith('enc_sec_')) {
      const parts = encryptedData.split('_');
      return Buffer.from(parts[parts.length - 1], 'base64').toString('utf-8');
    }
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      try { return Buffer.from(encryptedData, 'base64').toString('utf-8'); } catch(e) { return encryptedData; }
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getDerivedKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    try { return Buffer.from(encryptedData, 'base64').toString('utf-8'); } catch(e) { return '[DESCRIPTOGRAFIA_FALHOU]'; }
  }
}

async function debugModalResponse() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');
  const supplier = data[0];
  const loginUser = supplier.login_salvo;
  const loginPass = decryptAES256(supplier.senha_login || supplier.senha_criptografada);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', res => {
    if (res.url().includes('login') || res.url().includes('auth') || res.url().includes('api')) {
      console.log(`[API RESPONSE ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  await page.goto(supplier.url_site, { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // Accept Cookies
  const acceptCookie = page.locator('button:has-text("Aceitar")').first();
  if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptCookie.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Open Login Modal
  await page.locator('button#botao-login').first().click({ force: true });
  await page.waitForTimeout(2000);

  // Fill credentials
  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(loginPass);

  // Log all buttons inside modal
  const modalButtons = await page.evaluate(() => {
    const modal = document.querySelector('.modal.show, div.modal');
    if (!modal) return 'No modal found';
    const btns = Array.from(modal.querySelectorAll('button, input[type="submit"], div.btn, a.btn'));
    return btns.map(b => ({
      tag: b.tagName,
      id: b.id,
      className: b.className,
      text: b.innerText ? b.innerText.trim() : b.value
    }));
  });
  console.log('Buttons inside Modal before submit:', JSON.stringify(modalButtons, null, 2));

  // Click submit button
  console.log('Submitting form inside modal...');
  const submitBtn = page.locator('.modal button[type="submit"], .modal button:has-text("Entrar")').first();
  await submitBtn.click();

  await page.waitForTimeout(3000);

  // Check if modal text contains error message or instructions
  const modalContentAfterSubmit = await page.evaluate(() => {
    const modal = document.querySelector('.modal.show, div.modal');
    return modal ? modal.innerText : 'NO MODAL VISIBLE';
  });

  console.log('Modal Content After Submit:', modalContentAfterSubmit.replace(/\n+/g, ' '));

  await browser.close();
}

debugModalResponse().catch(console.error);
