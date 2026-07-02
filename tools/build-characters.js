// Build final per-character GLBs: sanitized bone names + embedded web textures.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { sanitizeName } from './lib/skeleton.js';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '../web/assets/characters');
const PORTRAITS = path.join(ROOT, '../web/assets/portraits');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PORTRAITS, { recursive: true });

const CHARS = ['brawler', 'heroine', 'soldier_m', 'soldier_f', 'agent', 'bruiser', 'enforcer', 'street'];

const ROUGHNESS = { head: 0.55, body: 0.72, opacity: 0.8, helmet: 0.5, equipment: 0.65 };

function findTex(dir, prefix, part, kind) {
  const files = fs.readdirSync(dir);
  // e.g. sm024_body_color_acu.jpg or m021_body_color.jpg
  const re = new RegExp(`^${prefix}_${part}_${kind}.*\\.(jpg|png)$`);
  const hit = files.find((f) => re.test(f));
  return hit ? path.join(dir, hit) : null;
}

const io = new NodeIO();

for (const char of CHARS) {
  const dir = path.join(ROOT, 'src/chars', char);
  const doc = await io.read(path.join(dir, `${char}_raw.glb`));
  const texDir = path.join(dir, 'tex');

  for (const node of doc.getRoot().listNodes()) node.setName(sanitizeName(node.getName()));
  doc.getRoot().listSkins().forEach((s, i) => s.setName(`skin${i}`));

  for (const mat of doc.getRoot().listMaterials()) {
    const name = mat.getName(); // e.g. m021_head, sf003_equipment, m006_opacity
    const m = name.match(/^([a-z]+\d+)_(\w+)$/);
    if (!m) { console.warn(char, 'unmatched material', name); continue; }
    const [, prefix, part] = m;

    mat.setMetallicFactor(0);
    mat.setRoughnessFactor(ROUGHNESS[part] ?? 0.7);
    mat.setBaseColorFactor([1, 1, 1, 1]);
    mat.setDoubleSided(false);

    const colorPath = findTex(texDir, prefix, part, 'color');
    if (colorPath) {
      const tex = doc.createTexture(`${name}_color`)
        .setImage(fs.readFileSync(colorPath))
        .setMimeType(colorPath.endsWith('.png') ? 'image/png' : 'image/jpeg');
      mat.setBaseColorTexture(tex);
    } else {
      console.warn(char, 'no color texture for', name);
    }

    const normalPath = findTex(texDir, prefix, part, 'normal');
    if (normalPath) {
      const tex = doc.createTexture(`${name}_normal`)
        .setImage(fs.readFileSync(normalPath))
        .setMimeType('image/jpeg');
      mat.setNormalTexture(tex);
      mat.setNormalScale(0.8);
    }

    if (part === 'opacity') {
      mat.setAlphaMode('BLEND');
      mat.setDoubleSided(true);
    }
  }

  await doc.transform(dedup(), prune());
  const outPath = path.join(OUT, `${char}.glb`);
  await io.write(outPath, doc);
  fs.copyFileSync(path.join(dir, 'preview.png'), path.join(PORTRAITS, `${char}.png`));
  console.log('wrote', outPath, (fs.statSync(outPath).size / 1e6).toFixed(2) + 'MB');
}
