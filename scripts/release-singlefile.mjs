/**
 * Build a single-file release artifact + SHA-256 checksum.
 *
 * Usage: npm run build:single
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = join(root, 'release-tmp');
const outDir = join(root, 'release');

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function resolveAsset(src) {
  const cleaned = src.replace(/^\.\//, '').replace(/^\//, '');
  const candidates = [join(tmp, cleaned), join(tmp, cleaned.replace(/^tazia\//, ''))];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

console.log('Building single-bundle (vite.single.config.ts)…');
execSync('npx vite build --config vite.single.config.ts', { cwd: root, stdio: 'inherit' });

let html = readFileSync(join(tmp, 'index.html'), 'utf8');

// Inline scripts require unsafe-inline; single-file is meant for local/offline verify-by-hash.
html = html.replace(
  /script-src 'self'/g,
  "script-src 'self' 'unsafe-inline'"
);

html = html.replace(
  /<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi,
  ''
);

html = html.replace(
  /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
  (full, pre, src, post) => {
    if (/^https?:/i.test(src) || src.startsWith('//')) return full;
    const file = resolveAsset(src);
    if (!file) {
      console.warn('skip missing script', src);
      return full;
    }
    const js = readFileSync(file, 'utf8');
    const attrs = `${pre}${post}`.replace(/\bsrc=["'][^"']+["']/, '').replace(/\s+/g, ' ').trim();
    return `<script${attrs ? ` ${attrs}` : ''}>\n${js}\n</script>`;
  }
);

html = html.replace(
  /<link\b([^>]*)\brel=["']stylesheet["']([^>]*)\/?>/gi,
  (full) => {
    const hrefMatch = full.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) return full;
    const href = hrefMatch[1];
    if (/^https?:/i.test(href) || href.startsWith('//')) return full;
    const file = resolveAsset(href);
    if (!file) {
      console.warn('skip missing css', href);
      return full;
    }
    const css = readFileSync(file, 'utf8');
    return `<style>\n${css}\n</style>`;
  }
);

// Drop service-worker / manifest links — not meaningful for a file:// single HTML.
html = html.replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi, '');
html = html.replace(/<script\b[^>]*\bid=["']vite-plugin-pwa:register-sw["'][^>]*>\s*<\/script>/gi, '');

mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'tazia-single.html');
const buf = Buffer.from(html, 'utf8');
writeFileSync(outFile, buf);
const digest = sha256Hex(buf);
writeFileSync(join(outDir, 'tazia-single.html.sha256'), `${digest}  tazia-single.html\n`);
writeFileSync(
  join(outDir, 'MANIFEST.txt'),
  [`tazia-single.html  sha256:${digest}`, `built: ${new Date().toISOString()}`, ''].join('\n')
);

rmSync(tmp, { recursive: true, force: true });

console.log(`Wrote ${outFile}`);
console.log(`SHA-256: ${digest}`);
