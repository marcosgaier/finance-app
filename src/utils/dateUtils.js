const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;

export function getStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateWeeksUntilDue(dueDate, referenceDate = new Date()) {
  const due = getStartOfDay(new Date(dueDate));
  const today = getStartOfDay(referenceDate);
  return Math.ceil((due.getTime() - today.getTime()) / millisecondsPerWeek);
}

export function formatShortDate(dateValue) {
  return new Intl.DateTimeFormat('es-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateValue));
}

export function formatDateForDisplay(dateValue) {
  if (!dateValue) return '';
  const [year, month, day] = dateValue.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
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
