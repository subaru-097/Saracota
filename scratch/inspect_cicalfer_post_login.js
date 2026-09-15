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

async function inspectCicalferPostLogin() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');
  const supplier = data[0];
  const loginUser = supplier.login_salvo;
  const loginPass = decryptAES256(supplier.senha_login || supplier.senha_criptografada);

  console.log('Inspecting Cicalfer Post-Login Flow:');
  console.log(`URL: ${supplier.url_site}`);
  console.log(`User: ${loginUser}`);
  console.log(`Pass: ${loginPass}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(supplier.url_site, { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // Accept Cookies
  const acceptCookie = page.locator('button:has-text("Aceitar")').first();
  if (await acceptCookie.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptCookie.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Click Login Trigger
  console.log('1. Opening Login Modal...');
  const loginTrigger = page.locator('button#botao-login').first();
  await loginTrigger.click({ force: true });
  await page.waitForTimeout(2000);

  // Fill credentials
  console.log('2. Filling credentials...');
  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(loginPass);

  // Submit form
  console.log('3. Submitting login form...');
  const submitBtn = page.locator('.modal button[type="submit"], button[type="submit"]').first();
  await submitBtn.click({ force: true });

  await page.waitForTimeout(4000);
  console.log(`URL immediately after submit: ${page.url()}`);

  // Check modals or dialogs after login
  const modalsAfterLogin = await page.locator('.modal.show, [role="dialog"]').count();
  console.log(`Modals visible after login submit: ${modalsAfterLogin}`);

  for (let i = 0; i < modalsAfterLogin; i++) {
    const modalEl = page.locator('.modal.show, [role="dialog"]').nth(i);
    const text = await modalEl.evaluate(el => el.innerText).catch(() => '');
    console.log(`Modal #${i} text:`, text.replace(/\n+/g, ' '));
  }

  // Check header text & login state indicators
  const headerText = await page.evaluate(() => {
    const h = document.querySelector('header');
    return h ? h.innerText.replace(/\n+/g, ' ') : '';
  });
  console.log('Header Text Post-Login:', headerText);

  // Search product: CABO FLEX 100M COBRECOM 2,50MM
  console.log('\n4. Searching product: CABO FLEX 100M COBRECOM 2,50MM...');
  const searchInput = page.locator('input[name="search"]').first();
  await searchInput.fill('CABO FLEX 100M COBRECOM 2,50MM');
  await page.locator('button#botao-busca-produtos').first().click();

  await page.waitForTimeout(4000);
  console.log(`Search Results URL: ${page.url()}`);

  // Inspect first product card for price or "FAÇA LOGIN"
  const productCardsInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.card, .produto-item, [data-inspector-kind], div.row > div'));
    return cards.slice(0, 5).map(c => ({
      text: c.innerText ? c.innerText.replace(/\n+/g, ' | ').slice(0, 150) : ''
    })).filter(c => c.text.length > 10);
  });
  console.log('Sample Product Cards on Search Page:', JSON.stringify(productCardsInfo, null, 2));

  await browser.close();
}

inspectCicalferPostLogin().catch(console.error);
