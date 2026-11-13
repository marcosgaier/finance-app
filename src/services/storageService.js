import { validateFinanceData } from '../utils/financeDataValidation.js';
const storageKey = 'weekly-finance-planner';

export function loadFinanceData(fallbackData, normalizeData = (data) => data) {
  let raw = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return { data: null, raw, status: 'read-error', dirty: false };
  }
  try {
    const source = raw === null ? fallbackData : JSON.parse(raw);
    validateFinanceData(source);
    const data = normalizeData(source);
    validateFinanceData(data);
    return { data, raw, status: 'ready', dirty: raw === null };
  } catch {
    return { data: null, raw, status: 'incompatible', dirty: false };
  }
}

export function saveFinanceData(financeData) {
  try {
    validateFinanceData(financeData);
    window.localStorage.setItem(storageKey, JSON.stringify(financeData));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function clearFinanceData() {
  window.localStorage.removeItem(storageKey);
}
