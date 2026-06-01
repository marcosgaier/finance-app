export const WEEKLY_INCOME_SOURCE = 'weekly-income';

export function getFundingSource(itemOrSource) {
  if (typeof itemOrSource === 'string') return itemOrSource || WEEKLY_INCOME_SOURCE;
  return itemOrSource?.fundingSource || WEEKLY_INCOME_SOURCE;
}

export function isWeeklyIncomeFunded(itemOrSource) {
  return getFundingSource(itemOrSource) === WEEKLY_INCOME_SOURCE;
}

export function isReserveFunded(itemOrSource) {
  return getFundingSource(itemOrSource) !== WEEKLY_INCOME_SOURCE;
}

export function getFundingSourceLabel(sourceId, reserveBuckets = []) {
  const fundingSource = getFundingSource(sourceId);
  if (fundingSource === WEEKLY_INCOME_SOURCE) return 'semana actual';
  return reserveBuckets.find((bucket) => bucket.id === fundingSource)?.name || 'reserva';
}
