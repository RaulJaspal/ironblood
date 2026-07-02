// Drive the full game flow headlessly and capture screenshots.
// Usage: node tools/e2e.js <outdir>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../web');
const OUT = process.argv[2] || '.';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname === '/') p = path.join(ROOT, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); console.log('404', u.pathname); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 600)));

const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.png') });

await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForTimeout(2500);
await shot('01_loading');

// wait for title (boot finishes)
try {
  await page.waitForSelector('#screen-title:not(.hidden)', { timeout: 60000 });
} catch { console.log('TITLE NEVER SHOWED'); await shot('01b_stuck'); process.exit(1); }
await page.waitForTimeout(1500);
await shot('02_title');

await page.keyboard.press('Enter'); // open menu
await page.waitForTimeout(400);
await shot('03_title_menu');

await page.keyboard.press('Enter'); // arcade
await page.waitForTimeout(800);
await shot('04_select');

await page.keyboard.press('d'); // move pick
await page.waitForTimeout(600);
await shot('05_select_moved');

await page.keyboard.press('Enter'); // confirm -> VS screen
await page.waitForTimeout(1000);
await shot('06_vs');

// wait for fight to load (vs screen auto-advances after 2.4s + stage build)
await page.waitForTimeout(6000);
await shot('07_fight_intro');

await page.waitForTimeout(2500);
await shot('08_fight_live');

// throw some attacks
for (const k of ['u', 'u', 'i', 'k']) {
  await page.keyboard.press(k);
  await page.waitForTimeout(450);
}
await shot('09_fight_attacks');

// walk forward & special
await page.keyboard.down('d');
await page.waitForTimeout(900);
await page.keyboard.up('d');
await page.keyboard.press('o'); // fireball
await page.waitForTimeout(500);
await shot('10_fireball');
await page.waitForTimeout(1200);
await shot('11_after');

// pause menu
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await shot('12_pause');

await browser.close();
server.close();
console.log('E2E DONE');
process.exit(0);
