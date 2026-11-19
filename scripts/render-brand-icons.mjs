/**
 * Rasterize public/brand/tazia-mark.svg onto a black plate for
 * favicon / Apple / PWA / Open Graph (platforms that still need PNG).
 *
 * Source of truth for the mark: public/brand/tazia-mark.svg (+ in-app TaziaMark).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markPath = join(root, 'public', 'brand', 'tazia-mark.svg');
const markSvg = readFileSync(markPath, 'utf8');

/** Transparent mark → black-plate SVG string (same viewBox). */
function plateSvg(source) {
  const injected = source.replace(
    /(<svg\b[^>]*>)/i,
    '$1\n  <rect width="100%" height="100%" fill="#000000"/>',
  );
  if (injected === source) {
    throw new Error('Could not inject plate into mark SVG');
  }
  return injected;
}

const plated = plateSvg(markSvg);

function renderPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'transparent',
  });
  return resvg.render().asPng();
}

function write(rel, data) {
  const abs = join(root, 'public', rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
  console.log(`wrote public/${rel} (${data.length} bytes)`);
}

write('favicon.svg', plated);

const targets = [
  ['favicon.png', 32],
  ['apple-touch-icon.png', 180],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
];

for (const [rel, size] of targets) {
  write(rel, renderPng(plated, size));
}

console.log('brand icons rendered from tazia-mark.svg');
