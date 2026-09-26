import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];
  const cssRequests: string[] = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE_ERROR] ${err.message}`));
  page.on('requestfailed', req => networkErrors.push(`[FAILED] ${req.url()} - ${req.failure()?.errorText}`));
  page.on('response', res => {
    if (res.url().includes('.css') || res.headers()['content-type']?.includes('css')) {
      cssRequests.push(`[CSS ${res.status()}] ${res.url()} (${res.headers()['content-type']})`);
    }
  });

  console.log('Navigating to http://localhost:3000/cotacoes...');
  await page.goto('http://localhost:3000/cotacoes', { waitUntil: 'networkidle' });

  // Take screenshot of rendered page
  await page.screenshot({ path: 'scratch/page_style_check.png', fullPage: true });

  // Check computed background color and font family of body
  const bodyStyles = await page.evaluate(() => {
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const font = window.getComputedStyle(document.body).fontFamily;
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => (l as HTMLLinkElement).href);
    const styleTags = Array.from(document.querySelectorAll('style')).length;
    return { bg, font, links, styleTags };
  });

  console.log('\n=== BODY COMPUTED STYLES ===');
  console.log('Body Background Color:', bodyStyles.bg);
  console.log('Body Font Family:', bodyStyles.font);
  console.log('Stylesheet Links:', bodyStyles.links);
  console.log('Inline Style Tags Count:', bodyStyles.styleTags);

  console.log('\n=== CSS NETWORK RESPONSES ===');
  console.log(cssRequests.length > 0 ? cssRequests : 'No CSS network requests found!');

  console.log('\n=== NETWORK ERRORS ===');
  console.log(networkErrors.length > 0 ? networkErrors : 'No network errors.');

  console.log('\n=== CONSOLE LOGS ===');
  console.log(consoleLogs.length > 0 ? consoleLogs : 'No console logs.');

  await browser.close();
}

main().catch(console.error);
