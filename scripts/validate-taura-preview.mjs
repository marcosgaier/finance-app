// Run against a local production build; exclusively synthetic, nonpersistent browser profile.
// PLAYWRIGHT_MODULE can point to an external Playwright installation (no project dependency).
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sampleFinanceData } from '../src/data/sampleData.js';
import { revisionFor } from '../src/services/tauraPreview.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const fixture = JSON.parse(await readFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), 'utf8'));
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname), 'Only localhost synthetic validation is allowed');
const output = new URL('../docs/validation/', import.meta.url);
await mkdir(output, { recursive: true });
const finance = structuredClone(sampleFinanceData);
finance.weeklyRecords = [{id:'synthetic-closed', weekStartDate:'2026-09-22', weekDate:'2026-09-22', realIncome:50, income:50, payments:[], extraIncome:[], variableTransactions:[], reserveMovements:[]}];
finance.activeWeek = {id:'synthetic-active', weekStartDate:'2026-10-06', weekDate:'2026-10-06', realIncome:25, income:25, payments:[], extraIncome:[], variableTransactions:[], reserveMovements:[]};
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox'] });
const context = await browser.newContext({timezoneId:'Pacific/Auckland', viewport:{width:1280,height:900}, serviceWorkers:'block'});
const errors = [], outbound = [];
await context.route('**/*', route => {
  if (new URL(route.request().url()).origin === new URL(baseURL).origin) return route.continue();
  outbound.push(route.request().url()); return route.abort();
});
await context.addInitScript(({finance}) => {
  if (!localStorage.getItem('weekly-finance-planner')) localStorage.setItem('weekly-finance-planner', JSON.stringify(finance));
  window.__writes = [];
  for (const method of ['setItem','removeItem','clear']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function(...args) { window.__writes.push(`Storage.${method}`); return original.apply(this,args); };
  }
  for (const method of ['put','add','delete','clear']) {
    const original = IDBObjectStore.prototype[method];
    IDBObjectStore.prototype[method] = function(...args) { window.__writes.push(`IDB.${method}`); return original.apply(this,args); };
  }
  for (const method of ['open','deleteDatabase']) {
    const original = IDBFactory.prototype[method];
    IDBFactory.prototype[method] = function(...args) { window.__writes.push(`IDBFactory.${method}`); return original.apply(this,args); };
  }
  const OriginalChannel = window.BroadcastChannel;
  window.BroadcastChannel = class extends OriginalChannel {
    constructor(...args) { window.__writes.push('BroadcastChannel'); super(...args); }
  };
}, {finance});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
await page.clock.install({time:new Date('2026-11-13T21:00:00.000Z')});
const checks = [];
async function check(name, action) { await action(); checks.push(name); }
const snapshot = () => page.evaluate(async () => ({
  local: {...localStorage}, session:{...sessionStorage}, databases:await indexedDB.databases(), writes:[...window.__writes],
}));
const upload = async data => {
  await page.locator('#taura-file').setInputFiles({name:'synthetic.json', mimeType:'application/json', buffer:Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))});
};
const preview = page.getByTestId('taura-preview');
const expectText = async (locator, text) => { await locator.getByText(text, {exact:false}).first().waitFor(); };
try {
  await page.goto(baseURL);
  await page.getByRole('button', {name:'Estimaciones Taura', exact:true}).waitFor();
  const dashboard = await page.locator('main').innerText();
  const before = await snapshot();
  assert.deepEqual(before.writes, []);
  await page.getByRole('button', {name:'Estimaciones Taura', exact:true}).click();
  await check('actual producer JSON → rendered preview, Monday/Tuesday/DST/year mapping, closed and active flags, zero net', async () => {
    await upload(fixture);
    await expectText(preview, '3 períodos únicos');
    await expectText(preview, '2026-09-22 → 2026-09-28');
    await expectText(preview, '2026-10-06 → 2026-10-12');
    await expectText(preview, '2026-12-29 → 2027-01-04');
    await expectText(preview, 'Semana cerrada'); await expectText(preview, 'Semana activa');
    assert.equal(await preview.locator('article').count(), 3);
    assert.match(await preview.locator('article').nth(1).innerText(), /0[,.]00/);
    await preview.locator('summary').first().click();
    await expectText(preview, 'Feriados');
    await page.screenshot({path:new URL('int-02b-preview-desktop.png', output).pathname, fullPage:true});
  });
  await check('session retained across tabs, dashboard totals unchanged', async () => {
    await page.getByRole('button', {name:'Dashboard', exact:true}).click();
    // The preview remains mounted but hidden; compare only visible dashboard text.
    const current = await page.locator('main').innerText();
    assert.equal(current, dashboard);
    await page.getByRole('button', {name:'Estimaciones Taura', exact:true}).click();
    await expectText(preview, '3 períodos únicos');
  });
  await check('same revision deduplicates, distinct revisions reject entire batch', async () => {
    const data = structuredClone(fixture); data.items.push(structuredClone(data.items[0]));
    await upload(data); await expectText(preview, '1 repeticiones idénticas omitidas');
    data.items.at(-1).payDate = '2026-09-29';
    const {revision, ...payload} = data.items.at(-1); data.items.at(-1).revision = await revisionFor(payload);
    await upload(data); await expectText(page.getByRole('alert'), 'Conflicto');
    assert.equal(await preview.count(), 0);
    await page.screenshot({path:new URL('int-02b-preview-conflict.png', output).pathname, fullPage:true});
  });
  await check('whole-session replacement; older generatedAt is informational and not accumulated', async () => {
    const data = structuredClone(fixture); data.items = [data.items[1]]; data.generatedAt = '2026-10-01T00:00:00.000Z';
    await upload(data); await expectText(preview, '1 períodos únicos');
    assert.equal(await preview.locator('article').count(), 1);
    await expectText(preview, 'Generación antigua');
  });
  await check('backups, corruption and oversize fail visibly; successful retry', async () => {
    for (const data of ['{', {type:'weekly-finance-planner-backup',financeData:finance}, {type:'taura-backup'}, ' '.repeat(1024*1024+1)]) {
      await upload(data); await page.getByRole('alert').waitFor(); assert.equal(await preview.count(), 0);
    }
    const data = structuredClone(fixture); data.items[0].revision = 'sha256:'+'0'.repeat(64);
    await upload(data); await expectText(page.getByRole('alert'), 'Revisión');
    await upload(fixture); await expectText(preview, '3 períodos únicos');
  });
  await check('discard during asynchronous validation cannot restore discarded estimates', async () => {
    await page.evaluate(() => {
      const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
      window.__originalDigest = originalDigest;
      crypto.subtle.digest = async (...args) => {
        crypto.subtle.digest = originalDigest;
        await new Promise(resolve => {window.__releaseDigest = resolve;});
        return originalDigest(...args);
      };
    });
    await upload(fixture);
    await page.waitForFunction(() => Boolean(window.__releaseDigest));
    await page.getByRole('button', {name:'Descartar vista previa',exact:true}).click();
    await page.evaluate(() => window.__releaseDigest());
    await page.waitForFunction(() => document.querySelector('#taura-file').value === '');
    // Await a later normal selection; a stale prior promise must never win.
    const data = structuredClone(fixture); data.items = [data.items[1]];
    await upload(data); await expectText(preview, '1 períodos únicos');
    assert.equal(await preview.locator('article').count(), 1);
  });
  await check('mobile viewport has no page overflow', async () => {
    await upload(fixture); await expectText(preview, '3 períodos únicos');
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:new URL('int-02b-preview-mobile.png', output).pathname, fullPage:true});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  });
  await check('discard removes session; same file can be reselected; reload forgets preview', async () => {
    await page.getByRole('button', {name:'Descartar vista previa',exact:true}).click();
    assert.equal(await preview.count(), 0);
    await upload(fixture); await expectText(preview, '3 períodos únicos');
    assert.deepEqual(await snapshot(), before);
    await page.reload();
    await page.getByRole('button', {name:'Estimaciones Taura',exact:true}).click();
    await expectText(page, 'Sin estimaciones en esta sesión.');
    assert.equal(await preview.count(),0);
    assert.deepEqual(await snapshot(), before);
  });
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  const result = {status:'PASS', date:'2026-11-14', node:process.version, browser:browser.version(), fixture:'Taura PR #9 producer at 5cbceda6, synthetic only', checks, storageWrites:0, indexedDBAccesses:0, broadcastChannels:0, unchangedPersistence:true, unchangedDashboard:true, consoleErrors:errors, externalRequests:outbound, limits:'Local production build, desktop/mobile viewport Chromium, not a deployed PWA or every browser.'};
  await writeFile(new URL('int-02b-ui-result.json', output), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
