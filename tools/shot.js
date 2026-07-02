// Headless screenshot harness.
// Usage: node tools/shot.js "dev/pose-test.html?char=brawler&clip=guard&t=0.4" out.png [more pairs...]
// Starts a static server on web/ and captures pages.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../web');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.hdr': 'application/octet-stream', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname.endsWith('/')) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope: ' + u.pathname); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const args = process.argv.slice(2);
const pairs = [];
for (let i = 0; i < args.length; i += 2) pairs.push([args[i], args[i + 1]]);

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 500)));

for (const [rel, out] of pairs) {
  await page.goto(`http://localhost:${port}/${rel}`);
  try {
    await page.waitForFunction('window.__ready === true', { timeout: 30000 });
  } catch {
    console.log('TIMEOUT waiting ready for', rel);
  }
  const info = await page.evaluate('window.__info || null');
  if (info && info.error) console.log('[info.error]', info.error);
  await page.screenshot({ path: out });
  console.log('shot', out);
}
await browser.close();
server.close();
process.exit(0);
