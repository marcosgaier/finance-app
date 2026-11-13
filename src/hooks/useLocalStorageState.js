import { useEffect, useState } from 'react';
import { loadFinanceData, saveFinanceData } from '../services/storageService.js';

export function useLocalStorageState(initialData, normalizeData = (data) => data) {
  const [session, setSession] = useState(() => loadFinanceData(initialData, normalizeData));

  useEffect(() => {
    if (session.status !== 'ready' || !session.dirty) return;
    const result = saveFinanceData(session.data);
    setSession((current) => current.data !== session.data ? current : {
      ...current, status: result.ok ? 'ready' : 'unsaved', dirty: !result.ok,
    });
  }, [session]);

  function setFinanceData(updater) {
    setSession((current) => current.status !== 'ready' ? current : {
      ...current, data: typeof updater === 'function' ? updater(current.data) : updater, dirty: true,
    });
  }
  return [session.data, setFinanceData, {
    ...session,
    retry: () => setSession((current) => current.status === 'unsaved'
      ? { ...current, status: 'ready', dirty: true }
      : loadFinanceData(initialData, normalizeData)),
  }];
}
