import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyCoverageStatusToPlans,
  buildCoverageTimeline,
  calculateGemMinimumSummary,
  calculateWeeklyDebtReserve,
  hasValidDueDate,
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

const gemCycleReferenceDate = new Date('2026-06-25T12:00:00');

function makeGemCycleFinanceData(records = []) {
  return {
    weeklyIncome: 500,
    cards: [
      { id: 'gem', name: 'GEM Visa' },
      { id: 'purple', name: 'Purple Visa' },
    ],
    weeklyExpenses: [],
    monthlyExpenses: [],
    variableBudgets: { groceries: 0, fuel: 0 },
    paymentPlans: [
      {
        id: 'gem-plan',
        name: 'GEM plan',
        cardId: 'gem',
        originalAmount: 1000,
        balance: 1000,
        dueDate: '2026-08-01',
        minimumPaymentRule: {
          enabled: true,
          type: 'fixedMonthlyMinimum',
          amount: 100,
          frequency: 'monthly',
        },
      },
    ],
    weeklyRecords: records,
    reserveBuckets: [],
  };
}

function calculateGemPaymentsThisCycle(records = []) {
  return calculateGemMinimumSummary(makeGemCycleFinanceData(records), gemCycleReferenceDate).paymentsThisCycle;
}

function getPlan(summary, planId) {
  return summary.activePlans.find((plan) => plan.id === planId);
}

function assertStatus(summary, planId, expectedStatus) {
  assert.equal(getPlan(summary, planId).coverageStatus, expectedStatus);
}

function assertFiniteNumbers(value, path = 'value') {
  if (typeof value === 'number') {
    assert.equal(Number.isNaN(value), false, `${path} is NaN`);
    assert.equal(Number.isFinite(value), true, `${path} is not finite`);
    return;
  }

  if (!value || typeof value !== 'object') return;

  Object.entries(value).forEach(([key, entry]) => {
    assertFiniteNumbers(entry, `${path}.${key}`);
  });
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
  const records = [
    {
      id: 'week-before-cycle',
      weekStartDate: '2026-06-16',
      payments: [{ id: 'inside-cycle', cardId: 'gem', amount: 40, date: '2026-06-20' }],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 40);
}

{
  const records = [
    {
      id: 'week-inside-cycle',
      weekStartDate: '2026-06-23',
      payments: [{ id: 'outside-cycle', cardId: 'gem', amount: 40, date: '2026-07-20' }],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 0);
}

{
  const records = [
    {
      id: 'legacy-payment-date',
      weekStartDate: '2026-06-23',
      payments: [{ id: 'no-payment-date', cardId: 'gem', amount: 15 }],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 15);
}

{
  const records = [
    {
      id: 'invalid-payment-date',
      weekStartDate: '2026-06-23',
      payments: [{ id: 'bad-payment-date', cardId: 'gem', amount: 25, date: 'not-a-date' }],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 25);
}

{
  const records = [
    {
      id: 'mixed-payment-week',
      weekStartDate: '2026-06-23',
      payments: [
        { id: 'inside-cycle', cardId: 'gem', amount: 30, date: '2026-06-21' },
        { id: 'outside-cycle', cardId: 'gem', amount: 45, date: '2026-07-20' },
      ],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 30);
}

{
  const records = [
    {
      id: 'other-card-payment',
      weekStartDate: '2026-06-23',
      payments: [
        { id: 'gem-payment', cardId: 'gem', amount: 35, date: '2026-06-24' },
        { id: 'purple-payment', cardId: 'purple', amount: 80, date: '2026-06-24' },
      ],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 35);
}

{
  const records = [
    {
      id: 'cycle-boundaries',
      weekStartDate: '2026-06-23',
      payments: [
        { id: 'cycle-start', cardId: 'gem', amount: 10, date: '2026-06-20' },
        { id: 'cycle-end', cardId: 'gem', amount: 20, date: '2026-07-19' },
      ],
    },
  ];

  assert.equal(calculateGemPaymentsThisCycle(records), 30);
}

{
  const baseline = calculateWeeklyDebtReserve(makeGemCycleFinanceData([]), gemCycleReferenceDate);
  const withPayments = calculateWeeklyDebtReserve(
    makeGemCycleFinanceData([
      {
        id: 'payments-do-not-change-interest-free-plan',
        weekStartDate: '2026-06-23',
        payments: [{ id: 'gem-payment', cardId: 'gem', amount: 50, date: '2026-06-24' }],
      },
    ]),
    gemCycleReferenceDate,
  );
  const baselinePlan = getPlan(baseline, 'gem-plan');
  const paymentPlan = getPlan(withPayments, 'gem-plan');

  assert.equal(withPayments.minimumToAvoidExpiry, baseline.minimumToAvoidExpiry);
  assert.equal(withPayments.recommendedPayment, baseline.recommendedPayment);
  assert.equal(paymentPlan.recommendedPayment, baselinePlan.recommendedPayment);
  assert.equal(paymentPlan.rolloverPressure, baselinePlan.rolloverPressure);
  assert.equal(paymentPlan.coverageStatus, baselinePlan.coverageStatus);
  assert.equal(paymentPlan.urgency, baselinePlan.urgency);
  assert.equal(withPayments.gemMinimumSummary.paymentsThisCycle, 50);
}

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
  assert.equal(plan.coverageLabel, 'Sin fecha válida');
  assert.equal(plan.recommendedPayment, 0);
  assert.equal(plan.smartExtraPayment, 0);
  assert.equal(plan.rolloverPressure, 0);
  assert.equal(invalidDate.minimumToAvoidExpiry, 0);
  assert.equal(invalidDate.requiredWeeklyPressure, 0);
  assert.equal(invalidDate.coverageTimeline.length, 0);
  assert.equal(Number.isNaN(plan.recommendedPayment), false);
  assertFiniteNumbers(invalidDate);
}

{
  const noDueDate = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'no-due-date', balance: 100, dueDate: undefined })],
  });

  const plan = getPlan(noDueDate, 'no-due-date');
  assert.equal(plan.coverageStatus, 'unknown');
  assert.equal(plan.coverageReason, 'invalid-due-date');
  assert.equal(plan.recommendedPayment, 0);
  assert.equal(plan.smartExtraPayment, 0);
  assert.equal(plan.rolloverPressure, 0);
  assert.equal(noDueDate.minimumToAvoidExpiry, 0);
  assert.equal(noDueDate.coverageTimeline.length, 0);
  assert.equal(hasValidDueDate(plan), false);
  assertFiniteNumbers(noDueDate);
}

{
  const validOnly = summarize({
    weeklyIncome: 300,
    plans: [makePlan({ id: 'valid-alone', balance: 600, dueDate: '2026-07-28' })],
  });
  const withInvalid = summarize({
    weeklyIncome: 300,
    plans: [
      makePlan({ id: 'valid-alone', balance: 600, dueDate: '2026-07-28' }),
      makePlan({ id: 'invalid-huge', balance: 50000, dueDate: undefined }),
    ],
  });
  const validBaseline = getPlan(validOnly, 'valid-alone');
  const validWithInvalid = getPlan(withInvalid, 'valid-alone');
  const invalidHuge = getPlan(withInvalid, 'invalid-huge');

  assert.equal(withInvalid.minimumToAvoidExpiry, validOnly.minimumToAvoidExpiry);
  assert.equal(withInvalid.requiredWeeklyPressure, validOnly.requiredWeeklyPressure);
  assert.equal(validWithInvalid.recommendedPayment, validBaseline.recommendedPayment);
  assert.equal(validWithInvalid.rolloverPressure, validBaseline.rolloverPressure);
  assert.equal(validWithInvalid.coverageStatus, validBaseline.coverageStatus);
  assert.equal(invalidHuge.coverageStatus, 'unknown');
  assert.equal(invalidHuge.recommendedPayment, 0);
  assert.equal(invalidHuge.smartExtraPayment, 0);
  assert.equal(invalidHuge.rolloverPressure, 0);
  assert.equal(withInvalid.coverageTimeline.length, validOnly.coverageTimeline.length);
  assert.equal(withInvalid.coverageTimeline.some((group) => group.coverageGroupPlanIds.includes('invalid-huge')), false);
  assertFiniteNumbers(withInvalid);
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

{
  const planListSource = readFileSync(new URL('../src/components/PlanList.jsx', import.meta.url), 'utf8');
  const simulatorSource = readFileSync(new URL('../src/components/ScenarioSimulator.jsx', import.meta.url), 'utf8');

  assert.match(planListSource, /Proyección con tu presupuesto semanal actual\./);
  assert.match(planListSource, /Agregá una fecha válida para calcular el pago recomendado y su cobertura\./);
  assert.match(simulatorSource, /El monto simulado se interpreta como un pago semanal recurrente hasta cada vencimiento\./);
}

console.log('financeEngine coverage tests passed');
