import React from 'react';
import { sampleFinanceData } from './data/sampleData.js';
import { useLocalStorageState } from './hooks/useLocalStorageState.js';
import { Dashboard } from './pages/Dashboard.jsx';
import { normalizeFinanceData } from './utils/financeEngine.js';

export default function App() {
  const [financeData, setFinanceData] = useLocalStorageState(sampleFinanceData, normalizeFinanceData);

  return <Dashboard financeData={financeData} setFinanceData={setFinanceData} />;
}
