import { useEffect, useState } from 'react';
import { loadFinanceData, saveFinanceData } from '../services/storageService.js';

export function useLocalStorageState(initialData) {
  const [financeData, setFinanceData] = useState(() => loadFinanceData(initialData));

  useEffect(() => {
    saveFinanceData(financeData);
  }, [financeData]);

  return [financeData, setFinanceData];
}
