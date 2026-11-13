// INT-03B: pure, ephemeral scenario arithmetic. Never operational cash or advice.
import { civilDate } from './tauraPreview.js';

const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function safe(value) {
  if (value > MAX || value < -MAX) throw new Error('Centavos fuera del rango entero seguro.');
  return Number(value);
}
function cents(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  // Operational amounts are dollars; reject sub-cent values rather than hiding them.
  return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 0.000001 ? rounded : null;
}

/** Allowlist adapter, dollars -> cents. Missing collections stay missing; no
 * legacy templates, weeklyIncome, realIncome, balances or debt rules are read.
 */
export function snapshotPlanningExpenses(data) {
  const rows = list => Array.isArray(list) ? list.map(row => ({
    id: typeof row?.id === 'string' ? row.id : null, amountCents: money(row?.amount),
  })) : null;
  return {
    weekly: rows(data?.weeklyExpenses), monthly: rows(data?.monthlyExpenses),
    variables: ['groceries', 'fuel'].map(id => ({ id, amountCents: money(data?.variableBudgets?.[id]) })),
  };
}

/** incomePlan is the unchanged output of buildIncomePlan, whose preview must
 * first pass parseTauraPreview. assumptions is keyed by week.start. Each week
 * requires reviewed:true, explicit adjustments/assignments/obligations arrays
 * (empty means reviewed none). No defaults imply zero or a completed review.
 * Adjustments replace a base item (targetId) or add a unique expense (id).
 * Assignments have destination 'debt' or 'saving'; a fundingExpenseId denotes
 * funding an already provisioned expense and is informational, not a new exit.
 */
export function buildExpensePlan(incomePlan, base, assumptions = {}) {
  let cumulative = 0;
  const weeks = incomePlan.weeks.map(income => {
    const review = assumptions[income.start];
    const pending = [];
    const items = new Map();
    for (const [group, rows] of Object.entries({ weekly: base?.weekly, monthly: base?.monthly, variables: base?.variables })) {
      if (!Array.isArray(rows)) { pending.push(`base.${group}`); continue; }
      for (const row of rows) {
        const id = row?.id;
        if (typeof id !== 'string' || !id || items.has(id)) { pending.push('base.identity'); continue; }
        items.set(id, { group, amountCents: row.amountCents });
      }
    }
    if (!items.has('groceries') || !items.has('fuel')) pending.push('base.variables');
    if (review?.reviewed !== true) pending.push('review');
    const adjustments = review?.adjustments;
    const adjusted = new Set();
    if (!Array.isArray(adjustments)) pending.push('adjustments');
    else for (const entry of adjustments) {
      const id = entry?.targetId ?? entry?.id;
      if (typeof id !== 'string' || !id || adjusted.has(id) || !cents(entry.amountCents) ||
          (entry.targetId != null ? !items.has(id) : items.has(id))) {
        pending.push('adjustment.invalid'); continue;
      }
      adjusted.add(id);
      items.set(id, { group: items.get(id)?.group ?? 'weekly', amountCents: entry.amountCents });
    }
    const sums = { weekly: 0n, monthly: 0n, variables: 0n };
    for (const [id, item] of items) {
      if (!cents(item.amountCents)) pending.push(`amount.${id}`);
      else sums[item.group] += BigInt(item.amountCents);
    }
    const fixedCents = safe(sums.weekly), variableCents = safe(sums.variables);
    // One rounding after summing monthly cents, using exact rational arithmetic.
    safe(sums.monthly);
    const monthlyProvisionCents = safe((sums.monthly * 7n + 15n) / 30n);
    const expenseCents = safe(BigInt(fixedCents) + BigInt(variableCents) + BigInt(monthlyProvisionCents));
    let debt = 0n, saving = 0n;
    const funding = new Map();
    const fundingDestinations = new Set();
    const identities = new Set(items.keys());
    if (!Array.isArray(review?.assignments)) pending.push('assignments');
    else for (const entry of review.assignments) {
      if (typeof entry?.id !== 'string' || !entry.id || identities.has(entry.id) ||
          !cents(entry.amountCents) || !['debt', 'saving'].includes(entry.destination)) {
        pending.push('assignment.invalid'); continue;
      }
      identities.add(entry.id);
      if (entry.fundingExpenseId != null) {
        const target = items.get(entry.fundingExpenseId);
        if (!target) { pending.push('assignment.unknownExpense'); continue; }
        // Monthly amounts are not weekly capacity. V1 deliberately rejects links
        // rather than assigning per-item shares of the aggregate 7/30 rounding.
        if (target.group === 'monthly') { pending.push('assignment.monthlyFundingUnsupported'); continue; }
        if (!cents(target.amountCents)) { pending.push('assignment.invalidFundingAmount'); continue; }
        const key = JSON.stringify([entry.fundingExpenseId, entry.destination]);
        if (fundingDestinations.has(key)) pending.push('assignment.duplicateFundingDestination');
        fundingDestinations.add(key);
        const total = (funding.get(entry.fundingExpenseId) ?? 0n) + BigInt(entry.amountCents);
        funding.set(entry.fundingExpenseId, total);
        if (total > BigInt(target.amountCents)) pending.push('assignment.excessFunding');
        continue;
      }
      if (entry.destination === 'debt') debt += BigInt(entry.amountCents);
      else saving += BigInt(entry.amountCents);
    }
    const debtCents = safe(debt), savingCents = safe(saving);
    const warnings = structuredClone(income.warnings);
    const obligations = [];
    if (!Array.isArray(review?.obligations)) pending.push('obligations');
    else for (const entry of review.obligations) {
      let validDate = true;
      try { civilDate(entry?.dueDate); } catch { validDate = false; }
      if (entry?.reviewed !== true || !cents(entry.amountCents) || !validDate) {
        pending.push('obligation.unreviewed'); continue;
      }
      // Obligations are timing annotations linked to an expense/assignment,
      // never another amount to subtract or a statement that payment is covered.
      if (!identities.has(entry.targetId)) { pending.push('obligation.unknownTarget'); continue; }
      if (review.reviewed === true) obligations.push({ targetId: entry.targetId,
        dueDate: entry.dueDate, amountCents: entry.amountCents, reviewed: true });
      if (entry.dueDate >= income.start && entry.dueDate <= income.end &&
          (!income.periods.length || income.periods.some(period => entry.dueDate < period.payDate))) {
        warnings.push({ code: 'DUE_BEFORE_PAY_DATE', targetId: entry.targetId, dueDate: entry.dueDate });
      }
    }
    const excluded = income.excludedFromFuture;
    const known = income.incomeState !== 'unknown' && cents(income.knownIncomeCents);
    const state = excluded ? 'excluded' : pending.length ? 'pending-review' : !known ? 'unknown-income' : 'hypothetical';
    const marginCents = state === 'hypothetical'
      ? safe(BigInt(income.knownIncomeCents) - BigInt(expenseCents) - debt - saving) : null;
    cumulative = cumulative === null || marginCents === null ? null : safe(BigInt(cumulative) + BigInt(marginCents));
    return {
      start: income.start, end: income.end, state, excludedFromFuture: excluded,
      incomeState: income.incomeState, coverage: income.coverage, warnings, pending, obligations,
      incomeCents: excluded || !known ? null : income.knownIncomeCents,
      expenses: pending.length ? null : { fixedCents, monthlyProvisionCents, variableCents, totalCents: expenseCents },
      debtCents: pending.length ? null : debtCents, savingCents: pending.length ? null : savingCents,
      marginCents, cumulativeMarginCents: cumulative,
    };
  });
  return {
    kind: 'hypothetical-margins-not-balances', coverage: incomePlan.coverage,
    provenance: { income: { sourceId: incomePlan.sourceId, sourceRevision: incomePlan.sourceRevision },
      expenses: 'read-only-budget-snapshot', adjustments: 'manual-ephemeral' },
    weeks, totalMarginCents: cumulative,
  };
}
