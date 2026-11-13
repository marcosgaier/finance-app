// Read-only consumer of Taura PR #9, contract at 5cbceda6. No storage imports.
export const MAX_PREVIEW_BYTES = 1024 * 1024;
export const WARNING_CODES = ['ESTIMATED_ONLY', 'HOLIDAYS_UNMODELED', 'WEEKEND_PENDING', 'TAX_LIMITED', 'HOURS_BANK', 'CURRENT_RULES', 'SOURCE_NOT_UNIQUE'];
const DAY = 86400000;
const fail = (message) => { throw new Error(message); };
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(`${label}: campos ausentes o no permitidos.`);
  // Canonical exporter insertion order, independent of JSON whitespace/key order.
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}
function exact(value, expected, label) { if (value !== expected) fail(`${label}: valor no soportado.`); }
function text(value, label, max = 300) { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label}: texto inválido.`); }
function nonnegative(value, label, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer ? !Number.isSafeInteger(value) : value > Number.MAX_SAFE_INTEGER)) fail(`${label}: importe o parámetro inválido.`);
}
export function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Fecha civil inválida (YYYY-MM-DD).');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('Fecha civil inexistente.');
  return date;
}
const iso = date => date.toISOString().slice(0, 10);
export function destinationWeek(payDate) {
  const date = civilDate(payDate);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 5) % 7);
  return { start: iso(date), end: iso(new Date(date.getTime() + 6 * DAY)) };
}
export async function revisionFor(payload) {
  if (!globalThis.crypto?.subtle) fail('La validación SHA-256 requiere HTTPS o localhost y un navegador compatible.');
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  return `sha256:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
const ITEM_KEYS = ['periodId', 'periodStart', 'periodEnd', 'payDate', 'status', 'workStatus', 'grossCents', 'deductions', 'netCents', 'rulesSnapshot', 'warnings', 'revision'];
const RULE_KEYS = ['engineVersion', 'taxCode', 'taxYear', 'kiwiSaverRate', 'configuredTaxCode', 'studentLoanRequested', 'defaultDayRate', 'nightAllowanceRate', 'weekendAllowanceRate', 'weekendEffectiveFrom', 'overtimeThresholdHours', 'overtimeMultiplier', 'bankableHours', 'componentsCents', 'dateBasis', 'rounding', 'historicalSnapshot'];
async function validateItem(raw) {
  const item = object(raw, ITEM_KEYS, 'Período');
  const start = civilDate(item.periodStart), end = civilDate(item.periodEnd);
  civilDate(item.payDate);
  if (start.getUTCDay() !== 0 || end - start !== 6 * DAY || item.payDate <= item.periodEnd) fail('Período: requiere domingo–sábado y cobro posterior.');
  exact(item.periodId, `taura:weekly:${item.periodStart}`, 'Identidad del período');
  exact(item.status, 'estimated', 'Estado (solo estimado / no cobrado)');
  if (!['projected', 'partially_worked', 'worked'].includes(item.workStatus)) fail('Estado de trabajo inválido.');
  for (const key of ['grossCents', 'netCents']) nonnegative(item[key], key, true);
  item.deductions = object(item.deductions, ['payeCents', 'kiwiSaverCents', 'payeIncludesAcc'], 'Deducciones');
  nonnegative(item.deductions.payeCents, 'PAYE', true);
  nonnegative(item.deductions.kiwiSaverCents, 'KiwiSaver', true);
  exact(item.deductions.payeIncludesAcc, true, 'ACC incluido en PAYE');
  if (item.grossCents - item.deductions.payeCents - item.deductions.kiwiSaverCents !== item.netCents) fail('Bruto menos deducciones no coincide con neto.');
  const rules = object(item.rulesSnapshot, RULE_KEYS, 'Reglas');
  item.rulesSnapshot = rules;
  exact(rules.engineVersion, 'taura-payroll-d58ad29', 'Motor');
  exact(rules.taxCode, 'M', 'Código fiscal');
  exact(rules.taxYear, '2026-27', 'Año fiscal');
  if (item.payDate < '2026-04-01' || item.payDate > '2027-03-31') fail('Cobro fuera de cobertura fiscal 2026-27.');
  for (const key of ['kiwiSaverRate', 'defaultDayRate', 'nightAllowanceRate', 'weekendAllowanceRate', 'overtimeMultiplier', 'bankableHours']) nonnegative(rules[key], key);
  if (rules.configuredTaxCode !== null) text(rules.configuredTaxCode, 'Código configurado', 40);
  if (typeof rules.studentLoanRequested !== 'boolean') fail('Student Loan inválido.');
  civilDate(rules.weekendEffectiveFrom);
  exact(rules.overtimeThresholdHours, 40, 'Umbral overtime');
  exact(rules.dateBasis, 'shift-start-local-civil', 'Base de fechas');
  exact(rules.rounding, 'existing-engine-cents', 'Redondeo');
  exact(rules.historicalSnapshot, false, 'Snapshot histórico');
  rules.componentsCents = object(rules.componentsCents, ['base', 'night', 'weekend', 'enhancedPayment'], 'Componentes');
  for (const [key, value] of Object.entries(rules.componentsCents)) nonnegative(value, key, true);
  if (!Array.isArray(item.warnings) || item.warnings.length !== WARNING_CODES.length) fail('Advertencias de cobertura incompletas.');
  item.warnings = item.warnings.map((rawWarning, index) => {
    const warning = object(rawWarning, ['code', 'message'], 'Advertencia');
    exact(warning.code, WARNING_CODES[index], 'Código de advertencia');
    text(warning.message, 'Advertencia', 1000);
    return warning;
  });
  if (typeof item.revision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(item.revision)) fail('Revisión SHA-256 inválida.');
  const { revision, ...payload } = item;
  if (await revisionFor(payload) !== revision) fail('Revisión no coincide con el contenido; archivo corrupto o conflicto.');
  return item;
}
export async function parseTauraPreview(content) {
  if (typeof content !== 'string' || new TextEncoder().encode(content).length > MAX_PREVIEW_BYTES) fail('Archivo demasiado grande (máximo 1 MiB).');
  let raw;
  try { raw = JSON.parse(content); } catch { fail('JSON inválido o corrupto.'); }
  if (raw?.type !== 'taura-income-projections') fail('Seleccioná una exportación Taura de ingresos estimados; los backups no son compatibles.');
  const data = object(raw, ['type', 'schemaVersion', 'sourceId', 'sourceRevision', 'currency', 'timeZone', 'generatedAt', 'items'], 'Archivo');
  for (const [key, value] of Object.entries({schemaVersion: 1, sourceId: 'taura-local', sourceRevision: 'taura-payroll-d58ad29/export-v1', currency: 'NZD', timeZone: 'Pacific/Auckland'})) exact(data[key], value, key);
  if (typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt)) || new Date(data.generatedAt).toISOString() !== data.generatedAt) fail('Fecha de generación UTC inválida.');
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 104) fail('Seleccioná entre 1 y 104 períodos.');
  const seen = new Map();
  let duplicates = 0;
  for (const rawItem of data.items) {
    const item = await validateItem(rawItem);
    if (seen.has(item.periodId)) {
      if (seen.get(item.periodId).revision !== item.revision) fail('Conflicto: revisiones distintas del mismo período. No se puede inferir cuál es más reciente. Exportá una única revisión.');
      duplicates++;
    } else seen.set(item.periodId, item);
  }
  return { ...data, items: [...seen.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart)), duplicates };
}
export function previewRows(preview, weeklyRecords = [], activeWeek = null) {
  return preview.items.map(item => {
    const week = destinationWeek(item.payDate);
    const matches = record => (record?.weekStartDate || record?.weekDate) === week.start;
    const reopened = matches(activeWeek) && Boolean(activeWeek.reopenedFromHistory);
    return { ...item, week, weekState: reopened ? 'Semana histórica reabierta' : weeklyRecords.some(matches) ? 'Semana cerrada' : matches(activeWeek) ? 'Semana activa' : 'Sin semana registrada' };
  });
}
