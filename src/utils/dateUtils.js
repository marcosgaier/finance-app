const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;

export const DEFAULT_FINANCIAL_WEEK_START_DAY = 2;

export const financialWeekDayOptions = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];

export function getStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalIsoDate(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') {
    return null;
  }

  const [datePart] = dateValue.split('T');
  const parts = datePart.split('-').map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function coerceLocalDate(dateValue) {
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return getStartOfDay(dateValue);
  }

  const localIsoDate = parseLocalIsoDate(dateValue);
  if (localIsoDate) {
    return localIsoDate;
  }

  const parsedDate = new Date(dateValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return getStartOfDay(parsedDate);
  }

  return getStartOfDay(new Date());
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function hasValidFinancialWeekStartDay(value) {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  const day = Number(value);
  return Number.isInteger(day) && day >= 0 && day <= 6;
}

export function getFinancialWeekStartDay(financeData = {}) {
  const configuredDay = financeData?.settings?.financialWeekStartDay;
  return hasValidFinancialWeekStartDay(configuredDay)
    ? Number(configuredDay)
    : DEFAULT_FINANCIAL_WEEK_START_DAY;
}

export function getFinancialWeekDayLabel(dayValue) {
  const day = hasValidFinancialWeekStartDay(dayValue)
    ? Number(dayValue)
    : DEFAULT_FINANCIAL_WEEK_START_DAY;

  return financialWeekDayOptions.find((option) => option.value === day)?.label || 'Martes';
}

export function normalizeIsoDate(dateValue) {
  if (dateValue === null || dateValue === undefined || dateValue === '') {
    return null;
  }

  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return formatIsoDate(getStartOfDay(dateValue));
  }

  if (typeof dateValue === 'string' && dateValue.includes('T')) {
    const parsedDate = new Date(dateValue);
    return Number.isNaN(parsedDate.getTime()) ? null : formatIsoDate(getStartOfDay(parsedDate));
  }

  const localIsoDate = parseLocalIsoDate(dateValue);
  if (localIsoDate) {
    return formatIsoDate(localIsoDate);
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return formatIsoDate(getStartOfDay(parsedDate));
}

export function isSameIsoDate(leftDate, rightDate) {
  const normalizedLeftDate = normalizeIsoDate(leftDate);
  const normalizedRightDate = normalizeIsoDate(rightDate);

  return Boolean(normalizedLeftDate && normalizedRightDate && normalizedLeftDate === normalizedRightDate);
}

export function getIsoDateWeekday(dateValue) {
  const normalizedDate = normalizeIsoDate(dateValue);
  return normalizedDate ? parseLocalIsoDate(normalizedDate)?.getDay() ?? null : null;
}

export function getFinancialWeekStartDate(
  referenceDate = new Date(),
  financialWeekStartDay = DEFAULT_FINANCIAL_WEEK_START_DAY,
) {
  const startDate = coerceLocalDate(referenceDate);
  const startDay = hasValidFinancialWeekStartDay(financialWeekStartDay)
    ? Number(financialWeekStartDay)
    : DEFAULT_FINANCIAL_WEEK_START_DAY;
  const daysSinceStartDay = (startDate.getDay() - startDay + 7) % 7;

  return formatIsoDate(addDays(startDate, -daysSinceStartDay));
}

export function getFinancialWeekStartDateOnOrAfter(
  referenceDate,
  financialWeekStartDay = DEFAULT_FINANCIAL_WEEK_START_DAY,
) {
  const normalizedReferenceDate = normalizeIsoDate(referenceDate);

  if (!normalizedReferenceDate) {
    return null;
  }

  const startDate = coerceLocalDate(normalizedReferenceDate);
  const startDay = hasValidFinancialWeekStartDay(financialWeekStartDay)
    ? Number(financialWeekStartDay)
    : DEFAULT_FINANCIAL_WEEK_START_DAY;
  const daysUntilStartDay = (startDay - startDate.getDay() + 7) % 7;

  return formatIsoDate(addDays(startDate, daysUntilStartDay));
}

export function getNextFinancialWeekStartDate({
  lastWeekStartDate,
  financialWeekStartDay = DEFAULT_FINANCIAL_WEEK_START_DAY,
} = {}) {
  const lastStartDate = parseLocalIsoDate(normalizeIsoDate(lastWeekStartDate));

  if (!lastStartDate) {
    return getFinancialWeekStartDate(new Date(), financialWeekStartDay);
  }

  const startDay = hasValidFinancialWeekStartDay(financialWeekStartDay)
    ? Number(financialWeekStartDay)
    : DEFAULT_FINANCIAL_WEEK_START_DAY;
  const earliestEligibleStart = addDays(lastStartDate, 7);
  const daysUntilStartDay = (startDay - earliestEligibleStart.getDay() + 7) % 7;

  return formatIsoDate(addDays(earliestEligibleStart, daysUntilStartDay));
}

function getClosedRecordCloseDate(closedRecord = {}) {
  return normalizeIsoDate(closedRecord.closedDate) || normalizeIsoDate(closedRecord.closedAt);
}

export function getNextFinancialWeekStartDateAfterClosedRecord({
  closedRecord,
  financialWeekStartDay = DEFAULT_FINANCIAL_WEEK_START_DAY,
} = {}) {
  const weekStartDate = normalizeIsoDate(closedRecord?.weekStartDate || closedRecord?.weekDate);

  if (!weekStartDate) {
    return null;
  }

  const configuredStartDay = hasValidFinancialWeekStartDay(financialWeekStartDay)
    ? Number(financialWeekStartDay)
    : DEFAULT_FINANCIAL_WEEK_START_DAY;
  const closedWeekStartDay = getIsoDateWeekday(weekStartDate);

  if (closedWeekStartDay === configuredStartDay) {
    return getNextFinancialWeekStartDate({
      lastWeekStartDate: weekStartDate,
      financialWeekStartDay: configuredStartDay,
    });
  }

  const closeDate = getClosedRecordCloseDate(closedRecord);

  return (
    getFinancialWeekStartDateOnOrAfter(closeDate, configuredStartDay) ||
    getNextFinancialWeekStartDate({
      lastWeekStartDate: weekStartDate,
      financialWeekStartDay: configuredStartDay,
    })
  );
}

function getRecordWeekStartDate(record = {}) {
  return normalizeIsoDate(record.weekStartDate || record.weekDate);
}

export function getLatestFinancialWeekStartDate(weeklyRecords = []) {
  return (
    weeklyRecords
      .map(getRecordWeekStartDate)
      .filter(Boolean)
      .sort((leftDate, rightDate) => rightDate.localeCompare(leftDate))[0] || null
  );
}

export function getCreatableFinancialWeekStartDate({
  referenceDate = new Date(),
  weeklyRecords = [],
  financialWeekStartDay = DEFAULT_FINANCIAL_WEEK_START_DAY,
} = {}) {
  const latestClosedWeekStartDate = getLatestFinancialWeekStartDate(weeklyRecords);
  const latestClosedRecord = latestClosedWeekStartDate
    ? weeklyRecords.find((record) => isSameIsoDate(record.weekStartDate || record.weekDate, latestClosedWeekStartDate))
    : null;
  const candidateWeekStartDate = latestClosedWeekStartDate
    ? getNextFinancialWeekStartDateAfterClosedRecord({
        closedRecord: latestClosedRecord,
        financialWeekStartDay,
      })
    : getFinancialWeekStartDate(referenceDate, financialWeekStartDay);
  const todayIsoDate = formatIsoDate(coerceLocalDate(referenceDate));

  if (!candidateWeekStartDate) {
    return null;
  }

  return candidateWeekStartDate <= todayIsoDate ? candidateWeekStartDate : null;
}

export function getPendingFinancialWeekStartDate({
  activeWeekStartDate,
  referenceDate = new Date(),
  financialWeekStartDay = DEFAULT_FINANCIAL_WEEK_START_DAY,
} = {}) {
  const normalizedActiveWeekStartDate = normalizeIsoDate(activeWeekStartDate);

  if (!normalizedActiveWeekStartDate) {
    return null;
  }

  const nextWeekStartDate = getNextFinancialWeekStartDate({
    lastWeekStartDate: normalizedActiveWeekStartDate,
    financialWeekStartDay,
  });
  const todayIsoDate = formatIsoDate(coerceLocalDate(referenceDate));

  return nextWeekStartDate <= todayIsoDate ? nextWeekStartDate : null;
}

export function calculateWeeksUntilDue(dueDate, referenceDate = new Date()) {
  const due = getStartOfDay(new Date(dueDate));
  const today = getStartOfDay(referenceDate);
  return Math.ceil((due.getTime() - today.getTime()) / millisecondsPerWeek);
}

export function formatIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateValue) {
  if (!dateValue) return '';
  const dateParts = String(dateValue).split('T')[0].split('-');

  if (dateParts.length === 3) {
    const [year, month, day] = dateParts;
    if (year && month && day) return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return `${String(parsedDate.getDate()).padStart(2, '0')}/${String(parsedDate.getMonth() + 1).padStart(2, '0')}/${parsedDate.getFullYear()}`;
}

export function formatDateForDisplay(dateValue) {
  return formatDisplayDate(dateValue);
}

export function formatShortDate(dateValue) {
  return formatDisplayDate(dateValue);
}

export function parseDisplayDate(displayDate) {
  const [day, month, year] = displayDate.split('/').map((part) => part.trim());
  if (!day || !month || !year || year.length !== 4) return null;

  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsedDate = new Date(`${isoDate}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return null;
  if (parsedDate.getFullYear() !== Number(year)) return null;
  if (parsedDate.getMonth() + 1 !== Number(month)) return null;
  if (parsedDate.getDate() !== Number(day)) return null;

  return isoDate;
}
