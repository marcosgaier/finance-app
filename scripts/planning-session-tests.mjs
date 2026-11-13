import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseTauraPreview } from '../src/services/tauraPreview.js';
import { createPlanningSession } from '../src/services/planningSession.js';

const text = await readFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), 'utf8');
const preview = await parseTauraPreview(text);
const options = { nowMs: Date.parse('2026-09-21T00:00:00Z') };
const budget = () => ({ weeklyExpenses: [{ id: 'rent', amount: 20 }], monthlyExpenses: [],
  variableBudgets: { groceries: 0, fuel: 0 } });
const draft = () => ({ adjustments: [], assignments: [], obligations: [] });
const first = '2026-09-22';
function session(b = budget(), opts = options) {
  const s = createPlanningSession(); s.acceptValidated(s.beginImport(), preview, b, opts); return s;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('validated producer → 4/8 weeks → allowed snapshot → pending → explicit review', () => {
  for (const weekCount of [4, 8]) {
    const s = session(budget(), { ...options, weekCount });
    assert.equal(s.read().incomePlan.weeks.length, weekCount);
    assert.equal(s.read().result.weeks[0].state, 'pending-review');
    assert.throws(() => s.reviewWeek(first), /explícitos/);
    s.editWeek(first, draft());
    assert.equal(s.read().result.weeks[0].marginCents, null);
    s.reviewWeek(first);
    const w = s.read().result.weeks[0];
    assert.equal(w.marginCents, preview.items[0].netCents - 2000);
    assert.equal(w.coverage, 'partial');
    s.editWeek(first, draft());
    assert.equal(s.read().result.weeks[0].marginCents, null);
  }
});

test('explicit arrays and valid assumptions required; failed review does not commit', () => {
  const s = session();
  for (const key of ['adjustments', 'assignments', 'obligations']) {
    const d = draft(); delete d[key]; s.editWeek(first, d);
    assert.throws(() => s.reviewWeek(first), /inválidos/);
    assert.equal(s.read().assumptions[first].reviewed, false);
  }
  assert.throws(() => s.editWeek('2020-01-01', draft()), /horizonte/);
});

test('integration keeps explicit zero, absent income, negative margin and registered exclusions', () => {
  const start = '2026-10-06', opts = { nowMs: Date.parse('2026-10-05T00:00:00Z') };
  const s = session(budget(), opts);
  s.editWeek(start, draft()); s.reviewWeek(start);
  assert.equal(s.read().result.weeks[0].incomeState, 'explicit-zero');
  assert.equal(s.read().result.weeks[0].marginCents, -2000);
  s.editWeek('2026-10-13', draft()); s.reviewWeek('2026-10-13');
  assert.equal(s.read().result.weeks[1].state, 'unknown-income');
  assert.equal(s.read().result.totalMarginCents, null);
  const record = { weekDate: start };
  Object.defineProperty(record, 'realIncome', { get() { throw Error('Operational income'); } });
  const closed = session(budget(), { ...opts, weeklyRecords: [record] });
  closed.editWeek(start, draft()); closed.reviewWeek(start);
  assert.equal(closed.read().result.weeks[0].state, 'excluded');
  assert.equal(closed.read().result.weeks[0].marginCents, null);
});

test('invalid mutable IDs cannot leak operational references into a snapshot', () => {
  const b = budget(); b.weeklyExpenses[0].id = { private: 'invalid-id' };
  const s = session(b); b.weeklyExpenses[0].id.private = 'mutated';
  assert.equal(s.read().base.weekly[0].id, null);
  s.editWeek(first, draft());
  assert.throws(() => s.reviewWeek(first), /inválidos/);
  assert.equal(s.read().result.weeks[0].marginCents, null);
});

test('replacement, invalid import, discard, refresh and obsolete async completions', async () => {
  const s = session(); s.editWeek(first, draft()); s.reviewWeek(first);
  const token = s.beginImport();
  assert.equal(s.read(), null);
  try { await parseTauraPreview('invalid'); } catch { s.rejectImport(token); }
  assert.equal(s.read(), null);
  assert.equal(s.acceptValidated(token, preview, budget(), options), false);
  const old = s.beginImport();
  const newer = s.beginImport();
  assert.equal(s.acceptValidated(newer, preview, budget(), options), true);
  assert.equal(s.acceptValidated(old, preview, budget(), options), false);
  s.rejectImport(old);
  assert.deepEqual(s.read().assumptions, {});
  // Accept tokens are single use; old results cannot overwrite new reviews.
  assert.equal(s.acceptValidated(newer, preview, budget(), options), false);
  const pending = s.beginImport(); s.discard();
  assert.equal(s.acceptValidated(pending, preview, budget(), options), false);
  assert.equal(s.read(), null);
  const fail = s.beginImport();
  assert.throws(() => s.acceptValidated(fail, preview, budget(), { ...options, weekCount: 3 }));
  assert.equal(s.read(), null);
  assert.equal(createPlanningSession().read(), null); // reload = new instance
});

test('navigation is no session action; budget staleness is sticky and rebuild resets review', () => {
  const b = budget(), s = session(b);
  s.editWeek(first, { ...draft(), adjustments: [{ targetId: 'rent', amountCents: 3000 }] });
  s.reviewWeek(first);
  const before = s.read();
  assert.deepEqual(s.read(), before); // keep same instance mounted across tabs
  assert.deepEqual(s.checkBudget({ ...b, realIncome: 999 }), before);
  b.weeklyExpenses[0].amount = 40;
  const stale = s.checkBudget(b);
  assert.equal(stale.stale, true); assert.equal(stale.result, null);
  assert.equal(stale.base.weekly[0].amountCents, 2000);
  assert.equal(stale.assumptions[first].adjustments[0].amountCents, 3000);
  assert.equal(stale.assumptions[first].reviewed, false);
  assert.throws(() => s.reviewWeek(first), /vigente/);
  assert.equal(s.checkBudget(budget()).stale, true);
  const rebuilt = s.rebuildBudget(b);
  assert.equal(rebuilt.base.weekly[0].amountCents, 4000);
  assert.deepEqual(rebuilt.assumptions, {});
  assert.equal(rebuilt.result.weeks[0].state, 'pending-review');
});

test('deeply frozen inputs, detached outputs; no operational reads or storage/network access', async () => {
  const b = budget();
  for (const key of ['setFinanceData', 'weeklyIncome', 'realIncome', 'weeklyRecords', 'activeWeek',
    'reserveMovements', 'paymentPlans', 'reserveBuckets', 'history', 'backup']) {
    Object.defineProperty(b, key, { get() { throw new Error(`Forbidden ${key}`); } });
  }
  const p = freeze(structuredClone(preview)), d = freeze(draft()); freeze(b);
  const before = JSON.stringify([p, b, d]);
  const names = ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'BroadcastChannel'];
  const descriptors = names.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  let accesses = 0;
  try {
    names.forEach(n => Object.defineProperty(globalThis, n, { configurable: true, get() { accesses++; throw Error(n); } }));
    const { createPlanningSession: create } = await import('../src/services/planningSession.js?isolated');
    const s = create(); s.acceptValidated(s.beginImport(), p, b, options);
    s.editWeek(first, d); s.reviewWeek(first); s.checkBudget(b);
    const out = s.read(); out.base.weekly[0].amountCents = 123;
    out.incomePlan.weeks[0].periods[0].netCents = 0;
    out.assumptions[first].adjustments.push({ id: 'bad' });
    assert.equal(s.read().base.weekly[0].amountCents, 2000);
    assert.deepEqual(s.read().assumptions[first].adjustments, []);
    s.rebuildBudget(b); s.discard();
    assert.equal(accesses, 0);
    assert.equal(JSON.stringify([p, b, d]), before);
  } finally {
    names.forEach((n, i) => { if (descriptors[i]) Object.defineProperty(globalThis, n, descriptors[i]); else delete globalThis[n]; });
  }
});

test('UI reconfiguration 4..8 discards assumptions, keeps civil start and invalidates closed/reopened calculations', () => {
  const s = session();
  for (const weekCount of [5, 6, 7, 8, 4]) {
    s.editWeek(first, draft()); s.reviewWeek(first);
    const previous = s.read();
    const next = s.configure(preview, { weekCount });
    assert.equal(next.incomePlan.weeks.length, weekCount);
    assert.equal(next.incomePlan.startTuesday, first);
    assert.deepEqual(next.assumptions, {});
    assert.ok(next.generation > previous.generation);
    assert.equal(next.result.weeks[0].marginCents, null);
  }
  for (const metadata of [
    { weeklyRecords: [{ weekDate: first }] },
    { activeWeek: { weekStartDate: first, reopenedFromHistory: true } },
    { weeklyRecords: [{ weekStartDate: first }] },
    {},
  ]) {
    s.editWeek(first, draft()); s.reviewWeek(first);
    s.configure(preview, { weekCount: 4, ...metadata });
    const next = s.read();
    assert.deepEqual(next.assumptions, {});
    assert.equal(next.result.weeks[0].marginCents, null);
    assert.equal(next.result.weeks[0].state, Object.keys(metadata).length ? 'excluded' : 'pending-review');
  }
});

test('render synchronization preserves reviews; a new horizon cannot clear stale-budget blocking', () => {
  const b = budget(), s = session(b);
  s.editWeek(first, draft()); s.reviewWeek(first);
  const reviewed = s.read();
  assert.deepEqual(s.configure(preview, { weekCount: 4 }), reviewed);
  s.checkBudget({ ...b, variableBudgets: { groceries: 1, fuel: 0 } });
  const stale = s.configure(preview, { weekCount: 8 });
  assert.equal(stale.stale, true);
  assert.equal(stale.result, null);
  assert.throws(() => s.reviewWeek(first), /vigente/);
  const rebuilt = s.rebuildBudget(b);
  assert.equal(rebuilt.stale, false);
  assert.deepEqual(rebuilt.assumptions, {});
  assert.equal(rebuilt.result.weeks[0].marginCents, null);
});
