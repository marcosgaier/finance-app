// INT-03A: calendar and known estimates only. No operational finance or storage.
import { civilDate, destinationWeek } from './tauraPreview.js';

const DAY = 86400000;
const fail = message => { throw new Error(message); };

function addDays(value, days) {
  const date = civilDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  civilDate(result); // Reject horizons outside the four-digit civil calendar.
  return result;
}

/** Strictly next Tuesday in NZ, including +7 days when today is Tuesday.
 * The caller supplies an instant (epoch milliseconds); no implicit system clock.
 */
export function nextPlanningTuesday(nowMs) {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime())) {
    fail('Reloj inválido: se requieren milisegundos desde epoch.');
  }
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const part = type => parts.find(entry => entry.type === type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return addDays(today, (2 - civilDate(today).getUTCDay() + 7) % 7 || 7);
}

function safeSum(total, cents) {
  const sum = total + cents;
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(sum)) {
    fail('La suma de centavos excede el rango entero seguro.');
  }
  return sum;
}

/**
 * preview MUST be the result of await parseTauraPreview(text). That validator
 * owns schema/hash validation, identical duplicate removal and conflict rejection.
 * Each invocation replaces the entire calculation; never merge preview sessions.
 * weeklyRecords/activeWeek accept only read-only Finance week metadata (including
 * legacy weekDate). realIncome is deliberately never read or reconciled.
 */
export function buildIncomePlan(preview, { startTuesday, weekCount = 4, weeklyRecords = [], activeWeek = null } = {}) {
  if (civilDate(startTuesday).getUTCDay() !== 2) fail('El inicio debe ser un martes civil.');
  if (!Number.isInteger(weekCount) || weekCount < 4 || weekCount > 8) fail('El horizonte debe ser entero entre 4 y 8 semanas.');
  const recordedStart = record => record?.weekStartDate || record?.weekDate;
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const start = addDays(startTuesday, index * 7);
    const active = recordedStart(activeWeek) === start;
    const closed = weeklyRecords.some(record => recordedStart(record) === start);
    const weekState = active && activeWeek.reopenedFromHistory ? 'reopened' : closed ? 'closed' : active ? 'active' : 'unregistered';
    return {
      start, end: addDays(start, 6), weekState,
      readOnly: true, excludedFromFuture: weekState !== 'unregistered',
      incomeState: 'unknown', coverage: 'unknown', knownIncomeCents: null,
      periodCount: 0, periods: [], warnings: [],
    };
  });
  const byStart = new Map(weeks.map(week => [week.start, week]));
  const outsidePeriods = [];
  for (const item of preview.items) {
    const destination = destinationWeek(item.payDate);
    // Detached metadata: callers cannot mutate the validated session via output.
    const period = structuredClone(item);
    const week = byStart.get(destination.start);
    if (!week) {
      outsidePeriods.push({ ...period, destinationWeek: destination, position: item.payDate < startTuesday ? 'before' : 'after' });
      continue;
    }
    week.knownIncomeCents = safeSum(week.knownIncomeCents ?? 0, item.netCents);
    week.periods.push(period);
  }
  let knownIncomeCents = 0, eligibleKnownIncomeCents = 0;
  for (const week of weeks) {
    week.periodCount = week.periods.length;
    if (!week.periodCount) continue;
    week.incomeState = week.knownIncomeCents === 0 ? 'explicit-zero' : 'estimated';
    week.coverage = 'partial';
    week.warnings.push({ code: 'PARTIAL_SELECTION', message: 'El archivo seleccionado no garantiza todos los cobros de la semana.' });
    if (week.periods.some(period => period.netCents === 0)) {
      week.warnings.push({ code: 'ZERO_MAY_BE_INCOMPLETE_ROSTER', message: 'Un neto proyectado cero puede reflejar un roster incompleto; no confirma ausencia de sueldo ni cobro.' });
    }
    knownIncomeCents = safeSum(knownIncomeCents, week.knownIncomeCents);
    if (!week.excludedFromFuture) eligibleKnownIncomeCents = safeSum(eligibleKnownIncomeCents, week.knownIncomeCents);
  }
  return {
    startTuesday, endMonday: weeks.at(-1).end, weekCount,
    sourceId: preview.sourceId, sourceRevision: preview.sourceRevision,
    generatedAt: preview.generatedAt, currency: preview.currency, timeZone: preview.timeZone,
    status: 'estimated', coverage: 'partial',
    warnings: [{ code: 'ESTIMATES_NOT_CASH', message: 'Estimaciones parciales, no cobros confirmados ni dinero disponible.' }],
    weeks, outsidePeriods, outsidePeriodCount: outsidePeriods.length,
    totals: {
      knownIncomeCents, eligibleKnownIncomeCents,
      periodCount: weeks.reduce((count, week) => count + week.periodCount, 0),
      weeksWithItems: weeks.filter(week => week.periodCount > 0).length,
      unknownWeekCount: weeks.filter(week => week.incomeState === 'unknown').length,
      excludedWeekCount: weeks.filter(week => week.excludedFromFuture).length,
    },
  };
}
