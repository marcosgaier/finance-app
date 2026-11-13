import assert from 'node:assert/strict';
import { hasFinancialWeekData, getWeekReopenError, reopenFinancialWeek, closeFinancialWeek, closeReopenedFinancialWeek, buildReopenedWeekCorrection } from '../src/utils/weekReopeningUtils.js';
import { saveFinanceData, loadFinanceData } from '../src/services/storageService.js';
import { normalizeFinanceData } from '../src/utils/financeEngine.js';
import { sampleFinanceData } from '../src/data/sampleData.js';

const payments = [300, 200, 150].map((amount, index) => ({ id: `p${index}`, date: '2026-07-14', cardId: index === 2 ? 'now' : 'gem', amount, fundingSource: index === 2 ? 'free-savings' : 'weekly-income', note: `pago ${index}`, extra: { keep: index } }));
const record = { id: 'old', weekDate: '2026-07-14', realIncome: 0, income: 0, openingBalance: 10,
  extraIncome: [{ id: 'extra', amount: 20, type: 'refund', custom: 'keep' }], payments,
  variableTransactions: [{ id: 'buy', amount: 10, fundingSource: 'free-savings', metadata: 'keep' }],
  reserveMovements: [{ id: 'transfer', bucketId: 'bbva', type: 'deposit', amount: 75, date: '2026-07-15', custom: 'keep' }],
  budgetSnapshot: { weeklyIncome: 900, weeklyExpenses: [], monthlyReserveWeekly: 20, custom: true },
  recommendedPayment: 123, minimumToAvoidExpiry: 100, note: 'original', closedAt: '2026-07-20T12:00:00Z', createdAt: '2026-07-14T12:00:00Z', updatedAt: '2026-07-20T12:00:00Z', custom: { untouched: true } };
const data = { ...structuredClone(sampleFinanceData), cards: [{ id: 'gem', name: 'GEM' }, { id: 'now', name: 'NOW' }], activeWeek: null, weeklyRecords: [record], reserveBuckets: [{ id: 'free-savings', balance: 500 }, { id: 'bbva', balance: 75 }] };
const original = structuredClone(data);
const reopened = reopenFinancialWeek(data, 'old');
assert.equal(reopened.weeklyRecords.length, 0);
assert.equal(reopened.activeWeek.realIncome, 0);
assert.deepEqual(closeReopenedFinancialWeek(reopened.activeWeek), record);
assert.deepEqual(data, original);
assert.strictEqual(reopened.reserveBuckets, data.reserveBuckets);
assert.strictEqual(reopenFinancialWeek(reopened, 'old'), reopened);
const reclosed = closeFinancialWeek(reopened, closeReopenedFinancialWeek(reopened.activeWeek));
assert.deepEqual(reclosed.weeklyRecords, [record]);
assert.strictEqual(closeFinancialWeek(reclosed, record), reclosed);
assert.strictEqual(closeFinancialWeek(reopened, { ...record, id: 'wrong' }), reopened);
for (const activeWeek of [{ realIncome: 900 }, { realIncome: 0 }, { income: 0 }, { reserveMovements: record.reserveMovements }, { payments }, { note: 'nota' }, { extraIncome: record.extraIncome }, { variableTransactions: record.variableTransactions }, { openingBalance: 1 }, { totalPaid: 100 }, { custom: 'data' }]) {
  const blocked = { ...data, activeWeek };
  assert.equal(hasFinancialWeekData(activeWeek), true);
  assert.notEqual(getWeekReopenError(blocked, 'old'), '');
  assert.strictEqual(reopenFinancialWeek(blocked, 'old'), blocked);
}
assert.equal(hasFinancialWeekData(null), false);
assert.equal(hasFinancialWeekData({}), false);
assert.equal(hasFinancialWeekData({ pristineFinancialWeek: true, realIncome: 0, income: 0, payments: [], reserveMovements: [] }), false);
assert.equal(hasFinancialWeekData({ pristineFinancialWeek: true, realIncome: 1 }), true);
const empty = { id: 'empty', weekDate: '2026-07-07' };
assert.deepEqual(closeReopenedFinancialWeek(reopenFinancialWeek({ ...data, weeklyRecords: [empty] }, 'empty').activeWeek), empty);
const draft = { income: 0, note: 'original', payments: payments.map((p) => ({ ...p })) };
assert.deepEqual(buildReopenedWeekCorrection(reopened.activeWeek, draft, data.cards), {});
const patch = buildReopenedWeekCorrection(reopened.activeWeek, { ...draft, note: 'corrección' }, data.cards);
assert.deepEqual(patch, { note: 'corrección' });
const corrected = closeReopenedFinancialWeek({ ...reopened.activeWeek, ...patch });
assert.deepEqual(corrected, { ...record, note: 'corrección' });
const paymentPatch = buildReopenedWeekCorrection(reopened.activeWeek, { ...draft, payments: payments.map((p, index) => index === 1 ? { ...p, amount: 250 } : p) }, data.cards);
assert.equal(paymentPatch.totalPaid, 700);
assert.strictEqual(paymentPatch.payments[0], payments[0]);
assert.deepEqual(paymentPatch.payments[2], payments[2]);
assert.throws(() => buildReopenedWeekCorrection(reopened.activeWeek, { ...draft, payments: payments.map((p, index) => index === 2 ? { ...p, amount: 999 } : p) }, data.cards), /reserva/);
for (const income of ['', 'bad', -1, Infinity]) assert.throws(() => buildReopenedWeekCorrection(reopened.activeWeek, { ...draft, income }, data.cards));
const duplicate = { ...data, weeklyRecords: [record, record] };
assert.strictEqual(reopenFinancialWeek(duplicate, 'old'), duplicate);
let raw = JSON.stringify(data);
let fail = false;
globalThis.window = { localStorage: { getItem: () => raw, setItem: (key, value) => { if (fail) throw Error('quota'); raw = value; } } };
fail = true;
assert.equal(saveFinanceData(reopened).ok, false);
assert.deepEqual(JSON.parse(raw), data);
fail = false;
assert.equal(saveFinanceData(reopened).ok, true);
const loaded = loadFinanceData(sampleFinanceData, normalizeFinanceData).data;
assert.equal(loaded.activeWeek.reopenedFromHistory, true);
const changedBudget = { ...loaded, weeklyIncome: 9999, weeklyExpenses: [], monthlyExpenses: [] };
const closed = { ...changedBudget, activeWeek: null, weeklyRecords: [closeReopenedFinancialWeek(changedBudget.activeWeek)] };
assert.equal(saveFinanceData(closed).ok, true);
assert.deepEqual(loadFinanceData(sampleFinanceData, normalizeFinanceData).data.weeklyRecords, [record]);
assert.deepEqual(closed.reserveBuckets, data.reserveBuckets);
console.log('Week reopening and reclosure tests passed');
