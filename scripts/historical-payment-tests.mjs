import assert from 'node:assert/strict';
import { prepareHistoricalPayments, updateHistoricalPaymentAmount } from '../src/utils/historicalPaymentUtils.js';
import { calculatePaymentTotal, calculateWeeklyFundedTotal } from '../src/utils/weeklyRecordUtils.js';
import { saveFinanceData, loadFinanceData } from '../src/services/storageService.js';
import { sampleFinanceData } from '../src/data/sampleData.js';
import { normalizeFinanceData } from '../src/utils/financeEngine.js';

const cards = [{ id: 'gem', name: 'GEM' }, { id: 'now', name: 'NOW' }];
const original = [300, 200, 150].map((amount, index) => ({
  id: `p-${index}`, cardId: 'gem', cardName: 'GEM', date: '2026-07-14', amount,
  fundingSource: 'weekly-income', note: `nota ${index}`, metadata: { reference: index },
}));
const untouched = structuredClone(original);
const draft = updateHistoricalPaymentAmount(original, 1, '250');
const result = prepareHistoricalPayments(original, draft, cards);
assert.deepEqual(original, untouched);
assert.strictEqual(result[0], original[0]);
assert.strictEqual(result[2], original[2]);
assert.deepEqual(result[1], { ...original[1], amount: 250 });
assert.equal(calculatePaymentTotal(result), 700);

const mixed = [original[0], original[1], { ...original[2], cardId: 'now' }];
assert.strictEqual(prepareHistoricalPayments(mixed, updateHistoricalPaymentAmount(mixed, 1, 250), cards)[2], mixed[2]);
const identical = [{ cardId: 'gem', amount: 100 }, { cardId: 'gem', amount: 100 }];
assert.deepEqual(prepareHistoricalPayments(identical, updateHistoricalPaymentAmount(identical, 1, 125), cards),
  [{ cardId: 'gem', amount: 100 }, { cardId: 'gem', amount: 125 }]);
assert.equal('id' in identical[0], false);
assert.equal('date' in identical[0], false);
assert.deepEqual(prepareHistoricalPayments(original, original, cards), original);
for (const amount of ['', ' ', -1, 0, 'bad', Infinity, NaN, null, true]) {
  assert.throws(() => prepareHistoricalPayments(original, updateHistoricalPaymentAmount(original, 1, amount), cards));
}
assert.throws(() => prepareHistoricalPayments(original, original.slice(1), cards));
assert.throws(() => prepareHistoricalPayments(original, original.map((p, i) => i === 1 ? { ...p, date: '2026-07-15' } : p), cards));
const reserved = [{ ...original[0], fundingSource: 'free-savings' }, original[1]];
assert.throws(() => prepareHistoricalPayments(reserved, updateHistoricalPaymentAmount(reserved, 0, 999), cards), /reserva/);
const allowed = prepareHistoricalPayments(reserved, updateHistoricalPaymentAmount(reserved, 1, 250), cards);
assert.strictEqual(allowed[0], reserved[0]);
assert.equal(calculateWeeklyFundedTotal(allowed), 250);
const orphan = [{ ...original[0], cardId: 'removed' }];
assert.deepEqual(prepareHistoricalPayments(orphan, orphan, cards), orphan);
assert.throws(() => prepareHistoricalPayments(orphan, updateHistoricalPaymentAmount(orphan, 0, 999), cards), /tarjeta/);

let stored = null;
let writes = 0;
globalThis.window = { localStorage: {
  getItem: () => stored,
  setItem: (key, value) => { writes++; stored = value; },
} };
const week = { id: 'closed', weekDate: '2026-07-14', payments: original, closedAt: '2026-07-20T12:00:00Z', budgetSnapshot: { weeklyIncome: 900 } };
const data = { ...structuredClone(sampleFinanceData), cards, weeklyRecords: [{ ...week, payments: result }], reserveBuckets: [{ id: 'free-savings', balance: 500 }] };
assert.equal(saveFinanceData(data).ok, true);
const loaded = loadFinanceData(sampleFinanceData, normalizeFinanceData).data;
assert.deepEqual(loaded.weeklyRecords[0].payments, result);
assert.equal(loaded.weeklyRecords[0].closedAt, week.closedAt);
assert.deepEqual(loaded.weeklyRecords[0].budgetSnapshot, week.budgetSnapshot);
assert.equal(loaded.reserveBuckets[0].balance, 500);
assert.equal(writes, 1);
assert.deepEqual(week.payments, untouched);
console.log('Historical payment editing tests passed');
