/**
 * Build a single-file release artifact + SHA-256 checksum.
 *
 * Usage: npm run build:single
 *
 * Inlines CSS/JS and QR decode workers (cam2qr) as blob Workers so
 * file:// / offline HTML does not depend on sibling asset files.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  readdirSync,
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

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace Vite Worker URL constructors with blob: Workers embedding the file. */
function inlineWorkers(html) {
  const assetsDir = join(tmp, 'assets');
  if (!existsSync(assetsDir)) return html;

  const workers = readdirSync(assetsDir).filter(
    (f) => f.startsWith('worker-') && f.endsWith('.js')
  );
  let out = html;
  let count = 0;

  for (const name of workers) {
    const code = readFileSync(join(assetsDir, name), 'utf8');
    const b64 = Buffer.from(code, 'utf8').toString('base64');
    const blobExpr =
      `URL.createObjectURL(new Blob([Uint8Array.from(atob("${b64}"),c=>c.charCodeAt(0))],{type:"text/javascript"}))`;

    // Vite 8 / Rolldown emitted pattern (cam2qr QR worker):
    // new Worker(new URL(new URL(`worker-….js`,import.meta.url).href,``+import.meta.url),{type:`module`})
    const vitePat = new RegExp(
      String.raw`new Worker\(new URL\(new URL\(\`${escapeRegExp(name)}\`,import\.meta\.url\)\.href,\`\`\+import\.meta\.url\)(?:,(\{[^)]*\}))?\)`,
      'g'
    );
    const before = out;
    out = out.replace(vitePat, (_m, opts) => {
      count += 1;
      return `new Worker(${blobExpr}${opts ? `,${opts}` : ''})`;
    });

    // Fallback: any remaining bare filename string for this worker.
    if (out === before) {
      const bare = new RegExp(
        String.raw`new Worker\(([^)]*${escapeRegExp(name)}[^)]*)\)`,
        'g'
      );
      out = out.replace(bare, () => {
        count += 1;
        return `new Worker(${blobExpr},{type:"module"})`;
      });
    }
  }

  if (workers.length && count === 0) {
    console.warn(
      'warning: found worker assets but could not rewrite Worker() constructors:',
      workers.join(', ')
    );
  } else if (count > 0) {
    console.log(`Inlined ${count} Worker reference(s) from ${workers.length} file(s).`);
  }
  return out;
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

html = inlineWorkers(html);

// Drop service-worker / manifest links — not meaningful for a file:// single HTML.
html = html.replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi, '');
html = html.replace(/<script\b[^>]*\bid=["']vite-plugin-pwa:register-sw["'][^>]*>\s*<\/script>/gi, '');
html = html.replace(/<script\b[^>]*\bsrc=["'][^"']*registerSW\.js["'][^>]*>\s*<\/script>/gi, '');

// Sanity: no leftover external asset refs (except data:/blob:).
const leftover = html.match(/(?:src|href)=["'](?!data:|blob:|#)[^"']+\.(?:js|css|woff2?)["']/gi) ?? [];
if (leftover.length) {
  console.warn('warning: external asset refs still present:', leftover.slice(0, 8));
}
if (/worker-[A-Za-z0-9_-]+\.js/.test(html)) {
  console.warn('warning: worker-*.js filename still referenced in HTML');
}

mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'tazia-single.html');
const buf = Buffer.from(html, 'utf8');
writeFileSync(outFile, buf);
const digest = sha256Hex(buf);
writeFileSync(join(outDir, 'tazia-single.html.sha256'), `${digest}  tazia-single.html\n`);
writeFileSync(
  join(outDir, 'MANIFEST.txt'),
  [
    `tazia-single.html  sha256:${digest}`,
    `built: ${new Date().toISOString()}`,
    `notes: no PWA SW; QR worker inlined as blob; scrub-phrase inlined`,
    '',
  ].join('\n')
);

rmSync(tmp, { recursive: true, force: true });

console.log(`Wrote ${outFile}`);
console.log(`SHA-256: ${digest}`);
