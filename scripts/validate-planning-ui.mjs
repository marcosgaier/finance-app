// Run against a local production build; exclusively synthetic, nonpersistent browser profile.
// PLAYWRIGHT_MODULE can point to an external Playwright installation (no project dependency).
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { sampleFinanceData } from '../src/data/sampleData.js';
import { revisionFor } from '../src/services/tauraPreview.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
let fixture = JSON.parse(await readFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), 'utf8'));
// Optional actual Taura exporter, fetched at a pinned GitHub revision into /tmp.
// Node 24 strips its type-only TypeScript; no Taura files/dependencies are changed.
if (process.env.TAURA_EXPORTER_MODULE) {
  const { createIncomeProjections } = await import(pathToFileURL(resolve(process.env.TAURA_EXPORTER_MODULE)).href);
  const rule = fixture.items[0].rulesSnapshot;
  fixture = await createIncomeProjections(fixture.items.map(item => ({
    startsOn:item.periodStart, endsOn:item.periodEnd, payDate:item.payDate, status:item.workStatus,
    estimatedTaxCode:'M', estimatedTaxYear:'2026-27', payeIncludesAccEarnersLevy:true,
    estimatedGross:item.grossCents/100, estimatedPAYE:item.deductions.payeCents/100,
    estimatedKiwiSaver:item.deductions.kiwiSaverCents/100, estimatedNet:item.netCents/100,
    bankableHours:item.rulesSnapshot.bankableHours, basePay:item.rulesSnapshot.componentsCents.base/100,
    nightAllowance:item.rulesSnapshot.componentsCents.night/100, weekendAllowance:item.rulesSnapshot.componentsCents.weekend/100,
    enhancedPayment:item.rulesSnapshot.componentsCents.enhancedPayment/100,
  })), { kiwisaver_rate:rule.kiwiSaverRate, tax_code:rule.configuredTaxCode,
    student_loan:rule.studentLoanRequested, day_rate:rule.defaultDayRate,
    night_shift_allowance:rule.nightAllowanceRate, weekend_allowance:rule.weekendAllowanceRate,
    weekend_allowance_effective_from:rule.weekendEffectiveFrom, overtime_multiplier:rule.overtimeMultiplier,
  }, fixture.generatedAt);
}
const baseURL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname), 'Only localhost synthetic validation is allowed');
const output = process.env.VALIDATION_OUTPUT_DIR
  ? pathToFileURL(resolve(process.env.VALIDATION_OUTPUT_DIR) + '/')
  : new URL('../docs/validation/int-03c2/', import.meta.url);
await mkdir(output, { recursive: true });
const finance = structuredClone(sampleFinanceData);
finance.weeklyRecords = [];
finance.weeklyExpenses = [{ id: 'rent', name: 'Alquiler sintético', amount: 20 }];
finance.weeklyExpenses.push(...Array.from({length:8}, (_, i) => ({id:`extra-${i}`, name:`Gasto sintético ${i+1}`, amount:0})));
finance.monthlyExpenses = [{ id: 'monthly', name: '', amount: 30.01 }];
finance.variableBudgets = { groceries: 2, fuel: 3 };
finance.activeWeek = {id:'synthetic-active', weekStartDate:'2026-09-15', weekDate:'2026-09-15', realIncome:25, income:25, payments:[], extraIncome:[], variableTransactions:[], reserveMovements:[]};
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox'] });
const context = await browser.newContext({timezoneId:'Pacific/Auckland', viewport:process.env.MOBILE === '1' ? {width:360,height:800} : {width:1280,height:900}, serviceWorkers:'block'});
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
  for (const [api,methods] of [[Cache,['put','add','addAll','delete']], [CacheStorage,['open','delete']]]) {
    for (const method of methods) {
      const original=api.prototype[method];
      api.prototype[method]=function(...args){window.__writes.push(`Cache.${method}`);return original.apply(this,args);};
    }
  }
  const OriginalChannel = window.BroadcastChannel;
  OriginalChannel.prototype.postMessage = function() { window.__writes.push('BroadcastChannel.postMessage'); };
  window.BroadcastChannel = class extends OriginalChannel {
    constructor(...args) { window.__writes.push('BroadcastChannel'); super(...args); }
  };
}, {finance});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
await page.clock.install({time:new Date('2026-09-21T00:00:00.000Z')});
const checks = [];
async function check(name, action) { console.log('CHECK',name); await action(); checks.push(name); }
const snapshot = () => page.evaluate(async () => ({
  url:location.href, local: {...localStorage}, session:{...sessionStorage}, databases:await indexedDB.databases(), writes:[...window.__writes],
}));
const upload = async data => {
  await page.locator('#taura-file').setInputFiles({name:'synthetic.json', mimeType:'application/json', buffer:Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))});
};
const preview = page.getByTestId('taura-preview');
const expectText = async (locator, text) => { await locator.getByText(text, {exact:false}).first().waitFor(); };
const plan = page.getByTestId('planning-preview');
const weeks = plan.getByTestId('planning-week');
const first = weeks.nth(0);
const review = card => card.getByRole('button', {name:/^Revisar y calcular/}).click();
const open = async card => {
  const editor = card.getByTestId('week-editor');
  if (await editor.getAttribute('open') === null) await editor.locator(':scope > summary').click();
  for (const title of ['Ver desglose de gastos base', 'Deudas y ahorro']) {
    const summary = card.getByText(title, {exact:true});
    if (await summary.locator('..').getAttribute('open') === null) await summary.click();
  }
};
const unchanged = async before => assert.deepEqual(await snapshot(), before);
try {
  await page.goto(baseURL);
  await page.getByRole('button', {name:'Estimaciones Taura', exact:true}).waitFor();
  // PlanList expands priority details in a passive effect after a tab mounts.
  // Read its settled UI rather than racing that effect under the mocked clock.
  const tab = async name => {await page.getByRole('button', {name, exact:true}).click();await page.clock.runFor(32);};
  const backup = async () => {
    await tab('Ajustes');
    const pending = page.waitForEvent('download');
    await page.getByRole('button',{name:'Exportar backup JSON',exact:true}).click();
    const download = await pending;
    return JSON.parse(await readFile(await download.path(),'utf8')).financeData;
  };
  const backupBefore = await backup();
  const texts = {};
  for (const name of ['Dashboard','Historial','Deudas','Reservas']) { await tab(name); texts[name] = await page.locator('main').innerText(); }
  const before = await snapshot();
  assert.deepEqual(before.writes, []);
  await tab('Estimaciones Taura');
  await check('12 periods: planning first, four visible summaries, collapsed salary details, no false reset notice', async () => {
    const twelve = structuredClone(fixture); twelve.items = [];
    for (let i=0;i<12;i++) {
      const item = structuredClone(fixture.items[0]);
      const date = days => new Date(Date.parse('2026-09-20T00:00:00Z') + (i*7+days)*86400000).toISOString().slice(0,10);
      item.periodStart=date(0); item.periodEnd=date(6); item.payDate=date(8); item.periodId=`taura:weekly:${item.periodStart}`;
      const {revision,...payload}=item; item.revision=await revisionFor(payload); twelve.items.push(item);
    }
    await upload(twelve); await plan.waitFor();
    await expectText(page.getByTestId('import-success'),'12 períodos importados');
    const detail = page.getByTestId('income-details');
    assert.equal(await detail.getAttribute('open'),null);
    assert.equal(await weeks.count(),4);
    for (const card of await weeks.all()) {
      assert.ok(await card.getByTestId('week-summary').isVisible());
      assert.equal(await card.getByTestId('week-editor').getAttribute('open'),null);
    }
    assert.ok(await plan.evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('[data-testid="income-details"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.doesNotMatch(await plan.innerText(),/supuestos descartados/);
    await page.screenshot({path:fileURLToPath(new URL('overview.png',output)),fullPage:true});
    await detail.locator(':scope > summary').click();
    assert.equal(await detail.locator('article').count(),12);
    await detail.locator(':scope > summary').click();
    await unchanged(before);
  });
  await check('validated Taura producer fixture → visible planner, payDate mapping, no automatic review', async () => {
    await upload(fixture); await plan.waitFor();
    assert.equal(await weeks.count(),4);
    assert.doesNotMatch(await plan.innerText(),/supuestos descartados/);
    await expectText(first, 'Semana no registrada');
    await open(first);
    await expectText(first, 'Alquiler sintético');
    await expectText(first, 'Cobertura parcial');
    await expectText(first, 'Gasto mensual 1');
    assert.doesNotMatch(await plan.innerText(), /explicit-zero|unknown-income|unregistered|snapshot|\bpartial\b/);
    await open(first);
    assert.match(await first.innerText(), /2026-09-28/);
    assert.match(await first.getByTestId('week-margin').innerText(), /Indeterminado/);
    assert.match(await plan.getByTestId('planning-total').innerText(), /oculto/);
  });
  await check('explicit no assignments review; exact cents including monthly 7/30', async () => {
    await review(first);
    assert.match(await first.getByTestId('week-margin').innerText(), /932[,.]00/); // 964 - 20 - 7 - 5
    assert.match(await first.innerText(), /Margen hipotético/);
    await unchanged(before);
  });
  await check('expense replacement/addition, manual debt/saving, all due dates and negative margin', async () => {
    assert.equal(await first.getByRole('button',{name:/^Sustituir /}).count(),1);
    assert.equal(await first.getByLabel('Gasto a sustituir').locator('option').count(),13);
    await first.getByLabel('Gasto a sustituir').selectOption('rent');
    await first.getByRole('button', {name:'Sustituir gasto seleccionado',exact:true}).click();
    await first.getByLabel('Reemplazo Alquiler sintético (NZD)',{exact:true}).fill('1000.01');
    assert.match(await first.getByTestId('week-margin').innerText(),/Indeterminado/);
    await first.getByRole('button', {name:'Agregar gasto hipotético',exact:true}).click();
    await first.getByLabel('Gasto adicional 2 (NZD)',{exact:true}).fill('2.03');
    await first.getByRole('button', {name:'Agregar asignación',exact:true}).click();
    await first.getByLabel('Asignación 1 (NZD)',{exact:true}).fill('10.02');
    await first.getByRole('button', {name:'Agregar asignación',exact:true}).click();
    await first.getByLabel('Destino asignación 2',{exact:false}).selectOption('saving');
    await first.getByLabel('Asignación 2 (NZD)',{exact:true}).fill('3,04');
    await first.getByText('Vencimientos manuales opcionales (0)',{exact:true}).click();
    for (const [i,date] of ['2026-09-23','2026-09-29'].entries()) {
      await first.getByRole('button',{name:'Agregar vencimiento',exact:true}).click();
      await first.getByLabel(`Fecha vencimiento ${i+1}`).fill(date);
      await first.getByLabel(`Vencimiento ${i+1} (NZD)`,{exact:true}).fill('1.01');
    }
    assert.equal(await first.getByLabel('Gasto o asignación vinculada 1').inputValue(), 'rent');
    await review(first);
    assert.match(await first.getByTestId('week-margin').innerText(), /-63[,.]10/);
    assert.equal(await first.getByText(/Vencimiento revisado:/).count(),2);
    assert.match(await first.innerText(),/Alerta: vencimiento previo/);
    await page.screenshot({path:fileURLToPath(new URL('planner-desktop.png',output)),fullPage:true});
    await unchanged(before);
  });
  await check('invalid and sub-cent manual inputs block calculation accessibly', async () => {
    await first.getByLabel('Asignación 1 (NZD)',{exact:true}).fill('1.001');
    await review(first);
    await first.getByRole('alert').waitFor();
    assert.match(await first.getByTestId('week-margin').innerText(), /Indeterminado/);
    await first.getByLabel('Asignación 1 (NZD)',{exact:true}).fill('10.02');
    await review(first);
  });
  await check('zero roster vs unknown, later individual margin with blocked total', async () => {
    const zero=weeks.nth(2), unknown=weeks.nth(1);
    await open(zero); await review(zero);
    assert.match(await zero.innerText(),/Neto estimado cero/);
    assert.match(await zero.getByTestId('week-margin').innerText(),/-32[,.]00/);
    await open(unknown); await review(unknown);
    assert.match(await unknown.innerText(),/Ingreso desconocido/);
    assert.match(await unknown.getByTestId('week-margin').innerText(),/Indeterminado/);
    assert.match(await plan.getByTestId('planning-total').innerText(),/oculto/);
  });
  await check('tab retention and unchanged Dashboard/history/debts/reserves, exported backup and persistence',async()=>{
    for(const name of Object.keys(texts)){ await tab(name); assert.equal(await page.locator('main').innerText(),texts[name]); }
    assert.deepEqual(await backup(), backupBefore);
    await tab('Estimaciones Taura');
    assert.match(await first.getByTestId('week-margin').innerText(),/-63[,.]10/);
    await unchanged(before);
  });
  await check('all horizons 4..8 discard assumptions and explicit reset requires review',async()=>{
    for(const count of [5,6,7,8,4]){
      await page.getByLabel('Horizonte desde próximo martes civil NZ').selectOption(String(count));
      assert.equal(await weeks.count(),count);
      await expectText(plan,'Cambiaste el rango');
      await open(first);
      assert.match(await first.getByTestId('week-margin').innerText(),/Indeterminado/);
      assert.equal(await first.getByLabel('Asignación 1 (NZD)',{exact:true}).count(),0);
      await review(first);
    }
    await first.getByRole('button',{name:'Restablecer supuestos',exact:true}).click();
    assert.match(await first.getByTestId('week-margin').innerText(),/Indeterminado/);
    await review(first); await unchanged(before);
  });
  await check('mobile and keyboard review, accessible labels and alerts',async()=>{
    await page.setViewportSize({width:360,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.setViewportSize({width:390,height:844});
    await expectText(first, 'Alquiler sintético');
    assert.doesNotMatch(await plan.innerText(), /explicit-zero|unknown-income|unregistered|snapshot|\bpartial\b/);
    await first.getByRole('button',{name:/^Revisar y calcular/}).focus();
    await page.keyboard.press('Enter');
    await page.screenshot({path:fileURLToPath(new URL('planner-mobile.png',output)),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.setViewportSize(process.env.MOBILE === '1' ? {width:360,height:800} : {width:1280,height:900});
  });
  await check('actual synthetic budget edit in UI stops results until explicit rebuild',async()=>{
    await tab('Presupuesto');
    await page.getByLabel(/Supermercado/).fill('4');
    await tab('Estimaciones Taura');
    await expectText(plan.getByRole('alert'),'Base de gastos desactualizada');
    assert.ok((await plan.getByTestId('week-margin').allTextContents()).every(text => /Indeterminado/.test(text)));
    const changed=await snapshot();
    assert.notDeepEqual(changed.local,before.local);
    assert.ok(changed.writes.every(x=>x==='Storage.setItem'));
    await plan.getByRole('button',{name:'Actualizar base y descartar supuestos',exact:true}).click();
    await open(first); await review(first);
    assert.match(await first.getByTestId('week-margin').innerText(),/930[,.]00/);
    await unchanged(changed);
  });
  await check('synthetic active/history close → reopen → close invalidates earlier margins',async()=>{
    await page.clock.setSystemTime(new Date('2026-09-23T00:00:00Z'));
    await tab('Historial');
    const close=page.getByRole('button',{name:'Cerrar semana e iniciar nueva',exact:true});
    await close.click();
    await tab('Estimaciones Taura');
    await open(first);
    assert.match(await first.innerText(),/Excluida del futuro/);
    assert.match(await first.getByTestId('week-margin').innerText(),/Indeterminado/);
    // Close the now-active synthetic Sep 22 week from the existing tracker.
    await tab('Historial');
    const closeCurrent=page.getByRole('button',{name:'Cerrar semana',exact:true});
    if (!await closeCurrent.isVisible()) {
      await page.getByRole('button',{name:/Pago elegido esta semana/}).click();
    }
    await closeCurrent.click();
    await tab('Estimaciones Taura'); await open(first);
    assert.match(await first.innerText(),/Semana cerrada/);
    await tab('Historial');
    await page.getByRole('button',{name:'Reabrir como semana actual',exact:true}).click();
    await tab('Estimaciones Taura'); await open(first);
    assert.match(await first.innerText(),/Semana reabierta/);
    await tab('Historial');
    await page.getByRole('button',{name:'Volver a cerrar semana',exact:true}).click();
    await tab('Estimaciones Taura'); await open(first);
    assert.match(await first.innerText(),/Semana cerrada/);
    await expectText(plan,'Se modificó una semana');
    const operational=await snapshot();
    await review(first);
    assert.match(await first.getByTestId('week-margin').innerText(),/Indeterminado/);
    await unchanged(operational);
  });
  const afterOperations = await snapshot();
  await check('complete partial horizon total appears only after all four explicit reviews', async () => {
    const complete = structuredClone(fixture);
    complete.items = [];
    for (let i=0;i<4;i++) {
      const item=structuredClone(fixture.items[0]);
      const date=days=>new Date(Date.parse('2026-09-27T00:00:00Z')+(i*7+days)*86400000).toISOString().slice(0,10);
      item.periodStart=date(0); item.periodEnd=date(6); item.payDate=date(8);
      item.periodId=`taura:weekly:${item.periodStart}`;
      const {revision,...payload}=item;
      item.revision=await revisionFor(payload);
      complete.items.push(item);
    }
    await upload(complete); await plan.waitFor();
    for (let i=0;i<4;i++) {
      assert.match(await plan.getByTestId('planning-total').innerText(),/oculto/);
      await open(weeks.nth(i)); await review(weeks.nth(i));
    }
    assert.match(await plan.getByTestId('planning-total').innerText(),/3720[,.]00/);
    await unchanged(afterOperations);
  });
  await check('replacement clears plan immediately; newer import wins over a delayed validated selection', async () => {
    await page.evaluate(() => {
      const original = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (...args) => {
        crypto.subtle.digest = original;
        await new Promise(resolve => { window.__releaseDigest = resolve; });
        return original(...args);
      };
    });
    await upload(fixture);
    await page.waitForFunction(() => Boolean(window.__releaseDigest));
    assert.equal(await plan.count(),0);
    const newer = structuredClone(fixture); newer.items=[newer.items[1]];
    await upload(newer); await plan.waitFor();
    await page.evaluate(() => window.__releaseDigest());
    await expectText(page.getByTestId('import-success'),'1 períodos importados');
    await unchanged(afterOperations);
  });
  await check('hash, fiscal code, backup and oversize failures remove the entire planner; retry/discard/reload', async () => {
    const corrupt=structuredClone(fixture); corrupt.items[0].revision='sha256:'+'0'.repeat(64);
    const code=structuredClone(fixture); code.items[0].rulesSnapshot.taxCode='ME';
    for(const invalid of [corrupt,code,'{',{type:'taura-backup'},{type:'weekly-finance-planner-backup'},' '.repeat(1024*1024+1)]){
      await upload(fixture); await plan.waitFor();
      await upload(invalid); await page.getByRole('alert').waitFor();
      assert.equal(await plan.count(),0);
    }
    await upload(fixture); await plan.waitFor();
    await page.getByRole('button',{name:'Descartar vista previa',exact:true}).click();
    assert.equal(await plan.count(),0);
    await unchanged(afterOperations);
    await upload(fixture); await plan.waitFor();
    await page.reload(); await tab('Estimaciones Taura');
    assert.equal(await plan.count(),0);
    await unchanged({ ...afterOperations, writes: [] });
  });
  assert.deepEqual(errors,[]); assert.deepEqual(outbound,[]);
  const result={status:'PASS',node:process.version,browser:browser.version(),actualExporter:Boolean(process.env.TAURA_EXPORTER_MODULE),fixture:'Synthetic Taura v1; exporter blob d2ba6ea982d159907b432351000a4d4dd1582a6b', planningStorageWrites:0, planningIDBAccesses:0, planningBroadcastChannelActivity:0, planningCacheActivity:0, unchangedPersistenceDuringPlanning:true, unchangedExportedBackup:true, operationalEdits:'Budget and week lifecycle actions deliberately performed through UI on isolated synthetic profile; each followed by a new baseline', limits:'Local Chromium build and mobile viewport; no live deployment, PWA, other browsers, or Taura export button UI certification.',checks,externalRequests:outbound,consoleErrors:errors};
  await writeFile(new URL('planner-result.json',output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
