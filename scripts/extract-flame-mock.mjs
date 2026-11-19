import fs from 'node:fs';

const html = fs.readFileSync(
  new URL('../../ai_studio_code(6).html', import.meta.url),
  'utf8'
);
const start = html.indexOf('<script>');
const end = html.indexOf('</script>', start);
if (start < 0 || end < 0) {
  console.error('script not found');
  process.exit(1);
}
const body = html.slice(start + '<script>'.length, end);
const out = new URL('../src/core/avatar/_mock_script.js', import.meta.url);
fs.mkdirSync(new URL('.', out), { recursive: true });
fs.writeFileSync(out, body);
console.log('wrote', out.pathname, body.length);