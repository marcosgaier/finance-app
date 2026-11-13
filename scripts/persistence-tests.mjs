import assert from 'node:assert/strict';
import { loadFinanceData, saveFinanceData } from '../src/services/storageService.js';
import { normalizeFinanceData, calculateWeeklyDebtReserve } from '../src/utils/financeEngine.js';
import { createFinanceBackup, readFinanceBackup } from '../src/services/backupService.js';
import { sampleFinanceData } from '../src/data/sampleData.js';

let raw = null;
let readError = false;
let writeError = false;
let writes = 0;
globalThis.window = { localStorage: {
  getItem() { if (readError) throw new Error('read'); return raw; },
  setItem(key, value) { if (writeError) throw new Error('quota'); writes++; raw = value; },
} };
const defaults = structuredClone(sampleFinanceData);
const custom = { ...structuredClone(defaults), weeklyExpenses: [{ id: 'custom-rent', name: 'Casa', amount: 10, extra: 'keep' }],
  monthlyExpenses: [{ id: 'custom-service', amount: 20 }], categories: ['custom'],
  reserveBuckets: [{ id: 'custom-bucket', balance: 132.21, note: 'keep' }],
  reserveBucketMovements: [{ id: 'movement', bucketId: 'custom-bucket', amount: 1 }], metadata: { custom: true } };
const normalized = normalizeFinanceData(custom);
for (const key of ['weeklyExpenses', 'monthlyExpenses', 'reserveBuckets', 'reserveBucketMovements', 'categories', 'metadata']) assert.deepEqual(normalized[key], custom[key]);
for (const key of ['weeklyExpenses', 'monthlyExpenses', 'reserveBuckets']) assert.deepEqual(normalizeFinanceData({ ...custom, [key]: [] })[key], []);
const legacy = { ...custom, fixedExpenses: [{ id: 'rent', amount: 10 }, { id: 'legacy-service', amount: 2 }] };
delete legacy.weeklyExpenses; delete legacy.monthlyExpenses;
assert.equal(normalizeFinanceData(legacy).monthlyExpenses[0].id, 'legacy-service');
assert.deepEqual(legacy.fixedExpenses, [{ id: 'rent', amount: 10 }, { id: 'legacy-service', amount: 2 }]);
assert.equal(loadFinanceData(defaults, normalizeFinanceData).dirty, true);
raw = JSON.stringify(custom);
assert.equal(loadFinanceData(defaults, normalizeFinanceData).status, 'ready');
assert.equal(writes, 0);
for (const value of ['', '{bad', 'null', '[]', '{}', JSON.stringify({ ...custom, reserveBuckets: null })]) {
  raw = value;
  const result = loadFinanceData(defaults, normalizeFinanceData);
  assert.equal(result.status, 'incompatible'); assert.equal(result.raw, value); assert.equal(result.data, null);
  assert.equal(raw, value); assert.equal(writes, 0);
}
for (const patch of [{ calculationMode: 'fixedWeekly' }, { type: 'unknown' }, { minimumPaymentRule: { type: 'unknown' } }]) {
  const incompatible = { ...custom, paymentPlans: [{ id: 'legacy', balance: 100, ...patch }] };
  const original = JSON.stringify(incompatible); raw = original;
  assert.throws(() => normalizeFinanceData(incompatible));
  assert.equal(JSON.stringify(incompatible), original);
  assert.equal(loadFinanceData(defaults, normalizeFinanceData).raw, original);
  assert.equal(raw, original);
  const backup = JSON.stringify(createFinanceBackup(incompatible));
  await assert.rejects(() => readFinanceBackup({ name: 'test.json', size: backup.length, text: async () => backup }));
  assert.equal(raw, original);
}
readError = true;
assert.equal(loadFinanceData(defaults, normalizeFinanceData).status, 'read-error');
readError = false; raw = JSON.stringify(custom);
assert.equal(loadFinanceData(defaults, normalizeFinanceData).status, 'ready');
const saved = raw; writeError = true;
assert.equal(saveFinanceData(defaults).ok, false); assert.equal(raw, saved);
writeError = false;
assert.equal(saveFinanceData(custom).ok, true);
assert.deepEqual(loadFinanceData(defaults, normalizeFinanceData).data, normalized);
const backupText = JSON.stringify(createFinanceBackup(custom));
const imported = await readFinanceBackup({ name: 'test.json', size: backupText.length, text: async () => backupText });
assert.deepEqual(imported.financeData.reserveBuckets, custom.reserveBuckets);
assert.deepEqual(imported.financeData.weeklyExpenses, custom.weeklyExpenses);
const reference = new Date(2026, 6, 14);
assert.deepEqual(calculateWeeklyDebtReserve(defaults, reference), calculateWeeklyDebtReserve(normalizeFinanceData(defaults), reference));
assert.equal(writes, 1);
console.log('Persistence and compatibility tests passed');
