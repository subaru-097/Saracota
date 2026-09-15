const { chromium } = require('playwright');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const supabase = require('../config/supabase');
const quoteEngine = require('../core/services/supplier-quote-engine');
const cicalferConfig = require('../config/suppliers/cicalfer.json');

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
  } catch (error) { return ''; }
}

async function inspectCartDom() {
  const { data } = await supabase.from('fornecedores').select('*').ilike('nome', '%cicalfer%');
  const supplier = data[0];
  const decryptedPass = decryptAES256(supplier.senha_login || supplier.senha_criptografada);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await quoteEngine.realizarLogin(page, cicalferConfig, { user: supplier.login_salvo, pass: decryptedPass });
  await page.goto(cicalferConfig.selectors.cart_url, { waitUntil: 'networkidle' });

  const inspection = await page.evaluate(() => {
    const itemCards = Array.from(document.querySelectorAll('[class*="itemContainer"], [class*="ProdutoCompactCarrinho"]'));
    return itemCards.map(card => ({
      className: card.className,
      outerHTML: card.outerHTML,
      inputs: Array.from(card.querySelectorAll('input')).map(i => ({ tagName: i.tagName, type: i.type, className: i.className, value: i.value, outerHTML: i.outerHTML })),
      allElements: Array.from(card.querySelectorAll('*')).map(e => ({ tagName: e.tagName, className: e.className, id: e.id, text: e.innerText }))
    }));
  });

  console.log('=== CARDS ENCONTRADOS:', inspection.length);
  console.log(JSON.stringify(inspection, null, 2));

  await browser.close();
}

inspectCartDom().catch(console.error);
