#!/usr/bin/env node
// Rule baseline (check point B): the simulator drives the game's real rules, so its output changes when a rule changes.
//   node tools/check_sim_baseline.mjs            # fail (exit 1) if the output differs from the baseline file
//   node tools/check_sim_baseline.mjs --update   # rewrite the baseline file with the current output
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'tests/fixtures/sim/chosen-seeds2.txt');
const MAX_SHOWN = 20;

const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/sim_learning.mjs'), '--set', 'chosen', '--seeds', '2'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (r.error || r.status !== 0) { console.error('simulator failed:', r.error ? r.error.message : `exit ${r.status}\n${r.stderr}`); process.exit(2); }
const out = r.stdout;

if (process.argv.includes('--update')) {
  fs.mkdirSync(path.dirname(BASE), { recursive: true }); fs.writeFileSync(BASE, out);
  console.log(`baseline updated: ${path.relative(ROOT, BASE)} (${out.split('\n').length - 1} lines)`); process.exit(0);
}
if (!fs.existsSync(BASE)) { console.error(`baseline file missing: ${path.relative(ROOT, BASE)} (create it with --update)`); process.exit(1); }
const want = fs.readFileSync(BASE, 'utf8');
if (out === want) { console.log('rule baseline: simulation output unchanged'); process.exit(0); }

const a = want.split('\n'), b = out.split('\n'); const n = Math.max(a.length, b.length); let shown = 0, total = 0;
console.error('rule baseline: simulation output differs from tests/fixtures/sim/chosen-seeds2.txt');
for (let i = 0; i < n; i++) {
  if (a[i] === b[i]) continue; total++;
  if (shown < MAX_SHOWN) { shown++; console.error(`line ${i + 1}:\n  baseline: ${a[i] ?? '(none)'}\n  current : ${b[i] ?? '(none)'}`); }
}
console.error(`${total} differing line(s)${total > shown ? `, first ${shown} shown` : ''}. If the rule change is intended, run: node tools/check_sim_baseline.mjs --update, and explain in the PR what changed and why.`);
process.exit(1);
