import React from 'react';
import { sampleFinanceData } from './data/sampleData.js';
import { useLocalStorageState } from './hooks/useLocalStorageState.js';
import { Dashboard } from './pages/Dashboard.jsx';
import { normalizeFinanceData } from './utils/financeEngine.js';

export default function App() {
  const [financeData, setFinanceData, persistence] = useLocalStorageState(sampleFinanceData, normalizeFinanceData);

  if (persistence.status !== 'ready') {
    const unsaved = persistence.status === 'unsaved';
    function downloadRecovery() {
      const content = unsaved ? JSON.stringify({ type: 'weekly-finance-planner-backup', schemaVersion: 1, appVersion: '1.0.0', exportedAt: new Date().toISOString(), financeData }, null, 2) : persistence.raw;
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = unsaved ? 'finance-cambios-sin-guardar.json' : 'finance-datos-originales.json';
      link.click();
      URL.revokeObjectURL(url);
    }
    return (
      <main className="mx-auto max-w-xl space-y-4 p-5" role="alert">
        <h1 className="text-xl font-bold">{unsaved ? 'Hay cambios sin guardar' : 'Tus datos necesitan una revisión'}</h1>
        <p>{unsaved
          ? 'No pudimos guardar los cambios. Siguen en memoria, pero se perderán si cerrás o refrescás la página. Descargá una copia o reintentá guardar.'
          : 'No pudimos leer o interpretar tus datos con seguridad. No los reemplazamos por datos de ejemplo y bloqueamos los cambios para protegerlos.'}</p>
        <div className="flex flex-wrap gap-3">
          <button className="rounded border px-4 py-2" onClick={persistence.retry}>{unsaved ? 'Reintentar guardado' : 'Reintentar carga'}</button>
          {(unsaved || persistence.raw !== null) && <button className="rounded border px-4 py-2" onClick={downloadRecovery}>{unsaved ? 'Descargar cambios sin guardar' : 'Descargar datos originales'}</button>}
        </div>
        <p className="text-sm">Las copias contienen información financiera privada. Guardalas en un lugar seguro.</p>
      </main>
    );
  }

  return <Dashboard financeData={financeData} setFinanceData={setFinanceData} />;
}
