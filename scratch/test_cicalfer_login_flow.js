const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const VAULT_SECRET = process.env.ENCRYPTION_KEY || process.env.VAULT_SECRET || 'saracota_vault_master_key_aes256_32bytes_secret';
function getDerivedKey() {
  return crypto.createHash('sha256').update(VAULT_SECRET).digest();
}

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

async function testCicalferFlow() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');
  const supplier = data[0];
  const loginUser = supplier.login_salvo;
  const loginPass = decryptAES256(supplier.senha_login || supplier.senha_criptografada);

  console.log('Testing Cicalfer Login Flow with real DB credentials:');
  console.log(`URL: ${supplier.url_site}`);
  console.log(`User: ${loginUser}`);
  console.log(`Password Decrypted: ${loginPass}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(supplier.url_site, { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // Close Cookie Banner if present
  console.log('Checking for Cookie Banner...');
  const acceptCookieSelectors = [
    'button:has-text("Aceitar")',
    'button:has-text("Concordar")',
    'button:has-text("Entendi")',
    'button:has-text("Permitir todos")',
    '.modal button.btn-primary'
  ];

  for (const sel of acceptCookieSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`Dismissing Cookie Banner using: "${sel}"`);
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        break;
      }
    } catch (e) {}
  }

  // Click login trigger: button#botao-login
  console.log('Clicking button#botao-login...');
  const loginBtn = page.locator('button#botao-login, text=Entrar | Cadastrar').first();
  await loginBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Check login modal fields
  console.log('Filling Email: input[name="email"].form-control...');
  const emailInput = page.locator('input[name="email"].form-control, input[name="email"]').first();
  await emailInput.fill(loginUser);

  console.log('Filling Password: input#senha[name="senha"]...');
  const passInput = page.locator('input#senha[name="senha"], input[type="password"]').first();
  await passInput.fill(loginPass);

  // Check submit button inside modal
  const modalSubmitSelectors = [
    '.modal button[type="submit"]',
    '.modal div.btn:has-text("Entrar")',
    '.modal button:has-text("Entrar")',
    'button:has-text("Entrar")',
    'input[type="submit"]'
  ];

  let submitClicked = false;
  for (const sSel of modalSubmitSelectors) {
    try {
      const sBtn = page.locator(sSel).first();
      if (await sBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`Clicking modal submit button using: "${sSel}"`);
        await sBtn.click();
        submitClicked = true;
        break;
      }
    } catch (e) {}
  }

  if (!submitClicked) {
    console.log('Fallback: pressing Enter on password field...');
    await passInput.press('Enter');
  }

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log(`Final URL: ${page.url()}`);
  const text = await page.evaluate(() => document.body ? document.body.innerText : '');
  console.log('Page Text Preview:', text.replace(/\n+/g, ' ').slice(0, 200));

  await browser.close();
}

testCicalferFlow().catch(console.error);
