import React, { useRef, useState } from 'react';
import { formatDisplayDate } from '../utils/dateUtils.js';
import { downloadFinanceBackup, readFinanceBackup } from '../services/backupService.js';

export function SettingsPanel({ financeData, onReplaceFinanceData }) {
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);

  function exportBackup() {
    downloadFinanceBackup(financeData);
    setErrorMessage('');
    setSuccessMessage('Backup exportado correctamente.');
  }

  async function selectBackupFile(event) {
    const [file] = event.target.files || [];
    setImportPreview(null);
    setErrorMessage('');
    setSuccessMessage('');

    if (!file) return;

    setIsReadingFile(true);
    try {
      const preview = await readFinanceBackup(file);
      setImportPreview(preview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo leer el backup.');
      resetFileInput();
    } finally {
      setIsReadingFile(false);
    }
  }

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function cancelImport() {
    setImportPreview(null);
    setErrorMessage('');
    resetFileInput();
  }

  function replaceFinanceData() {
    if (!importPreview) return;

    onReplaceFinanceData(importPreview.financeData);
    setImportPreview(null);
    setErrorMessage('');
    setSuccessMessage('Backup importado. Los datos de este dispositivo fueron reemplazados.');
    resetFileInput();
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Ajustes</p>
        <h2 className="mt-1 text-xl font-semibold text-stone-950">Backup de datos</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Exportá todos tus datos para guardarlos o restaurarlos en otro dispositivo.
        </p>
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Este archivo contiene información financiera privada. Guardalo en un lugar seguro.
        </p>

        <button
          className="mt-4 rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          type="button"
          onClick={exportBackup}
        >
          Exportar backup JSON
        </button>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Importar</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-950">Restaurar desde un backup</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Antes de reemplazar, exportá un backup de los datos actuales si querés conservarlos.
        </p>

        <label className="mt-4 block text-sm font-medium text-stone-700">
          Archivo JSON
          <input
            ref={fileInputRef}
            accept="application/json,.json"
            className="mt-1 block w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:font-semibold file:text-white"
            type="file"
            onChange={selectBackupFile}
          />
        </label>

        {isReadingFile ? (
          <p className="mt-3 text-sm font-medium text-stone-500">Validando backup...</p>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {successMessage}
          </p>
        ) : null}

        {importPreview ? (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Backup listo para importar</p>
              <p className="mt-1 break-all text-sm text-sky-950">{importPreview.fileName}</p>
              <p className="mt-1 text-xs text-sky-800">
                Exportado: {formatBackupDate(importPreview.exportedAt)} · App {importPreview.appVersion} · Formato {importPreview.schemaVersion}
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <PreviewItem label="Tarjetas" value={importPreview.summary.cardCount} />
              <PreviewItem label="Planes activos" value={importPreview.summary.activePlanCount} />
              <PreviewItem label="Planes completados" value={importPreview.summary.completedPlanCount} />
              <PreviewItem label="Semanas cerradas" value={importPreview.summary.weeklyRecordCount} />
              <PreviewItem
                label="Semana activa"
                value={importPreview.summary.hasActiveWeek ? 'Incluida' : 'No incluida'}
              />
              <PreviewItem label="Sobres" value={importPreview.summary.reserveBucketCount} />
            </div>

            <p className="mt-4 rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800">
              La importación reemplazará completamente los datos actuales de este dispositivo.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                type="button"
                onClick={cancelImport}
              >
                Cancelar
              </button>
              <button
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                type="button"
                onClick={replaceFinanceData}
              >
                Reemplazar datos
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PreviewItem({ label, value }) {
  return (
    <div className="rounded-md border border-sky-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-base font-bold text-stone-950">{value}</p>
    </div>
  );
}

function formatBackupDate(dateValue) {
  if (!dateValue) return 'Fecha desconocida';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return formatDisplayDate(dateValue) || 'Fecha desconocida';

  return `${formatDisplayDate(dateValue)} ${date.toLocaleTimeString('es-NZ', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
