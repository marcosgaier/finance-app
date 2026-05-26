import { useEffect, useState } from 'react';
import { loadFinanceData, saveFinanceData } from '../services/storageService.js';

export function useLocalStorageState(initialData, normalizeData = (data) => data) {
  const [financeData, setFinanceData] = useState(() => normalizeData(loadFinanceData(initialData)));

  useEffect(() => {
    saveFinanceData(financeData);
  }, [financeData]);

  return [financeData, setFinanceData];
}
