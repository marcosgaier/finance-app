import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildIncomePlan, nextPlanningTuesday } from '../src/services/incomePlanning.js';
import { parseTauraPreview, revisionFor } from '../src/services/tauraPreview.js';

const source = JSON.parse(await readFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), 'utf8'));
// Every calculation fixture passes through the unchanged v1 validator/hash check.
async function preview(specs = [{ payDate: '2026-09-22', cents: 101 }]) {
  const data = structuredClone(source);
  data.items = await Promise.all(specs.map(async ({ payDate, cents = 101 }, index) => {
    const item = structuredClone(source.items[0]);
    const start = new Date('2024-06-02T00:00:00Z');
    start.setUTCDate(start.getUTCDate() + index * 7);
    item.periodStart = start.toISOString().slice(0, 10);
    start.setUTCDate(start.getUTCDate() + 6);
    item.periodEnd = start.toISOString().slice(0, 10);
    item.periodId = `taura:weekly:${item.periodStart}`;
    item.payDate = payDate;
    item.netCents = item.grossCents = cents;
    item.deductions.payeCents = item.deductions.kiwiSaverCents = 0;
    item.rulesSnapshot.componentsCents = { base: cents, night: 0, weekend: 0, enhancedPayment: 0 };
    const { revision, ...payload } = item;
    item.revision = await revisionFor(payload);
    return item;
  }));
  return parseTauraPreview(JSON.stringify(data));
}
const options = { startTuesday: '2026-09-22' };
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('NZ clock is explicit; strictly next Tuesday at civil midnight, Monday and Tuesday', () => {
  for (const [instant, expected] of [
    ['2026-11-16T10:59:59.999Z', '2026-11-17'], // Monday 23:59 NZ
    ['2026-11-16T11:00:00.000Z', '2026-11-24'], // Tuesday 00:00 NZ
    ['2026-11-17T10:59:59.999Z', '2026-11-24'],
    ['2026-09-26T14:00:00.000Z', '2026-09-29'], // NZ DST starts
    ['2026-04-04T14:00:00.000Z', '2026-04-07'], // NZ DST ends
    ['2026-12-31T12:00:00.000Z', '2027-01-05'],
  ]) assert.equal(nextPlanningTuesday(Date.parse(instant)), expected);
  for (const bad of [undefined, null, '2026-11-17', NaN, Infinity, 1e20]) assert.throws(() => nextPlanningTuesday(bad));
});

test('complete Tuesday–Monday grid, default four and every supported horizon', async () => {
  const data = await preview();
  assert.equal(buildIncomePlan(data, options).weekCount, 4);
  for (let weekCount = 4; weekCount <= 8; weekCount++) {
    const plan = buildIncomePlan(data, { ...options, weekCount });
    assert.equal(plan.weeks.length, weekCount);
    for (const [i, week] of plan.weeks.entries()) {
      assert.equal(new Date(week.start).getUTCDay(), 2);
      assert.equal(new Date(week.end).getUTCDay(), 1);
      assert.equal(Date.parse(week.end) - Date.parse(week.start), 6 * 86400000);
      if (i) assert.equal(Date.parse(week.start) - Date.parse(plan.weeks[i - 1].end), 86400000);
    }
  }
});

test('invalid Tuesday/horizon inputs fail instead of normalizing', async () => {
  const data = await preview();
  for (const startTuesday of [undefined, null, 1, '2026-02-30', '2026-9-22', '2026-09-21', '2026-09-22T00:00:00Z']) {
    assert.throws(() => buildIncomePlan(data, { startTuesday }));
  }
  for (const weekCount of [0, 3, 9, 4.5, '4', null, NaN, Infinity]) assert.throws(() => buildIncomePlan(data, { ...options, weekCount }));
  assert.throws(() => buildIncomePlan(data, { startTuesday: '9999-12-28' }));
});

test('same payDate and different periods sum once in cents, retaining metadata', async () => {
  const data = await preview([{ payDate: '2026-09-22', cents: 101 }, { payDate: '2026-09-22', cents: 202 }, { payDate: '2026-09-28', cents: 303 }]);
  const plan = buildIncomePlan(data, options), week = plan.weeks[0];
  assert.equal(week.knownIncomeCents, 606);
  assert.equal(week.periodCount, 3);
  assert.deepEqual(week.periods, data.items);
  assert.equal(plan.totals.knownIncomeCents, 606);
  assert.equal(plan.totals.periodCount, 3);
  assert.equal(plan.coverage, 'partial');
  assert.equal(week.coverage, 'partial');
  assert.equal(plan.status, 'estimated');
});

test('Monday belongs to prior week; Tuesday starts new week; outside items listed not summed', async () => {
  const data = await preview([
    { payDate: '2026-09-21' }, { payDate: '2026-09-22' }, { payDate: '2026-09-28' },
    { payDate: '2026-09-29' }, { payDate: '2026-10-19' }, { payDate: '2026-10-20' },
  ]);
  const plan = buildIncomePlan(data, options);
  assert.deepEqual(plan.weeks.map(w => w.periodCount), [2, 1, 0, 1]);
  assert.equal(plan.totals.knownIncomeCents, 404);
  assert.equal(plan.outsidePeriodCount, 2);
  assert.deepEqual(plan.outsidePeriods.map(p => [p.payDate, p.position, p.destinationWeek.start]), [
    ['2026-09-21', 'before', '2026-09-15'], ['2026-10-20', 'after', '2026-10-20'],
  ]);
});

test('zero is mathematical zero with roster warning; absence stays unknown/null', async () => {
  const data = await preview([{ payDate: '2026-09-22', cents: 0 }]);
  const plan = buildIncomePlan(data, options), [zero, absent] = plan.weeks;
  assert.equal(zero.incomeState, 'explicit-zero');
  assert.equal(zero.knownIncomeCents, 0);
  assert.ok(zero.warnings.some(w => w.code === 'ZERO_MAY_BE_INCOMPLETE_ROSTER'));
  assert.equal(absent.incomeState, 'unknown');
  assert.equal(absent.coverage, 'unknown');
  assert.equal(absent.knownIncomeCents, null);
  assert.equal(plan.totals.unknownWeekCount, 3);
  assert.equal(plan.totals.knownIncomeCents, 0); // known subtotal, never full horizon income
  assert.equal(plan.totals.weeksWithItems, 1);
});

test('zero warning survives alongside positive items; selection never becomes exhaustive', async () => {
  const data = await preview([{ payDate: '2026-09-22', cents: 0 }, { payDate: '2026-09-23', cents: 1 }]);
  const week = buildIncomePlan(data, options).weeks[0];
  assert.equal(week.incomeState, 'estimated');
  assert.equal(week.knownIncomeCents, 1);
  assert.ok(week.warnings.some(w => w.code === 'ZERO_MAY_BE_INCOMPLETE_ROSTER'));
  assert.equal(week.coverage, 'partial');
});

test('no items within horizon means unknown weeks and only a zero known subtotal', async () => {
  const plan = buildIncomePlan(await preview([{ payDate: '2026-09-21' }]), options);
  assert.ok(plan.weeks.every(w => w.knownIncomeCents === null && w.incomeState === 'unknown'));
  assert.equal(plan.totals.weeksWithItems, 0);
  assert.equal(plan.totals.knownIncomeCents, 0);
  assert.equal(plan.outsidePeriodCount, 1);
});

test('duplicates/conflicts stay owned by v1; changed payDate replaces previous calculation', async () => {
  const data = await preview();
  const repeated = { ...data, items: [data.items[0], data.items[0]] };
  delete repeated.duplicates;
  const parsed = await parseTauraPreview(JSON.stringify(repeated));
  assert.equal(parsed.duplicates, 1);
  assert.equal(buildIncomePlan(parsed, options).totals.knownIncomeCents, 101);
  const changed = await preview([{ payDate: '2026-09-29', cents: 101 }]);
  assert.equal(changed.items[0].periodId, data.items[0].periodId);
  assert.notEqual(changed.items[0].revision, data.items[0].revision);
  const replacement = buildIncomePlan(changed, options);
  assert.equal(replacement.weeks[0].knownIncomeCents, null);
  assert.equal(replacement.weeks[1].knownIncomeCents, 101);
  repeated.items = [data.items[0], changed.items[0]];
  await assert.rejects(parseTauraPreview(JSON.stringify(repeated)), /Conflicto/);
});

test('active, closed, legacy and reopened are read-only and excluded; realIncome never consulted', async () => {
  const data = await preview(['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map(payDate => ({ payDate })));
  const weeklyRecords = freeze([{ weekDate: '2026-09-22' }, { weekStartDate: '2026-09-29' }]);
  const activeWeek = Object.freeze({ weekStartDate: '2026-10-06', reopenedFromHistory: true, get realIncome() { throw Error('Must not inspect income'); } });
  const plan = buildIncomePlan(data, { ...options, weeklyRecords, activeWeek });
  assert.deepEqual(plan.weeks.map(w => w.weekState), ['closed', 'closed', 'reopened', 'unregistered']);
  assert.ok(plan.weeks.every(w => w.readOnly));
  assert.deepEqual(plan.weeks.map(w => w.excludedFromFuture), [true, true, true, false]);
  assert.equal(plan.totals.knownIncomeCents, 404);
  assert.equal(plan.totals.eligibleKnownIncomeCents, 101);
  assert.equal(plan.totals.excludedWeekCount, 3);
  assert.equal(buildIncomePlan(data, { ...options, activeWeek: { weekDate: '2026-09-22' } }).weeks[0].weekState, 'active');
});

test('month/year/leap and both NZ DST boundaries use civil days', async () => {
  const data = await preview();
  for (const [startTuesday, endMonday] of [
    ['2026-09-22', '2026-10-19'], ['2027-03-30', '2027-04-26'],
    ['2026-12-29', '2027-01-25'], ['2028-02-22', '2028-03-20'],
  ]) assert.equal(buildIncomePlan(data, { startTuesday }).endMonday, endMonday);
  const plan = buildIncomePlan(await preview([{ payDate: '2027-01-04' }, { payDate: '2027-01-05' }]), { startTuesday: '2026-12-29' });
  assert.deepEqual(plan.weeks.map(w => w.periodCount), [1, 1, 0, 0]);
});

test('output independent of host TZ for clocks and grids', () => {
  const moduleURL = new URL('../src/services/incomePlanning.js', import.meta.url).href;
  const code = `import { nextPlanningTuesday, buildIncomePlan } from ${JSON.stringify(moduleURL)};
    console.log(JSON.stringify([nextPlanningTuesday(Date.parse('2026-11-16T11:00:00Z')),
      buildIncomePlan({items:[]}, {startTuesday:'2026-09-22'}).weeks]));`;
  const outputs = ['UTC', 'Pacific/Auckland', 'America/Los_Angeles'].map(TZ => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(outputs[0], outputs[1]); assert.equal(outputs[0], outputs[2]);
});

test('safe cent arithmetic rejects overflow in week and across weeks, even excluded weeks', async () => {
  const max = Number.MAX_SAFE_INTEGER;
  const exact = buildIncomePlan(await preview([{ payDate: '2026-09-22', cents: max }]), options);
  assert.equal(exact.totals.knownIncomeCents, max);
  for (const payDate of ['2026-09-22', '2026-09-29']) {
    const data = await preview([{ payDate: '2026-09-22', cents: max }, { payDate, cents: 1 }]);
    assert.throws(() => buildIncomePlan(data, options), /entero seguro/);
    assert.throws(() => buildIncomePlan(data, { ...options, weeklyRecords: [{ weekDate: '2026-09-22' }] }), /entero seguro/);
  }
});

test('104 distinct validated periods preserve exact cents and reject aggregate overflow', async () => {
  const specs = Array.from({ length: 104 }, (_, index) => ({ payDate: index % 2 ? '2026-09-29' : '2026-09-22', cents: 101 }));
  const plan = buildIncomePlan(await preview(specs), options);
  assert.equal(plan.totals.periodCount, 104);
  assert.equal(plan.totals.knownIncomeCents, 10504);
  assert.deepEqual(plan.weeks.slice(0, 2).map(w => w.knownIncomeCents), [5252, 5252]);
  const cents = Math.floor(Number.MAX_SAFE_INTEGER / 103);
  const overflowing = await preview(specs.map(spec => ({ ...spec, cents })));
  assert.throws(() => buildIncomePlan(overflowing, options), /entero seguro/);
});

test('deep frozen inputs unchanged; nested output metadata is detached', async () => {
  const data = freeze(await preview());
  const opts = freeze({ ...options, weeklyRecords: [{ weekDate: '2026-09-29' }], activeWeek: { weekDate: '2026-10-06' } });
  const before = JSON.stringify([data, opts]);
  const plan = buildIncomePlan(data, opts);
  plan.weeks[0].periods[0].warnings[0].message = 'changed output only';
  plan.weeks[0].periods[0].rulesSnapshot.componentsCents.base = 9;
  assert.equal(JSON.stringify([data, opts]), before);
  const outside = buildIncomePlan(data, { startTuesday: '2026-10-27' });
  outside.outsidePeriods[0].warnings[0].message = 'changed output only';
  assert.equal(JSON.stringify([data, opts]), before);
});

test('no persistent effects or clock reads on import, success and failure', async () => {
  const data = await preview();
  const names = ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'BroadcastChannel', 'fetch'];
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { throw Error(`Forbidden access: ${name}`); } });
    const fresh = await import('../src/services/incomePlanning.js?isolation');
    const originalNow = Date.now;
    try {
      Date.now = () => { throw Error('Implicit clock'); };
      fresh.nextPlanningTuesday(1794830400000);
      fresh.buildIncomePlan(data, options);
      assert.throws(() => fresh.buildIncomePlan(data, { ...options, weekCount: 9 }), /horizonte/);
    } finally { Date.now = originalNow; }
  } finally {
    names.forEach((name, index) => { if (saved[index]) Object.defineProperty(globalThis, name, saved[index]); else delete globalThis[name]; });
  }
});
