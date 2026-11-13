import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { destinationWeek, parseTauraPreview, previewRows, revisionFor, MAX_PREVIEW_BYTES } from '../src/services/tauraPreview.js';
const source = await readFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), 'utf8');
const fixture = () => JSON.parse(source);
async function rejected(change, pattern = /./) {
  const data = fixture(); change(data);
  await assert.rejects(parseTauraPreview(JSON.stringify(data)), pattern);
}
async function resign(item) { const {revision, ...payload} = item; item.revision = await revisionFor(payload); }

test('exact Taura PR #9 producer fixture, positive and explicit zero, no input mutation', async () => {
  const data = fixture(), before = JSON.stringify(data);
  const preview = await parseTauraPreview(before);
  assert.equal(preview.items.length, 3);
  assert.equal(preview.items[0].netCents, 96400);
  assert.equal(preview.items[1].netCents, 0);
  assert.equal(JSON.stringify(data), before);
});
test('malformed JSON and both apps’ backups are rejected', async () => {
  for (const value of ['{', '', 'null', '[]', '{"type":"weekly-finance-planner-backup"}', '{"type":"taura-backup","schemaVersion":1}']) await assert.rejects(parseTauraPreview(value));
});
test('envelope values and exact allowlist', async () => {
  for (const [key, value] of Object.entries({ type:'other', schemaVersion:2, sourceId:'other-installation', sourceRevision:'v2', currency:'USD', timeZone:'UTC', generatedAt:'2026-11-13' })) await rejected(data => {data[key] = value;});
  for (const key of Object.keys(fixture())) await rejected(data => {delete data[key];});
  await rejected(data => {data.financeData = {};});
});
test('byte and item limits, absent versus explicit zero', async () => {
  await assert.rejects(parseTauraPreview(' '.repeat(MAX_PREVIEW_BYTES + 1)), /grande/);
  await assert.rejects(parseTauraPreview('é'.repeat(MAX_PREVIEW_BYTES / 2 + 1)), /grande/);
  await rejected(data => {data.items = [];});
  await rejected(data => {data.items = Array(105).fill(data.items[0]);});
  await rejected(data => {delete data.items[1].netCents;});
});
test('full item, nested rules, warnings and deduction allowlists', async () => {
  const item = fixture().items[0];
  for (const key of Object.keys(item)) await rejected(data => {delete data.items[0][key];});
  for (const key of Object.keys(item.rulesSnapshot)) await rejected(data => {delete data.items[0].rulesSnapshot[key];});
  for (const key of Object.keys(item.deductions)) await rejected(data => {delete data.items[0].deductions[key];});
  for (const key of Object.keys(item.rulesSnapshot.componentsCents)) await rejected(data => {delete data.items[0].rulesSnapshot.componentsCents[key];});
  await rejected(data => {data.items[0].privateNote = 'excluded';});
  await rejected(data => {data.items[0].warnings.pop();});
  await rejected(data => {data.items[0].warnings[0].message = '';});
  await rejected(data => {data.items[0].warnings[0].code = 'UNKNOWN';});
});
test('invalid/unsafe/fractional/negative amounts, ACC and net arithmetic', async () => {
  for (const value of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1, null, '100']) await rejected(data => {data.items[0].netCents = value;});
  await rejected(data => {data.items[0].deductions.payeIncludesAcc = false;});
  await rejected(data => {data.items[0].deductions.payeCents++;}, /coincide/);
});
test('calendar, worked week, identity, payment, status and fiscal coverage', async () => {
  for (const payDate of ['2026-02-30','2026-09-26','2028-01-01','2026-9-28']) await rejected(data => {data.items[0].payDate = payDate;});
  await rejected(data => {data.items[0].periodStart = '2026-09-21';});
  await rejected(data => {data.items[0].periodEnd = '2026-09-25';});
  await rejected(data => {data.items[0].periodId = 'other';});
  await rejected(data => {data.items[0].status = 'paid';});
  await rejected(data => {data.items[0].workStatus = 'paid';});
  await rejected(data => {data.items[0].rulesSnapshot.taxCode = 'ME';});
  await rejected(data => {data.items[0].rulesSnapshot.studentLoanRequested = 'false';});
  await rejected(data => {data.items[0].rulesSnapshot.bankableHours = -1;});
});
test('revision integrity, deterministic exporter canonical order, not a signature', async () => {
  await rejected(data => {data.items[0].revision = 'sha256:old';});
  await rejected(data => {data.items[0].rulesSnapshot.defaultDayRate++;}, /Revisión/);
  const data = fixture();
  data.items[0] = Object.fromEntries(Object.entries(data.items[0]).reverse());
  assert.equal((await parseTauraPreview(JSON.stringify(data))).items.length, 3);
  data.generatedAt = '2026-11-14T00:00:00.000Z';
  assert.equal((await parseTauraPreview(JSON.stringify(data))).items[0].revision, fixture().items[0].revision);
});
test('identical duplicates collapse; changed content or payDate revision conflicts reject the batch', async () => {
  const data = fixture(); data.items.push(structuredClone(data.items[0]));
  const preview = await parseTauraPreview(JSON.stringify(data));
  assert.equal(preview.duplicates, 1); assert.equal(preview.items.length, 3);
  const changed = data.items.at(-1); changed.payDate = '2026-09-29'; await resign(changed);
  await assert.rejects(parseTauraPreview(JSON.stringify(data)), /Conflicto/);
});
test('successive exports replace whole sessions without ordering opaque revisions', async () => {
  let session = await parseTauraPreview(source);
  const data = fixture(); data.items = [data.items[0]];
  data.items[0].payDate = '2026-09-29'; await resign(data.items[0]);
  session = await parseTauraPreview(JSON.stringify(data));
  assert.equal(session.items.length, 1);
  assert.equal(destinationWeek(session.items[0].payDate).start, '2026-09-29');
});
test('Monday/Tuesday, month/year boundaries and DST are civil-date based', () => {
  for (const [payDate, start, end] of [
    ['2026-09-28','2026-09-22','2026-09-28'], ['2026-09-29','2026-09-29','2026-10-05'],
    ['2027-01-04','2026-12-29','2027-01-04'], ['2027-01-05','2027-01-05','2027-01-11'],
    ['2026-09-27','2026-09-22','2026-09-28'], ['2026-04-05','2026-03-31','2026-04-06'],
  ]) assert.deepEqual(destinationWeek(payDate), {start, end});
});
test('closed, legacy, active and reopened weeks read only; no storage writes on success/failure', async () => {
  let writes = 0;
  globalThis.window = { localStorage: { setItem(){writes++;}, removeItem(){writes++;}, clear(){writes++;} } };
  globalThis.indexedDB = { open(){writes++; throw new Error('Unexpected IDB access');} };
  const preview = await parseTauraPreview(source);
  const records = Object.freeze([Object.freeze({weekDate:'2026-09-22'})]);
  assert.equal(previewRows(preview, records)[0].weekState, 'Semana cerrada');
  assert.equal(previewRows(preview, records, {weekStartDate:'2026-09-22', reopenedFromHistory:true})[0].weekState, 'Semana histórica reabierta');
  assert.equal(previewRows(preview, [], {weekStartDate:'2026-09-22'})[0].weekState, 'Semana activa');
  await assert.rejects(parseTauraPreview('{'));
  assert.equal(writes, 0);
  delete globalThis.window; delete globalThis.indexedDB;
});
