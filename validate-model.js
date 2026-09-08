/* ==========================================================================
   Model validator — run with:  node validate-model.js
   --------------------------------------------------------------------------
   All roles share ONE option list per question, so a reworded stem has to keep
   the same answer shape. Rewording without re-checking is how "Yes — it is
   documented" ended up under "how exposed would you be?", and how a variant
   asking "do reporting requests need rework?" ended up scoring "Yes" as the
   healthiest answer.

   Each question declares a `shape`; this checks every wording against it, plus
   the invariants that keep scoring and the gate's time estimates honest, and
   the ones the durable link format depends on: every option has a permanent
   single-letter key, unique within its question, and ids are letters-then-
   digits so <id><key> tokens parse back unambiguously.

   Saved links point at ids and keys, never positions. So: add, remove, reorder
   and reword freely. Never change or reuse an option key — retire an option
   with `retired: true` instead of deleting it.

   Run it after touching assessment-model.js.
   ========================================================================== */
global.window = {};
require('./assets/js/assessment-model.js');
const M = window.ASSESSMENT;

const SHAPES = {
  // Yes/No gradient — needs an auxiliary-verb stem.
  polar: t => /^(is|are|was|were|do|does|did|can|could|has|have|had|will|would|should|must)\b/i.test(t),
  // How good / how much — an adjective or adverb of degree.
  degree: t => /\bhow (much|well|bad|badly|close|closely|reliable|reliably|quick|quickly|often|long|healthy|exposed|confident)\b/i.test(t),
  // A mechanism.
  method: t => /\bhow (do|does|did|is|are|was|were|would|will|can|could)\b/i.test(t) || /^what\b/i.test(t),
  // A person or party.
  identity: t => /^who\b/i.test(t),
  // A quantity.
  count: t => /\bhow many\b/i.test(t),
  // How recently something last happened.
  recency: t => /^when\b/i.test(t) || /\bhow (recently|long ago)\b/i.test(t),
  // Where something lives.
  location: t => /^where\b/i.test(t),
};

// Leading conditional/temporal clauses are scene-setting; the interrogative
// that matters follows the comma.
const core = t => t.trim().replace(/^(if|when|once|while)\b[^,]+,\s*/i, '');

let errors = 0, warns = 0, checked = 0;
const fail = m => { console.log('  FAIL  ' + m); errors++; };
const warn = m => { console.log('  warn  ' + m); warns++; };

const all = M.sections.flatMap(s => s.questions);

console.log('=== wording vs answer shape ===');
for (const sec of M.sections) {
  for (const q of sec.questions) {
    if (!q.shape) { fail(`${q.id}: no shape declared`); continue; }
    const test = SHAPES[q.shape];
    if (!test) { fail(`${q.id}: unknown shape "${q.shape}"`); continue; }
    const variants = [['base', q.q], ...Object.entries(q.qr || {})];
    for (const [role, text] of variants) {
      checked++;
      if (!test(core(text))) {
        fail(`${q.id} [${role}] declared "${q.shape}" but reads: "${text}"`);
      }
    }
  }
}

console.log('\n=== per-question invariants ===');
for (const q of all) {
  const unsure = q.opts.filter(o => o.unsure);
  if (unsure.length !== 1) fail(`${q.id}: needs exactly one unsure option, has ${unsure.length}`);
  if (!q.opts.some(o => o.flag)) fail(`${q.id}: no option raises a flag`);
  if (!(q.t >= 1 && q.t <= 3)) fail(`${q.id}: tier must be 1-3, got ${q.t}`);
  for (const o of q.opts) {
    if (typeof o.v !== 'number' || o.v < 0 || o.v > 3) fail(`${q.id}: option "${o.label}" has v=${o.v}`);
    if (!o.label) fail(`${q.id}: option with no label`);
    if (o.flag && !o.fn) warn(`${q.id}: option "${o.label}" has a flag but no short name`);
  }
  // A healthiest option should exist, or the question can never score well.
  if (!q.opts.some(o => o.v === 3)) warn(`${q.id}: no option scores 3`);

  // Saved links point at option KEYS, so every option needs a permanent one.
  const keys = q.opts.map(o => o.k);
  if (keys.some(k => !/^[a-z]$/.test(k || ''))) fail(`${q.id}: every option needs a single-letter key k`);
  if (new Set(keys).size !== keys.length) fail(`${q.id}: option keys must be unique within the question`);
  // The token format is <letters><digits><key>; an id in any other shape cannot be parsed back.
  if (!/^[a-z]+\d+$/.test(q.id)) fail(`${q.id}: ids must be letters then digits (the link format depends on it)`);
}
for (const c of M.context) {
  const keys = (c.opts || []).map(o => o.k);
  if (keys.some(k => !/^[a-z]$/.test(k || ''))) fail(`${c.id}: every closing option needs a single-letter key k`);
  if (new Set(keys).size !== keys.length) fail(`${c.id}: closing option keys must be unique`);
  if (!/^[a-z]+\d+$/.test(c.id)) fail(`${c.id}: closing question ids must be letters then digits`);
}
for (const list of [M.roles, M.clouds, M.depths]) {
  for (const item of list) {
    if (/[.]/.test(item.id)) fail(`${item.id}: gate ids may not contain "." (the link format uses it as a separator)`);
  }
}

console.log('\n=== ids ===');
const ids = all.map(q => q.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) fail('duplicate question ids: ' + [...new Set(dupes)].join(', '));

console.log('\n=== cloud fork symmetry ===');
const counts = M.clouds.map(c => {
  const n = M.depths.map(d => {
    let k = 0;
    for (const sec of M.sections) {
      if (sec.clouds && !sec.clouds.includes(c.id)) continue;
      for (const q of sec.questions) {
        if (q.clouds && !q.clouds.includes(c.id)) continue;
        if ((q.t || 2) <= d.tier) k++;
      }
    }
    return k;
  });
  return { cloud: c.label, n };
});
const first = JSON.stringify(counts[0].n);
for (const c of counts) {
  const mins = c.n.map(k => Math.max(2, Math.round((k + M.context.length) * M.secondsPerQuestion / 60)));
  console.log(`  ${c.cloud.padEnd(20)} ${c.n.map((k, i) => k + 'q/' + mins[i] + 'm').join('   ')}`);
  if (JSON.stringify(c.n) !== first) {
    fail(`${c.cloud} is asymmetric with the other forks — the gate's time estimates assume every cloud matches`);
  }
}

console.log('\n=== closing questions ===');
for (const c of M.context) {
  if (!c.opts || c.opts.length < 2) fail(`${c.id}: needs at least two options`);
}

// The bank feeds the live model, so it is held to the same standard — a
// question with a broken stem is not ready to drop in.
console.log('\n=== question-bank.json ===');
let bank = [];
try {
  bank = require('./question-bank.json').questions;
} catch (e) {
  console.log('  (not present — skipping)');
}
for (const q of bank) {
  if (!q.shape) { fail(`bank ${q.id}: no shape declared`); continue; }
  const test = SHAPES[q.shape];
  if (!test) { fail(`bank ${q.id}: unknown shape "${q.shape}"`); continue; }
  for (const [role, text] of [['base', q.q], ...Object.entries(q.qr || {})]) {
    checked++;
    if (!test(core(text))) fail(`bank ${q.id} [${role}] declared "${q.shape}" but reads: "${text}"`);
  }
  if (q.opts.filter(o => o.unsure).length !== 1) fail(`bank ${q.id}: needs exactly one unsure option`);
  if (!q.opts.some(o => o.flag)) fail(`bank ${q.id}: no option raises a flag`);
  if (ids.includes(q.id)) fail(`bank ${q.id}: id already used in the live model`);
  const bk = q.opts.map(o => o.k);
  if (bk.some(k => !/^[a-z]$/.test(k || ''))) fail(`bank ${q.id}: every option needs a single-letter key k`);
  if (new Set(bk).size !== bk.length) fail(`bank ${q.id}: option keys must be unique`);
  if (!/^[a-z]+\d+$/.test(q.id)) fail(`bank ${q.id}: ids must be letters then digits`);
}
if (bank.length) console.log(`  ${bank.length} banked questions checked`);

console.log(`\nchecked ${checked} wordings across ${all.length} live + ${bank.length} banked questions`);
console.log(errors ? `\nFAILED — ${errors} error(s), ${warns} warning(s)` : `\nPASSED — ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
