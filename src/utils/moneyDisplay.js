import { formatMoney as engineMoney, formatActionMoney as engineActionMoney } from './financeEngine.js';

// Presentation only. Keep persisted amounts and the engine's arithmetic intact.
export function displayMoneyValue(value) {
  const amount = Number(value || 0);
  return Math.abs(amount) < 0.005 ? 0 : amount;
}

export const formatMoney = (value) => engineMoney(displayMoneyValue(value));
export const formatActionMoney = (value) => engineActionMoney(displayMoneyValue(value));
