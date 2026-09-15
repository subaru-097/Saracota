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

async function testFilialDisambiguationAndReload() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');
  const supplier = data[0];
  const loginUser = supplier.login_salvo;
  const loginPass = decryptAES256(supplier.senha_login || supplier.senha_criptografada);

  console.log('Testing Cicalfer Filial Disambiguation and Reload Rehydration:');

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

  // Open Login Modal
  await page.locator('button#botao-login').first().click({ force: true });
  await page.waitForTimeout(2000);

  // Fill & Submit Login
  await page.locator('input[name="email"].form-control, input[name="email"]').first().fill(loginUser);
  await page.locator('input#senha[name="senha"], input[type="password"]').first().fill(loginPass);
  await page.locator('button#btn-entrar, .modal button[type="submit"]').first().click({ force: true });

  await page.waitForTimeout(3000);

  // Inspect Filial Option Cards
  console.log('\nInspecting Filial Option Cards inside Modal...');
  const cardCount = await page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').count();
  console.log(`Found ${cardCount} filial option cards.`);

  let entregaCardIndex = -1;
  for (let i = 0; i < cardCount; i++) {
    const cardLoc = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').nth(i);
    const cardText = await cardLoc.evaluate(el => el.innerText.replace(/\n+/g, ' ')).catch(() => '');
    const className = await cardLoc.evaluate(el => el.className).catch(() => '');
    console.log(`Card #${i}: [Class: ${className}] | Text: "${cardText}"`);

    if (cardText.includes('ENTREGA') && !cardText.includes('RETIRA')) {
      entregaCardIndex = i;
      console.log(` -> Card #${i} IS THE ENTREGA CARD!`);
    }
  }

  if (entregaCardIndex !== -1) {
    const entregaCard = page.locator('button.ModalClienteFilial_optionCard__vj1Sf, #select-filial').nth(entregaCardIndex);
    console.log(`\nClicking ONLY the ENTREGA Card (index ${entregaCardIndex})...`);
    await entregaCard.click({ force: true });
    await page.waitForTimeout(1500);

    // Verify visual highlight of ENTREGA card
    const cardClassAfterClick = await entregaCard.evaluate(el => el.className).catch(() => '');
    console.log(`ENTREGA Card class after click: "${cardClassAfterClick}"`);

    // Click Confirm button
    console.log('Clicking "Confirmar seleção"...');
    const confirmBtn = page.locator('button:has-text("Confirmar seleção"), span:has-text("Confirmar seleção")').first();
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // CRITICAL: Reload page to rehydrate session
    console.log('\nCRITICAL: Reloading page to rehydrate B2B session cookies...');
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(4000);

    // Search product and check price visibility
    console.log('\nSearching CABO FLEX 100M COBRECOM 2,50MM after reload...');
    const searchInput = page.locator('input[name="search"]').first();
    await searchInput.fill('CABO FLEX 100M COBRECOM 2,50MM');
    await page.locator('button#botao-busca-produtos').first().click();

    await page.waitForTimeout(4000);
    console.log(`Search URL: ${page.url()}`);

    const searchPageText = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n+/g, ' ') : '');
    const hasLoginPrompt = searchPageText.includes('FAÇA LOGIN OU CADASTRE-SE PARA VISUALIZAR OS PREÇOS');
    const pricesFound = searchPageText.match(/R\$\s*\d+[\.,]\d{2}/g);

    console.log(` -> Contains "FAÇA LOGIN..." prompt?: ${hasLoginPrompt}`);
    console.log(` -> Prices found on screen:`, pricesFound ? pricesFound.slice(0, 5) : 'NONE');
  } else {
    console.error('ERROR: ENTREGA card not found in filial modal!');
  }

  await browser.close();
}

testFilialDisambiguationAndReload().catch(console.error);
