// Checks every lesson file before it is merged. Run: node scripts/validate.mjs
// No dependencies. Exits with code 1 if anything is wrong.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = [];
const warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const need = (where, obj, key) => {
  if (!obj || !isStr(obj[key])) err(where, `"${key}" must be a non-empty string`);
};

let lines, order;
try { lines = read('content/lines.json'); } catch (e) { err('content/lines.json', e.message); lines = []; }
try { order = read('content/order.json'); } catch (e) { err('content/order.json', e.message); order = []; }

if (!Array.isArray(lines) || lines.length === 0) err('content/lines.json', 'must be a non-empty array');
lines.forEach((l, i) => { need(`lines[${i}]`, l, 'name'); need(`lines[${i}]`, l, 'rank'); });
if (lines.length > 7) warn('content/lines.json', 'more than 7 lines: colors repeat after the seventh');

const dir = path.join(root, 'content', 'stops');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const ids = files.map((f) => f.replace(/\.json$/, ''));

const seen = new Set();
order.forEach((id) => {
  if (seen.has(id)) err('content/order.json', `duplicate id "${id}"`);
  seen.add(id);
  if (!ids.includes(id)) err('content/order.json', `"${id}" has no file in content/stops/`);
});
ids.forEach((id) => { if (!seen.has(id)) err(`content/stops/${id}.json`, 'not listed in content/order.json'); });

let lastLine = 0;
const stopData = {};
for (const id of order) {
  const file = `content/stops/${id}.json`;
  let s;
  try { s = read(file); } catch (e) { err(file, e.message); continue; }
  stopData[id] = s;
  if (s.id !== id) err(file, `"id" is "${s.id}" but the file name is "${id}"`);
  if (!/^[a-z][a-z0-9-]*$/.test(String(s.id))) err(file, 'id must be lowercase letters, digits and dashes');

  if (!Number.isInteger(s.line) || s.line < 1 || s.line > lines.length) err(file, `"line" must be a whole number from 1 to ${lines.length}`);
  else {
    if (s.line < lastLine) err(file, 'stops in order.json must be grouped by line, in ascending order');
    lastLine = Math.max(lastLine, s.line);
  }

  ['shortTitle', 'title', 'hook', 'takeaway'].forEach((k) => need(file, s, k));
  if (!['beginner', 'intermediate', 'advanced'].includes(s.level)) err(file, '"level" must be beginner, intermediate or advanced');
  if (s.inPlainWords !== undefined && !isStr(s.inPlainWords)) err(file, '"inPlainWords" must be text if present');
  if (isStr(s.shortTitle) && s.shortTitle.length > 40) warn(file, 'shortTitle is over 40 characters and will wrap on the map');

  need(`${file} useCase`, s.useCase, 'title');
  need(`${file} useCase`, s.useCase, 'story');

  if (!Array.isArray(s.approaches) || s.approaches.length < 4) err(file, '"approaches" needs at least 4 entries');
  else s.approaches.forEach((a, i) => {
    const w = `${file} approaches[${i}]`;
    ['name', 'what', 'example'].forEach((k) => need(w, a, k));
    if (!isStr(a.greatWhen) && !isStr(a.avoidWhen)) err(w, 'give "greatWhen", "avoidWhen", or both');
  });

  const ch = s.challenge;
  if (!ch) err(file, 'missing "challenge"');
  else {
    need(`${file} challenge`, ch, 'question');
    if (!Array.isArray(ch.options) || ch.options.length < 3 || ch.options.length > 5) err(file, 'challenge needs 3 to 5 options');
    else {
      ch.options.forEach((o, i) => {
        const w = `${file} challenge.options[${i}]`;
        need(w, o, 'text'); need(w, o, 'why');
        if (!['best', 'ok', 'poor'].includes(o.verdict)) err(w, '"verdict" must be best, ok or poor');
      });
      const nb = ch.options.filter((o) => o.verdict === 'best').length;
      if (nb !== 1) err(file, `challenge needs exactly one "best" option (found ${nb})`);
    }
  }

  ['bestCase', 'worstCase'].forEach((k) => { need(`${file} ${k}`, s[k], 'title'); need(`${file} ${k}`, s[k], 'example'); });

  const r = s.route;
  if (!r) err(file, 'missing "route"');
  else {
    need(`${file} route`, r, 'travelling');
    if (!Array.isArray(r.lanes) || r.lanes.length < 1) err(file, 'route needs at least one lane');
    else {
      let n = 0, bad = 0;
      r.lanes.forEach((l, li) => {
        if (!Array.isArray(l.steps) || l.steps.length === 0) return err(file, `route.lanes[${li}] needs steps`);
        l.steps.forEach((st, si) => {
          const w = `${file} route.lanes[${li}].steps[${si}]`;
          need(w, st, 'label'); need(w, st, 'goes');
          if (st.goesWrong !== undefined && !isStr(st.goesWrong)) err(w, '"goesWrong" must be text if present');
          if (isStr(st.goesWrong)) bad++;
          if (isStr(st.label) && st.label.length > 32) warn(w, 'label is over 32 characters; keep step labels short');
          n++;
        });
      });
      if (n < 4 || n > 12) err(file, `route needs 4 to 12 steps in total (found ${n})`);
      if (bad < 1) err(file, 'route needs at least one step with "goesWrong" so the worst case can play');
    }
  }

  // plain-text hygiene: the page escapes HTML, so tags would show up as text
  const dump = JSON.stringify(s);
  if (/<[a-z\/][^>]*>/i.test(dump)) warn(file, 'contains what looks like an HTML tag; content is plain text only');
  if (/\$\{/.test(dump)) warn(file, 'contains "${", which is probably a mistake');
}

// Stop ids used by app.js (Big picture and Design lab) must still exist.
try {
  const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  const looksLikeId = /'((?:m|ml|dl|ai|db|emb|lm|ag|gov|biz|fd|data|tool|nlp|rag|safe|ops)\d+)'/g;
  const used = new Set();
  let m; while ((m = looksLikeId.exec(app))) used.add(m[1]);
  used.forEach((id) => { if (!order.includes(id)) warn('js/app.js', `refers to stop "${id}", which does not exist. That link will be hidden.`); });
} catch (e) { warn('js/app.js', e.message); }

// Coverage: how many stops per line and level. Every line should have all three levels.
const LV = ['beginner', 'intermediate', 'advanced'];
const cov = lines.map(() => ({ beginner: 0, intermediate: 0, advanced: 0 }));
Object.values(stopData).forEach((s) => { if (cov[s.line - 1] && cov[s.line - 1][s.level] !== undefined) cov[s.line - 1][s.level]++; });
console.log('\nCoverage (stops per line and level)');
console.log('  ' + 'Line'.padEnd(20) + LV.map((l) => l.padEnd(14)).join(''));
lines.forEach((l, i) => {
  console.log('  ' + String(l.name).padEnd(20) + LV.map((k) => String(cov[i][k]).padEnd(14)).join(''));
  if (cov[i].beginner + cov[i].intermediate + cov[i].advanced === 0) warn('coverage', `line "${l.name}" has no stops`);
});
const totals = LV.map((k) => cov.reduce((a, c) => a + c[k], 0));
console.log('  ' + 'Total'.padEnd(20) + totals.map((n) => String(n).padEnd(14)).join('') + '\n');
if (totals[0] < 5) warn('coverage', 'fewer than 5 beginner stops');

const total = order.length;
console.log(`Checked ${total} stops in ${lines.length} lines.`);
warns.forEach((w) => console.log('  warning  ' + w));
if (errors.length) {
  errors.forEach((e) => console.log('  ERROR    ' + e));
  console.log(`\n${errors.length} error(s). Fix them and run again.`);
  process.exit(1);
}
console.log('All lessons are valid.');
