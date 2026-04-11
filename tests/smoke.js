const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

// Minimal static server so Playwright doesn't depend on external http-server process
function startStaticServer(root, port = 5000) {
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.ico': 'image/x-icon'
  };
  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);
    if (!filePath.startsWith(root)) { res.statusCode = 403; res.end('Forbidden'); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.statusCode = 404; res.end('Not found'); return; }
      const ext = path.extname(filePath);
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

(async () => {
  const logs = [];
  const server = await startStaticServer(process.cwd(), 5000);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    logs.push({ type: 'console', level: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    logs.push({ type: 'pageerror', text: err.message });
  });
  page.on('response', r => {
    if (r.status() >= 400) logs.push({ type: 'response', url: r.url(), status: r.status() });
  });

  try {
    console.log('Setting HF proxy and navigating to app...');
    await page.addInitScript(() => { localStorage.setItem('HF_PROXY', 'http://localhost:6010/api/hf'); });
    await page.goto('http://localhost:5000', { waitUntil: 'networkidle' });

    // Journal tab: analyze + save
    console.log('Testing Journal flow...');
    await page.fill('textarea[x-model="logText"]', 'Automated test entry ' + Date.now());
    await page.click('button:has-text("Analyze Mood")');
    // wait a moment for analyze (could fallback)
    await page.waitForTimeout(1000);
    const moodExists = await page.$('[x-text="mood.label"]');
    logs.push({ type: 'check', step: 'moodVisible', ok: !!moodExists });
    await page.click('button:has-text("Save Entry")');
    await page.waitForTimeout(1000);

    // Spark tab: generate + mark done
    console.log('Testing Spark flow...');
    await page.click('button:has-text("Spark")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Generate")');
    await page.waitForSelector('[x-text="challenge.text"]', { timeout: 5000 }).catch(() => {});
    const challengeText = await page.$eval('[x-text="challenge.text"]', el => el.innerText).catch(() => '');
    logs.push({ type: 'check', step: 'challengeText', value: challengeText });

    await page.click('button:has-text("Mark Done")').catch(() => {});
    await page.waitForTimeout(500);

    // Progress tab: chart presence
    console.log('Testing Progress flow...');
    await page.click('button:has-text("Progress")');
    await page.waitForSelector('#streakChart', { timeout: 3000 }).catch(() => {});
    const chartExists = !!(await page.$('#streakChart'));
    logs.push({ type: 'check', step: 'streakChartExists', ok: chartExists });

    // Share tab: export
    console.log('Testing Share flow...');
    await page.click('button:has-text("Share")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Export as Image")').catch(() => {});
    await page.waitForTimeout(1000);

    // Collect final console messages
    console.log('Finishing test...');

  } catch (e) {
    logs.push({ type: 'testError', text: e.message });
  } finally {
    fs.writeFileSync('tests/smoke-console.log', JSON.stringify(logs, null, 2));
    console.log('Logs written to tests/smoke-console.log');
    await browser.close();
    server.close();
  }
})();