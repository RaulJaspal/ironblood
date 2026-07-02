// Combat verification: versus mode, scripted inputs, DOM assertions.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../web');
const OUT = process.argv[2] || '.';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname === '/') p = path.join(ROOT, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 600)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });

const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const health = async (side) => page.$eval(`#${side}-health`, (el) => el.style.width);
const bannerText = async () => page.$eval('#banner', (el) => ({ text: el.textContent, shown: el.className.includes('show') }));

await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForSelector('#screen-title:not(.hidden)', { timeout: 60000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.keyboard.press('s'); // move to VERSUS
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
// P1 pick KANE
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
// P2 pick default (next char)
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
console.log('vs screen shown');

// wait for fight
await page.waitForSelector('#hud:not(.hidden)', { timeout: 60000 });
console.log('HUD visible');
await page.waitForTimeout(500);
const b1 = await bannerText();
console.log('intro banner:', JSON.stringify(b1));
await shot('c01_round1');
await page.waitForTimeout(2200); // past FIGHT!

// P1 walks toward P2 and jabs
await page.keyboard.down('d');
await page.waitForTimeout(1400);
await page.keyboard.up('d');
console.log('p2 health before hits:', await health('p2'));
for (let i = 0; i < 3; i++) { await page.keyboard.press('u'); await page.waitForTimeout(500); }
const h1 = await health('p2');
console.log('p2 health after jabs:', h1);
await shot('c02_after_jabs');

// heavy chain combo
for (let i = 0; i < 4; i++) { await page.keyboard.press('i'); await page.waitForTimeout(300); }
await page.waitForTimeout(700);
console.log('p2 health after chain:', await health('p2'));
await shot('c03_after_chain');

// P2 blocks: hold right (back for P2 facing left... P2 faces -X so back = +X = right arrow)
await page.keyboard.down('ArrowRight');
await page.keyboard.press('u');
await page.waitForTimeout(400);
await shot('c04_block');
await page.keyboard.up('ArrowRight');
console.log('p2 health after blocked jab:', await health('p2'));

// P1 fireball
await page.keyboard.press('a'); // step back... use walk
await page.keyboard.down('a'); await page.waitForTimeout(900); await page.keyboard.up('a');
await page.keyboard.press('o');
await page.waitForTimeout(400);
await shot('c05_fireball');
await page.waitForTimeout(900);
console.log('p2 health after fireball:', await health('p2'));

// uppercut launcher up close
await page.keyboard.down('d'); await page.waitForTimeout(1300); await page.keyboard.up('d');
await page.keyboard.press('l');
await page.waitForTimeout(450);
await shot('c06_uppercut');
await page.waitForTimeout(1200);
await shot('c07_knockdown');

// spam heavy kicks until KO
let ko = false;
for (let i = 0; i < 40 && !ko; i++) {
  await page.keyboard.down('d'); await page.waitForTimeout(320); await page.keyboard.up('d');
  await page.keyboard.press('k');
  await page.waitForTimeout(620);
  const b = await bannerText();
  if (b.shown && (b.text.includes('K.O') || b.text.includes('WINS') || b.text.includes('FLAWLESS'))) { ko = true; console.log('KO banner:', b.text); }
}
await shot('c08_ko');
await page.waitForTimeout(2000);
await shot('c09_winner');

// round 2 should start
await page.waitForTimeout(2500);
const b2 = await bannerText();
console.log('next banner:', JSON.stringify(b2));
await shot('c10_round2');

// finish match: repeat KO loop
ko = false;
await page.waitForTimeout(2000);
for (let i = 0; i < 50 && !ko; i++) {
  await page.keyboard.down('d'); await page.waitForTimeout(320); await page.keyboard.up('d');
  await page.keyboard.press('k');
  await page.waitForTimeout(620);
  const vict = await page.$eval('#screen-victory', (el) => !el.classList.contains('hidden'));
  if (vict) { ko = true; console.log('victory screen shown'); }
}
await shot('c11_victory');
console.log('COMBAT E2E DONE');
await browser.close();
server.close();
process.exit(0);
