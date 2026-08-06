const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;

export function getStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

export function addDaysToIsoDate(dateValue, dayCount) {
  if (!dateValue) return '';

  const [year, month, day] = String(dateValue).split('T')[0].split('-').map((part) => Number(part));
  if (!year || !month || !day) return '';

  const parsedDate = new Date(year, month - 1, day);
  if (Number.isNaN(parsedDate.getTime())) return '';
  if (parsedDate.getFullYear() !== year) return '';
  if (parsedDate.getMonth() + 1 !== month) return '';
  if (parsedDate.getDate() !== day) return '';

  parsedDate.setDate(parsedDate.getDate() + Number(dayCount || 0));
  return formatIsoDate(parsedDate);
}

export function suggestStatementDueDate(statementDate, currentDueDate) {
  if (currentDueDate) return currentDueDate;
  return addDaysToIsoDate(statementDate, 25);
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
