// INT-03C1: internal memory-only API. No UI, importer, setters or persistence.
import { buildIncomePlan, nextPlanningTuesday } from './incomePlanning.js';
import { snapshotPlanningExpenses, buildExpensePlan } from './expensePlanning.js';

const clone = value => structuredClone(value);
const signature = value => JSON.stringify(value);
const unreview = assumptions => Object.fromEntries(Object.entries(assumptions)
  .map(([start, review]) => [start, { ...review, reviewed: false }]));

/** A new instance is a new page lifetime. acceptValidated only accepts the
 * existing parseTauraPreview result, never raw JSON. beginImport/discard use the
 * same request generation pattern as TauraIncomePreview; stale completions lose.
 * Returned values are detached. Operational budget fields are allowlisted by
 * snapshotPlanningExpenses; week metadata is also copied through an allowlist.
 */
export function createPlanningSession() {
  let request = 0, state = null;
  const read = () => clone(state);
  const clear = () => { state = null; return ++request; };
  function calculate(next) {
    return { ...next, result: next.stale ? null : buildExpensePlan(next.incomePlan, next.base, next.assumptions) };
  }
  function requireCurrent() {
    if (!state || state.stale) throw new Error('Se requiere una sesión vigente y un snapshot recreado.');
  }
  return {
    read,
    beginImport: clear,
    discard: clear,
    rejectImport(token) { if (token === request) clear(); },
    acceptValidated(token, preview, budget, { nowMs, weekCount = 4, weeklyRecords = [], activeWeek = null } = {}) {
      if (token !== request) return false;
      // Consume each import token once, including failed initialization.
      clear();
      const week = row => row == null ? null : ({ weekStartDate: row.weekStartDate,
        weekDate: row.weekDate, reopenedFromHistory: row.reopenedFromHistory });
      const incomePlan = buildIncomePlan(preview, { startTuesday: nextPlanningTuesday(nowMs), weekCount,
        weeklyRecords: weeklyRecords.map(week), activeWeek: week(activeWeek) });
      const base = snapshotPlanningExpenses(budget);
      state = calculate({ incomePlan, base, assumptions: {}, stale: false });
      return true;
    },
    // Editing never constitutes conscious review. All arrays remain explicit;
    // reviewWeek only confirms a complete, valid set accepted by the pure engine.
    editWeek(start, draft) {
      requireCurrent();
      if (!state.incomePlan.weeks.some(w => w.start === start)) throw new Error('Semana fuera del horizonte.');
      const copy = clone(draft);
      const review = { reviewed: false, adjustments: copy.adjustments,
        assignments: copy.assignments, obligations: copy.obligations };
      state = calculate({ ...state, assumptions: { ...state.assumptions, [start]: review } });
      return read();
    },
    reviewWeek(start) {
      requireCurrent();
      if (!Object.hasOwn(state.assumptions, start)) throw new Error('Faltan supuestos explícitos.');
      const next = calculate({ ...state, assumptions: { ...state.assumptions,
        [start]: { ...state.assumptions[start], reviewed: true } } });
      if (next.result.weeks.find(w => w.start === start).pending.length) throw new Error('Supuestos incompletos o inválidos.');
      state = next;
      return read();
    },
    checkBudget(budget) {
      if (!state) return read();
      if (signature(snapshotPlanningExpenses(budget)) !== signature(state.base)) {
        state = { ...state, stale: true, result: null, assumptions: unreview(state.assumptions) };
      }
      return read();
    },
    // Explicit action only; discard all edits/reviews rather than silently
    // applying a changed operational budget to a previously reviewed scenario.
    rebuildBudget(budget) {
      if (!state) throw new Error('No hay sesión.');
      state = calculate({ ...state, base: snapshotPlanningExpenses(budget), assumptions: {}, stale: false });
      return read();
    },
  };
}
