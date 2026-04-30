import puppeteerExtraDefault from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const puppeteer = puppeteerExtraDefault as any;
puppeteer.use(StealthPlugin());

async function waitForNonCloudflare(page: any, maxWait = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const title = await page.title();
      if (!title.includes('Just a moment') && !title.includes('Cloudflare')) {
        return true;
      }
    } catch (_) { /* page may be navigating */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768'
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    
    // Intercept API/XHR calls
    const apiCalls: string[] = [];
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const url = req.url();
      if (url.includes('horsetelex') && !url.includes('.png') && !url.includes('.css') && !url.includes('.woff')) {
        apiCalls.push(`${req.method()} ${url}`);
      }
      req.continue();
    });

    console.log('Navigating...');
    await page.goto('https://www.horsetelex.com/horses/pedigree/2498945/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('Waiting for Cloudflare to pass...');
    const passed = await waitForNonCloudflare(page, 35000);
    console.log('Cloudflare passed:', passed);

    const title = await page.title();
    console.log('Final title:', title);
    
    // Wait a bit more for dynamic content
    await new Promise(r => setTimeout(r, 3000));
    
    const bodyText = await page.evaluate(() => (document.body as any).innerText?.slice(0, 6000));
    console.log('Body:\n', bodyText);
    
    console.log('\nAPI calls intercepted:');
    apiCalls.forEach(c => console.log(' -', c));
    
  } finally {
    await browser.close();
  }
}
main();
