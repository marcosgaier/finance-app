import assert from 'node:assert/strict';
import {
  applyCoverageStatusToPlans,
  buildCoverageTimeline,
  calculateWeeklyDebtReserve,
  isPastDueDate,
} from '../src/utils/financeEngine.js';

const referenceDate = new Date('2026-07-14T12:00:00');

function makePlan(patch) {
  return {
    id: patch.id,
    name: patch.name || patch.id,
    cardId: 'gem',
    originalAmount: patch.balance,
    balance: patch.balance,
    thirdPartyContribution: patch.thirdPartyContribution || 0,
    dueDate: patch.dueDate,
    minimumPaymentRule: null,
  };
}

function makeFinanceData({ weeklyIncome, plans }) {
  return {
    weeklyIncome,
    cards: [{ id: 'gem', name: 'GEM Visa' }],
    weeklyExpenses: [
      { id: 'rent', name: 'Alquiler', amount: 0 },
      { id: 'argentina-card', name: 'Tarjeta Argentina', amount: 0 },
    ],
    monthlyExpenses: [{ id: 'netflix', name: 'Netflix', amount: 0 }],
    variableBudgets: { groceries: 0, fuel: 0 },
    paymentPlans: plans,
    weeklyRecords: [],
    reserveBuckets: [],
  };
}

function summarize({ weeklyIncome, plans }) {
  return calculateWeeklyDebtReserve(makeFinanceData({ weeklyIncome, plans }), referenceDate);
}

function getPlan(summary, planId) {
  return summary.activePlans.find((plan) => plan.id === planId);
}

function assertStatus(summary, planId, expectedStatus) {
  assert.equal(getPlan(summary, planId).coverageStatus, expectedStatus);
}

function buildSingleTimeline({ dueDate, balance = 100, capacity = 300 }) {
  return buildCoverageTimeline({
    plans: [{ id: dueDate || 'no-date', adjustedBalance: balance, dueDate }],
    affordableWeeklyCapacity: capacity,
    currentDebtFunds: 0,
    referenceDate,
  });
}

assert.equal(isPastDueDate('2026-07-13', referenceDate), true);
assert.equal(isPastDueDate('2026-07-14', referenceDate), false);
assert.equal(isPastDueDate('2026-07-15', referenceDate), false);

{
  const today = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'today', balance: 100, dueDate: '2026-07-14' })],
  });

  assertStatus(today, 'today', 'covered');
  assert.equal(getPlan(today, 'today').coverageGap, 0);
  assert.equal(getPlan(today, 'today').paymentOpportunities, 1);
}

{
  const overdue = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'overdue', balance: 100, dueDate: '2026-07-13' })],
  });

  assertStatus(overdue, 'overdue', 'overdue');
  assert.equal(getPlan(overdue, 'overdue').paymentOpportunities, 0);
}

{
  assert.equal(buildSingleTimeline({ dueDate: '2026-07-15' })[0].paymentOpportunities, 1);
  assert.equal(buildSingleTimeline({ dueDate: '2026-07-20' })[0].paymentOpportunities, 1);
  assert.equal(buildSingleTimeline({ dueDate: '2026-07-21' })[0].paymentOpportunities, 1);
  assert.equal(buildSingleTimeline({ dueDate: '2026-07-22' })[0].paymentOpportunities, 2);
}

{
  const timeline = buildSingleTimeline({ dueDate: 'not-a-date' });
  assert.equal(timeline.length, 0);

  const invalidDate = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'invalid-date', balance: 100, dueDate: 'not-a-date' })],
  });

  const plan = getPlan(invalidDate, 'invalid-date');
  assert.equal(plan.coverageStatus, 'unknown');
  assert.equal(plan.coverageReason, 'invalid-due-date');
  assert.equal(Number.isNaN(plan.recommendedPayment), false);
}

{
  const noDueDate = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'no-due-date', balance: 100, dueDate: undefined })],
  });

  const plan = getPlan(noDueDate, 'no-due-date');
  assert.equal(plan.coverageStatus, 'unknown');
  assert.equal(plan.coverageReason, 'invalid-due-date');
}

{
  const covered = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'covered', balance: 800, dueDate: '2026-08-11' })],
  });

  assertStatus(covered, 'covered', 'covered');
  assert.equal(getPlan(covered, 'covered').urgency, 'urgent');
}

{
  const tight = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'tight', balance: 1000, dueDate: '2026-08-11' })],
  });

  assertStatus(tight, 'tight', 'tight');
}

{
  const risk = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'risk', balance: 1400, dueDate: '2026-08-11' })],
  });

  assertStatus(risk, 'risk', 'at-risk');
  assert.equal(getPlan(risk, 'risk').coverageGap, 200);
}

{
  const thirdParty = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'third-party', balance: 100, thirdPartyContribution: 100, dueDate: '2026-07-13' })],
  });

  const plan = getPlan(thirdParty, 'third-party');
  assert.equal(plan.coverageStatus, 'covered');
  assert.equal(plan.coverageReason, 'third-party-covered');
  assert.equal(plan.coverageRatio, null);
  assert.equal(plan.surplusWeeks, null);
}

{
  const sameDate = summarize({
    weeklyIncome: 250,
    plans: [
      makePlan({ id: 'same-a', balance: 600, dueDate: '2026-08-18' }),
      makePlan({ id: 'same-b', balance: 700, dueDate: '2026-08-18' }),
    ],
  });

  assertStatus(sameDate, 'same-a', 'at-risk');
  assertStatus(sameDate, 'same-b', 'at-risk');
  assert.equal(getPlan(sameDate, 'same-a').coverageGap, 50);
  assert.deepEqual(getPlan(sameDate, 'same-a').coverageGroupPlanIds.sort(), ['same-a', 'same-b']);
  assert.equal(getPlan(sameDate, 'same-a').requiredCumulativeByDue, 1300);
  assert.equal(getPlan(sameDate, 'same-b').projectedFundsByDue, 1250);
}

{
  const farRisk = summarize({
    weeklyIncome: 250,
    plans: [makePlan({ id: 'far-risk', balance: 7000, dueDate: '2026-12-01' })],
  });

  assert.equal(getPlan(farRisk, 'far-risk').urgency, 'calm');
  assertStatus(farRisk, 'far-risk', 'at-risk');
}

{
  const urgentCovered = summarize({
    weeklyIncome: 250,
    plans: [makePlan({ id: 'urgent-covered', balance: 100, dueDate: '2026-07-28' })],
  });

  assert.equal(getPlan(urgentCovered, 'urgent-covered').urgency, 'urgent');
  assertStatus(urgentCovered, 'urgent-covered', 'covered');
}

{
  const zeroCapacity = summarize({
    weeklyIncome: 0,
    plans: [makePlan({ id: 'zero-capacity', balance: 100, dueDate: '2026-07-28' })],
  });
  const negativeCapacity = summarize({
    weeklyIncome: -50,
    plans: [makePlan({ id: 'negative-capacity', balance: 100, dueDate: '2026-07-28' })],
  });

  assertStatus(zeroCapacity, 'zero-capacity', 'at-risk');
  assertStatus(negativeCapacity, 'negative-capacity', 'at-risk');
  assert.equal(zeroCapacity.effectiveAffordableCapacity, 0);
  assert.equal(negativeCapacity.effectiveAffordableCapacity, 0);
  assert.equal(negativeCapacity.affordableWeeklyCapacityRaw, -50);
}

{
  const cumulative = summarize({
    weeklyIncome: 300,
    plans: [
      makePlan({ id: 'early', balance: 600, dueDate: '2026-07-28' }),
      makePlan({ id: 'late', balance: 1000, dueDate: '2026-08-11' }),
    ],
  });

  assertStatus(cumulative, 'early', 'tight');
  assertStatus(cumulative, 'late', 'at-risk');
  assert.equal(getPlan(cumulative, 'late').requiredCumulativeByDue, 1600);
}

{
  const plans = [
    { id: 'paid', adjustedBalance: 100, dueDate: '2026-07-28' },
  ];
  const withoutPayments = buildCoverageTimeline({
    plans,
    affordableWeeklyCapacity: 100,
    currentDebtFunds: 0,
    referenceDate,
  });
  const withIrrelevantPayments = buildCoverageTimeline({
    plans,
    affordableWeeklyCapacity: 100,
    currentDebtFunds: 0,
    referenceDate,
  });

  assert.deepEqual(withoutPayments, withIrrelevantPayments);
}

{
  const stable = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'stable', balance: 1200, dueDate: '2026-08-11' })],
  });
  const plan = getPlan(stable, 'stable');

  assert.equal(plan.urgency, 'urgent');
  assert.equal(plan.recommendedPayment, 300);

  const coverage = applyCoverageStatusToPlans({
    plans: [plan],
    affordableWeeklyCapacity: 300,
    referenceDate,
  }).plans[0];

  assert.equal(coverage.urgency, plan.urgency);
  assert.equal(coverage.recommendedPayment, plan.recommendedPayment);
  assert.equal(coverage.rolloverPressure, plan.rolloverPressure);
  assert.equal(coverage.smartExtraPayment, plan.smartExtraPayment);
}

console.log('financeEngine coverage tests passed');
