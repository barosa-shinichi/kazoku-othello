// Optional browser checks: npm install --no-save playwright jszip
// Or point FAMILY_TEST_DEPENDENCIES at an existing node_modules directory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dependency = name => require(process.env.FAMILY_TEST_DEPENDENCIES ? path.join(process.env.FAMILY_TEST_DEPENDENCIES, name) : name);
const { chromium } = dependency('playwright');
const JSZip = dependency('jszip');

test('APK assets run offline, use real AI workers, and restore a saved game', async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, 'releases/kazoku-othello-1.0.0.apk')));
  const assets = new Map();
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir && name.startsWith('assets/www/')) assets.set(name.slice(11), await file.async('nodebuffer'));
  }
  assert.ok(assets.has('ai-worker.js') && assets.has('game-store.js'));
  assert.equal(assets.get('style.css').toString().includes('@import'), false);
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 851 }, reducedMotion: 'reduce' });
    const requests = [], errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      requests.push(url.href);
      const file = url.pathname.slice('/assets/'.length);
      if (url.host !== 'appassets.androidplatform.net' || !assets.has(file)) return route.abort();
      const contentType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/html';
      await route.fulfill({ status: 200, contentType, body: assets.get(file) });
    });
    await context.setOffline(true);
    let page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://appassets.androidplatform.net/assets/index.html');
    await page.selectOption('#mode', 'local');
    await page.getByRole('button', { name: '黒の顔をねこにする', exact: true }).click();
    await page.locator('.cell.legal').first().click();
    await page.waitForFunction(() => !attacking);
    const saved = await page.evaluate(() => ({ board, turn, moveNumber, lastMove, history, players, mode }));
    await page.close();
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://appassets.androidplatform.net/assets/index.html');
    assert.deepEqual(await page.evaluate(() => ({ board, turn, moveNumber, lastMove, history, players, mode })), saved);
    await page.locator('#undo').click();
    assert.equal(await page.evaluate(() => moveNumber), 0);
    await page.locator('#ai-help').click();
    await page.waitForFunction(() => moveNumber === 1 && !attacking);
    assert.ok(requests.some(url => url.endsWith('/ai-worker.js')));
    assert.equal(await page.evaluate(() => notice.includes('起動できません')), false);
    assert.equal(await page.locator('#ai-help-player').textContent(), 'ぱんだをお助け');
    await page.selectOption('#mode', 'cpu');
    await page.waitForFunction(() => moveNumber === 2 && !attacking);
    await page.reload();
    assert.equal(await page.evaluate(() => moveNumber), 2);
    assert.equal(await page.locator('#mode').inputValue(), 'cpu');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, 'releases/android-preview.png'), fullPage: true });
    assert.ok(requests.every(url => url.startsWith('https://appassets.androidplatform.net/assets/')));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('desktop web app is still available and can resume games', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#mode', 'local');
    await page.locator('.cell.legal').first().click();
    await page.waitForFunction(() => !attacking);
    const before = await page.evaluate(() => board);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.deepEqual(await page.evaluate(() => board), before);
    assert.equal(await page.locator('#ai-help').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
