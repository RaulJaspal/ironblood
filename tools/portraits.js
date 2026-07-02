// Render in-engine portraits for all fighters (bust for HUD/select, full for VS).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../web');
const OUT = path.join(ROOT, 'assets/portraits');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };

const ROSTER = [
  ['brawler', 'ff5533', 'male'], ['street', '33bbff', 'male'], ['soldier_m', '77aa44', 'male'],
  ['soldier_f', 'aaccdd', 'female'], ['heroine', 'ffcc44', 'female'], ['agent', '99aabb', 'male'],
  ['bruiser', 'ff9922', 'male'], ['enforcer', '8877ff', 'male'],
];

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = path.join(ROOT, decodeURIComponent(u.pathname));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });

for (const [id, accent, gender] of ROSTER) {
  for (const mode of ['bust', 'full']) {
    const page = await browser.newPage({ viewport: { width: mode === 'bust' ? 512 : 560, height: mode === 'bust' ? 512 : 900 } });
    await page.goto(`http://localhost:${port}/dev/portrait.html?char=${id}&accent=${accent}&gender=${gender}&mode=${mode}`);
    await page.waitForFunction('window.__ready === true', { timeout: 30000 });
    const suffix = mode === 'bust' ? '' : '_full';
    await page.locator('canvas').screenshot({ path: path.join(OUT, `${id}${suffix}.png`) });
    await page.close();
    console.log('portrait', id, mode);
  }
}
await browser.close();
server.close();
process.exit(0);
