const storageKey = 'weekly-finance-planner';

export function loadFinanceData(fallbackData) {
  try {
    const storedData = window.localStorage.getItem(storageKey);
    return storedData ? JSON.parse(storedData) : fallbackData;
  } catch {
    return fallbackData;
  }
}

export function saveFinanceData(financeData) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(financeData));
  } catch {
    // Keep the app usable even if localStorage is unavailable or full.
  }
}

export function clearFinanceData() {
  window.localStorage.removeItem(storageKey);
}
