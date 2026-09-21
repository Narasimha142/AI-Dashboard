// Builds one self-contained file you can open by double-clicking, email, or host anywhere.
// Run: node scripts/build.mjs   ->   dist/ai-line.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const lines = JSON.parse(read('content/lines.json'));
const order = JSON.parse(read('content/order.json'));
const stops = order.map((id) => JSON.parse(read(`content/stops/${id}.json`)));
const data = JSON.stringify({ lines, order, stops }).replace(/</g, '\\u003c');

let html = read('index.html');
const css = read('css/style.css');
const js = read('js/app.js');

html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}</style>`);
html = html.replace('<script src="js/app.js"></script>', () => `<script>window.AILINE_DATA=${data};</script>\n<script>\n${js}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'ai-line.html');
fs.writeFileSync(out, html);
console.log(`Built ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, ${stops.length} stops)`);
