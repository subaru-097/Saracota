import { chromium } from 'playwright';

async function verifyCSS() {
  console.log('Starting browser to test CSS rendering on http://localhost:3000 ...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];
  const cssRequests: { url: string; status: number; contentType: string }[] = [];

  page.on('console', msg => {
    consoleLogs.push(`[Console ${msg.type()}] ${msg.text()}`);
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';

    if (url.includes('.css') || contentType.includes('text/css')) {
      cssRequests.push({ url, status, contentType });
    }

    if (status >= 400) {
      networkErrors.push(`[Network ${status}] ${url}`);
    }
  });

  try {
    const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`Page load status: ${response?.status()}`);

    // Wait 2 seconds for layout stabilization
    await page.waitForTimeout(2000);

    // Inspect computed styles of body and main wrapper
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const comp = window.getComputedStyle(body);
      return {
        backgroundColor: comp.backgroundColor,
        color: comp.color,
        fontFamily: comp.fontFamily,
      };
    });

    const isTailwindActive = await page.evaluate(() => {
      // Check if tailwind classes or variables exist
      const body = document.body;
      const computed = window.getComputedStyle(body);
      // Sara design system sets body bg to rgb(10, 12, 14) or dark hex #0a0c0e
      return {
        bg: computed.backgroundColor,
        color: computed.color,
        classList: Array.from(document.documentElement.classList),
      };
    });

    console.log('\n--- COMPUTED STYLES VERIFICATION ---');
    console.log('Body styles:', JSON.stringify(bodyStyles, null, 2));
    console.log('Tailwind state:', JSON.stringify(isTailwindActive, null, 2));

    console.log('\n--- CSS NETWORK REQUESTS ---');
    if (cssRequests.length === 0) {
      console.log('No external .css requests logged (in Next.js App Router dev mode, CSS can be injected via style tags or _next/static/css). Checking style tags count:');
      const styleTagsCount = await page.evaluate(() => document.querySelectorAll('style, link[rel="stylesheet"]').length);
      console.log('Style/Link tags count on page:', styleTagsCount);
    } else {
      cssRequests.forEach(req => {
        console.log(`URL: ${req.url} | Status: ${req.status} | Content-Type: ${req.contentType}`);
      });
    }

    console.log('\n--- NETWORK ERRORS (>= 400) ---');
    if (networkErrors.length === 0) {
      console.log('SUCCESS: Zero 404 or network errors found!');
    } else {
      networkErrors.forEach(err => console.log(err));
    }

    console.log('\n--- BROWSER CONSOLE LOGS ---');
    if (consoleLogs.length === 0) {
      console.log('SUCCESS: Clean console! No warnings or MIME type errors.');
    } else {
      consoleLogs.forEach(log => console.log(log));
    }

    // Capture screenshot for visual confirmation
    await page.screenshot({ path: 'scratch/css_fix_verification.png', fullPage: true });
    console.log('\nScreenshot saved to scratch/css_fix_verification.png');

  } catch (err: any) {
    console.error('Error loading page:', err.message);
  } finally {
    await browser.close();
  }
}

verifyCSS();
