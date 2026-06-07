import { normalizeFinanceData } from '../utils/financeEngine.js';

const BACKUP_TYPE = 'weekly-finance-planner-backup';
const SCHEMA_VERSION = 1;
const APP_VERSION = '1.0.0';
const MAX_BACKUP_SIZE_BYTES = 5 * 1024 * 1024;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function prepareFinanceData(financeData) {
  return {
    ...financeData,
    activeWeek: financeData.activeWeek ?? null,
    weeklyRecords: Array.isArray(financeData.weeklyRecords) ? financeData.weeklyRecords : [],
    reserveBucketMovements: Array.isArray(financeData.reserveBucketMovements)
      ? financeData.reserveBucketMovements
      : [],
  };
}

function validateFinanceData(financeData) {
  if (!isObject(financeData)) {
    throw new Error('El backup no contiene datos financieros válidos.');
  }
  if (!Array.isArray(financeData.cards)) {
    throw new Error('El backup no contiene una lista válida de tarjetas.');
  }
  if (!Array.isArray(financeData.paymentPlans)) {
    throw new Error('El backup no contiene una lista válida de planes.');
  }
  if (!isObject(financeData.variableBudgets)) {
    throw new Error('El backup no contiene presupuestos variables válidos.');
  }
  if (financeData.weeklyRecords !== undefined && !Array.isArray(financeData.weeklyRecords)) {
    throw new Error('El historial semanal del backup no es válido.');
  }
  if (financeData.activeWeek !== undefined && financeData.activeWeek !== null && !isObject(financeData.activeWeek)) {
    throw new Error('La semana activa del backup no es válida.');
  }
}

function buildBackupSummary(financeData) {
  const paymentPlans = financeData.paymentPlans || [];

  return {
    cardCount: (financeData.cards || []).length,
    activePlanCount: paymentPlans.filter((plan) => Number(plan.balance || 0) > 0).length,
    completedPlanCount: paymentPlans.filter((plan) => Number(plan.balance || 0) <= 0).length,
    weeklyRecordCount: (financeData.weeklyRecords || []).length,
    hasActiveWeek: Boolean(financeData.activeWeek),
    reserveBucketCount: (financeData.reserveBuckets || []).length,
  };
}

export function createFinanceBackup(financeData) {
  return {
    type: BACKUP_TYPE,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    financeData,
  };
}

export function downloadFinanceBackup(financeData) {
  const backup = createFinanceBackup(financeData);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = `finance-app-backup-${getLocalIsoDate()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export async function readFinanceBackup(file) {
  if (!file) {
    throw new Error('Seleccioná un archivo JSON para importar.');
  }
  if (file.size > MAX_BACKUP_SIZE_BYTES) {
    throw new Error('El archivo supera el límite de 5 MB.');
  }

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no contiene un JSON válido.');
  }

  if (!isObject(backup)) {
    throw new Error('El contenido raíz del backup no es válido.');
  }
  if (backup.type !== BACKUP_TYPE) {
    throw new Error('El archivo no es un backup válido de Finance App.');
  }
  if (!Number.isInteger(backup.schemaVersion)) {
    throw new Error('El backup no indica una versión de formato válida.');
  }
  if (backup.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Este backup fue creado por una versión más nueva de la app.');
  }
  if (backup.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Esta versión del backup todavía no es compatible.');
  }

  validateFinanceData(backup.financeData);

  const importedCopy = JSON.parse(JSON.stringify(backup.financeData));
  const normalizedFinanceData = normalizeFinanceData(prepareFinanceData(importedCopy));

  validateFinanceData(normalizedFinanceData);

  return {
    fileName: file.name,
    exportedAt: backup.exportedAt || null,
    appVersion: backup.appVersion || 'Desconocida',
    schemaVersion: backup.schemaVersion,
    financeData: normalizedFinanceData,
    summary: buildBackupSummary(normalizedFinanceData),
  };
}
