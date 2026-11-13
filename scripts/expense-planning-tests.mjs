import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseTauraPreview, revisionFor } from '../src/services/tauraPreview.js';
import { buildIncomePlan } from '../src/services/incomePlanning.js';
import { snapshotPlanningExpenses, buildExpensePlan } from '../src/services/expensePlanning.js';

const source = JSON.parse(await readFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), 'utf8'));
async function plan(amounts = [10000, 10000, 10000, 10000], options = {}, payDates = []) {
  const data = structuredClone(source);
  data.items = await Promise.all(amounts.map(async (amount, index) => {
    const item = structuredClone(source.items[0]);
    const start = new Date('2026-09-13T00:00:00Z');
    start.setUTCDate(start.getUTCDate() + index * 7);
    item.periodStart = start.toISOString().slice(0, 10);
    start.setUTCDate(start.getUTCDate() + 6);
    item.periodEnd = start.toISOString().slice(0, 10);
    item.periodId = `taura:weekly:${item.periodStart}`;
    item.payDate = new Date(start.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    item.payDate = payDates[index] ?? item.payDate;
    item.netCents = item.grossCents = amount;
    item.deductions.payeCents = item.deductions.kiwiSaverCents = 0;
    item.rulesSnapshot.componentsCents = { base: amount, night: 0, weekend: 0, enhancedPayment: 0 };
    const { revision, ...payload } = item;
    item.revision = await revisionFor(payload);
    return item;
  }));
  return buildIncomePlan(await parseTauraPreview(JSON.stringify(data)), { startTuesday: '2026-09-22', ...options });
}
const budget = () => snapshotPlanningExpenses({ weeklyExpenses: [{ id: 'rent', amount: 20 }],
  monthlyExpenses: [{ id: 'phone', amount: 1.01 }, { id: 'service', amount: 1.01 }],
  variableBudgets: { groceries: 10, fuel: 0 } });
const reviews = p => Object.fromEntries(p.weeks.map(w => [w.start, { reviewed: true, adjustments: [], assignments: [], obligations: [] }]));
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('reviewed base: single 7/30 rounding, explicit zero, partial estimates and theoretical sum', async () => {
  const p = await plan(), result = buildExpensePlan(p, budget(), reviews(p));
  assert.equal(result.weeks[0].expenses.monthlyProvisionCents, 47);
  assert.equal(result.weeks[0].marginCents, 6953);
  assert.equal(result.totalMarginCents, 27812);
  assert.equal(result.weeks[0].coverage, 'partial');
  assert.ok(result.weeks[0].warnings.some(w => w.code === 'PARTIAL_SELECTION'));
});

test('missing, invalid and zero differ; no implicit debt/saving/obligation review', async () => {
  const p = await plan(), r = reviews(p);
  for (const value of [undefined, null, '', NaN, -1, 0.001]) {
    const b = snapshotPlanningExpenses({ weeklyExpenses: [], monthlyExpenses: [], variableBudgets: { groceries: value, fuel: 0 } });
    assert.equal(buildExpensePlan(p, b, r).weeks[0].marginCents, null);
  }
  for (const key of ['reviewed', 'adjustments', 'assignments', 'obligations']) {
    const copy = structuredClone(r); delete copy[p.weeks[1].start][key];
    const result = buildExpensePlan(p, budget(), copy);
    assert.equal(result.weeks[1].state, 'pending-review');
    assert.equal(result.weeks[2].cumulativeMarginCents, null);
    assert.equal(result.totalMarginCents, null);
  }
  assert.equal(buildExpensePlan(p, snapshotPlanningExpenses({}), r).weeks[0].marginCents, null);
});

test('manual replacements/additions, debt, saving, negative margin and no double funding', async () => {
  const p = await plan(), r = reviews(p), w = r[p.weeks[0].start];
  w.adjustments = [{ targetId: 'rent', amountCents: 0 }, { id: 'repair', amountCents: 10000 }];
  w.assignments = [{ id: 'debt', destination: 'debt', amountCents: 500 },
    { id: 'saving', destination: 'saving', amountCents: 200 },
    { id: 'funding', destination: 'saving', amountCents: 10000, fundingExpenseId: 'repair' }];
  const result = buildExpensePlan(p, budget(), r);
  assert.equal(result.weeks[0].marginCents, -1747);
  assert.equal(result.weeks[1].marginCents, 6953);
  for (const bad of [ { id: 'rent', destination: 'debt', amountCents: 1 },
    { id: 'new', destination: 'saving', amountCents: 1, fundingExpenseId: 'missing' },
    { id: 'debt', destination: 'debt', amountCents: 1 } ]) {
    const copy = structuredClone(r); copy[p.weeks[0].start].assignments.push(bad);
    assert.equal(buildExpensePlan(p, budget(), copy).weeks[0].marginCents, null);
  }
  w.adjustments.push({ targetId: 'rent', amountCents: 1 });
  assert.equal(buildExpensePlan(p, budget(), r).weeks[0].marginCents, null);
});

test('unknown income blocks suffix; explicit zero stays hypothetical and warns', async () => {
  const p = await plan([0]);
  const result = buildExpensePlan(p, budget(), reviews(p));
  assert.equal(result.weeks[0].incomeState, 'explicit-zero');
  assert.equal(result.weeks[0].marginCents, -3047);
  assert.ok(result.weeks[0].warnings.some(w => w.code === 'ZERO_MAY_BE_INCOMPLETE_ROSTER'));
  assert.equal(result.weeks[1].state, 'unknown-income');
  assert.equal(result.totalMarginCents, null);
});

test('closed, active and reopened weeks never contribute estimates or accumulations', async () => {
  for (const options of [ { weeklyRecords: [{ weekDate: '2026-09-22' }] },
    { activeWeek: { weekDate: '2026-09-22' } },
    { activeWeek: { weekDate: '2026-09-22', reopenedFromHistory: true } } ]) {
    const p = await plan(undefined, options), result = buildExpensePlan(p, budget(), reviews(p));
    assert.equal(result.weeks[0].state, 'excluded');
    assert.equal(result.weeks[0].incomeCents, null);
    assert.equal(result.weeks[0].marginCents, null);
    assert.equal(result.weeks[1].cumulativeMarginCents, null);
  }
});

test('due dates are annotations, missing date/amount/review remains unknown', async () => {
  const p = await plan(), r = reviews(p);
  // Move the selected validated pay date within its INT-03A destination week.
  const dated = await plan([10000], {}, ['2026-09-24']);
  r[p.weeks[0].start].obligations = [{ targetId: 'rent', dueDate: '2026-09-23', amountCents: 2000, reviewed: true }];
  assert.ok(buildExpensePlan(dated, budget(), r).weeks[0].warnings.some(w => w.code === 'DUE_BEFORE_PAY_DATE'));
  for (const key of ['dueDate', 'amountCents', 'reviewed']) {
    const copy = structuredClone(r); delete copy[p.weeks[0].start].obligations[0][key];
    assert.equal(buildExpensePlan(p, budget(), copy).weeks[0].marginCents, null);
  }
});

test('safe arithmetic: monthly intermediate, debt and accumulated margins', async () => {
  const p = await plan(), r = reviews(p), max = Number.MAX_SAFE_INTEGER;
  const b = budget(); b.monthly = [{ id: 'm', amountCents: max }];
  assert.equal(buildExpensePlan(p, b, r).weeks[0].expenses.monthlyProvisionCents, Number((BigInt(max) * 7n + 15n) / 30n));
  b.monthly.push({ id: 'n', amountCents: 1 });
  assert.throws(() => buildExpensePlan(p, b, r), /seguro/);
  r[p.weeks[0].start].assignments = [{ id: 'd1', destination: 'debt', amountCents: max }, { id: 'd2', destination: 'debt', amountCents: 1 }];
  assert.throws(() => buildExpensePlan(p, budget(), r), /seguro/);
  const large = await plan([0, 0]);
  const zero = { weekly: [], monthly: [], variables: [{ id: 'groceries', amountCents: 0 }, { id: 'fuel', amountCents: 0 }] };
  const largeReviews = reviews(large);
  for (const w of large.weeks) largeReviews[w.start].assignments = [{ id: 'manual', destination: 'debt', amountCents: max }];
  assert.throws(() => buildExpensePlan(large, zero, largeReviews), /seguro/);
});

test('several validated pay periods in one week are consumed once', async () => {
  const p = await plan([100, 200], {}, ['2026-09-28', '2026-09-28']);
  const result = buildExpensePlan(p, budget(), reviews(p));
  assert.equal(p.weeks[0].periodCount, 2);
  assert.equal(result.weeks[0].incomeCents, 300);
  assert.equal(result.weeks[0].marginCents, -2747);
});

test('frozen inputs detached; forbidden operational fields and side effects never accessed', async () => {
  const p = freeze(await plan()), b = freeze(budget()), r = freeze(reviews(p));
  const before = JSON.stringify([p, b, r]);
  const names = ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch'];
  const descriptors = names.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  const now = Date.now;
  try {
    names.forEach(n => Object.defineProperty(globalThis, n, { configurable: true, get() { throw Error(n); } }));
    Date.now = () => { throw Error('clock'); };
    const module = await import('../src/services/expensePlanning.js?isolation');
    const operational = { weeklyExpenses: [], monthlyExpenses: [], variableBudgets: { groceries: 0, fuel: 0 } };
    for (const key of ['weeklyIncome', 'realIncome', 'paymentPlans', 'reserveBuckets', 'weeklyRecords']) {
      Object.defineProperty(operational, key, { get() { throw Error(key); } });
    }
    module.snapshotPlanningExpenses(freeze(operational));
    const out = module.buildExpensePlan(p, b, r);
    out.weeks[0].warnings[0].message = 'detached';
    assert.equal(JSON.stringify([p, b, r]), before);
  } finally {
    Date.now = now;
    names.forEach((n, i) => { if (descriptors[i]) Object.defineProperty(globalThis, n, descriptors[i]); else delete globalThis[n]; });
  }
});

test('C1 rejects excess, summed excess, duplicate destinations, monthly and missing funding', async () => {
  const p = await plan();
  const link = (id, destination, amountCents, fundingExpenseId = 'rent') => ({ id, destination, amountCents, fundingExpenseId });
  for (const [assignments, code] of [
    [[link('a', 'debt', 2001)], 'assignment.excessFunding'],
    [[link('a', 'debt', 1200), link('b', 'saving', 801)], 'assignment.excessFunding'],
    [[link('a', 'debt', 500), link('b', 'debt', 500)], 'assignment.duplicateFundingDestination'],
    [[link('a', 'debt', 1, 'phone')], 'assignment.monthlyFundingUnsupported'],
    [[link('a', 'debt', 1, 'missing')], 'assignment.unknownExpense'],
    [[link('a', 'debt', 1), link('a', 'saving', 1)], 'assignment.invalid'],
  ]) {
    const r = reviews(p); r[p.weeks[0].start].assignments = assignments;
    const w = buildExpensePlan(p, budget(), r).weeks[0];
    assert.equal(w.state, 'pending-review'); assert.equal(w.marginCents, null);
    assert.ok(w.pending.includes(code), code);
  }
  const r = reviews(p);
  r[p.weeks[0].start].assignments = [link('a', 'debt', 1200), link('b', 'saving', 800)];
  const w = buildExpensePlan(p, budget(), r).weeks[0];
  assert.equal(w.marginCents, 6953); assert.equal(w.debtCents, 0); assert.equal(w.savingCents, 0);
  r[p.weeks[0].start].adjustments = [{ targetId: 'rent', amountCents: 1999 }];
  assert.equal(buildExpensePlan(p, budget(), r).weeks[0].marginCents, null);
});

test('C1 all reviewed obligations are detached annotations, before and after pay date', async () => {
  const p = await plan([10000], {}, ['2026-09-24']), r = reviews(p);
  const obligations = ['2026-09-23', '2026-09-25', '2026-10-01'].map(dueDate => ({
    targetId: 'rent', dueDate, amountCents: 2000, reviewed: true }));
  r[p.weeks[0].start].obligations = obligations;
  freeze(p); freeze(r);
  const out = buildExpensePlan(p, freeze(budget()), r);
  assert.deepEqual(out.weeks[0].obligations, obligations);
  assert.equal(out.weeks[0].marginCents, 6953);
  assert.equal(out.weeks[0].warnings.filter(w => w.code === 'DUE_BEFORE_PAY_DATE').length, 1);
  out.weeks[0].obligations[0].amountCents = 1;
  assert.equal(obligations[0].amountCents, 2000);
  const pending = structuredClone(r); pending[p.weeks[0].start].reviewed = false;
  assert.deepEqual(buildExpensePlan(p, budget(), pending).weeks[0].obligations, []);
});
