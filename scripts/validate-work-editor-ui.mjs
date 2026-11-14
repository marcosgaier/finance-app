// Synthetic UI validation. Uses an ephemeral server/profile and intercepts every external request.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sampleFinanceData } from '../src/data/sampleData.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const output = process.env.VALIDATION_OUTPUT_DIR ? pathToFileURL(resolve(process.env.VALIDATION_OUTPUT_DIR)+'/') : new URL('../docs/validation/arch-01b3a/', import.meta.url);
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = /^\/assets\/[a-zA-Z0-9_.-]+$/.test(path) ? path.slice(1) : 'index.html';
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await readFile(new URL('../dist/' + file, import.meta.url)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const target = 'https://taura-roster-pay-676l.vercel.app';
const browser = await chromium.launch({ headless: true, args: ['--host-resolver-rules=MAP taura-roster-pay-676l.vercel.app ~NOTFOUND'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const finance = structuredClone(sampleFinanceData);
finance.activeWeek = { id: 'synthetic-week', weekStartDate: '2026-09-15', weekDate: '2026-09-15', realIncome: 25, income: 25, payments: [], extraIncome: [], variableTransactions: [], reserveMovements: [] };
const checks = [];
const tabs = ['Dashboard', 'Deudas', 'Presupuesto', 'Historial', 'Reservas', 'Simulador', 'Estimaciones Taura', 'Ajustes'];
async function makeContext(width, raw = JSON.stringify(finance), readError = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Pacific/Auckland', serviceWorkers: 'block' });
  const outbound = [];
  let mode = 'ok';
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === base) return route.continue();
    console.log('Unexpected external request',route.request().url());
    outbound.push(route.request().url());
    assert.equal(route.request().url(), target + '/');
    assert.equal(route.request().headers().referer, undefined);
    return mode === 'offline' ? route.abort('internetdisconnected') : route.fulfill({ status: mode === '404' ? 404 : 200, contentType: 'text/html', body: '<h1>Synthetic destination</h1>' });
  });
  await context.addInitScript(({ raw, readError }) => {
    localStorage.setItem('weekly-finance-planner', raw);
    window.__effects = [];
    for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        window.__effects.push('Storage.' + method);
        if (window.__failSave) throw new Error('Synthetic save failure');
        return original.apply(this, args);
      };
    }
    for (const key of ['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','BroadcastChannel']) {
      window[key] = function(){ window.__effects.push(key); throw Error('Blocked '+key); };
    }
    navigator.sendBeacon = () => {window.__effects.push('beacon');throw Error('Blocked beacon');};
    if(navigator.serviceWorker) navigator.serviceWorker.register=()=>{window.__effects.push('SW');throw Error('Blocked SW');};
    if(window.caches) for(const key of ['open','match','delete','keys']) caches[key]=()=>{window.__effects.push('caches');throw Error('Blocked cache');};
    for (const method of ['open', 'deleteDatabase']) {
      const original = IDBFactory.prototype[method];
      IDBFactory.prototype[method] = function (...args) { window.__effects.push('IDB.' + method); throw Error('IDB blocked'); };
    }
    if (readError) Storage.prototype.getItem = () => { throw new Error('Synthetic read failure'); };
  }, { raw, readError });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-09-21T00:00:00Z') });
  await page.goto(base);
  return { context, page, outbound, setMode: value => { mode = value; } };
}
const snapshot = page => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, effects: [...window.__effects], url: location.href, history: history.length }));
try {
  for(const width of [360,390,1280]) {
    console.log('Checking editor width',width);
    const {context,page,outbound}=await makeContext(width);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('download',()=>errors.push('Unexpected download'));
    const work=page.locator('#work-demo');
    const baseline=await snapshot(page);
    const financeNode=await page.locator('#finance-region').elementHandle();
    const openWork=async()=>{await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).click();await work.getByRole('button',{name:'Roster',exact:true}).click();};
    const day=date=>work.locator(`[data-day="${date}"]`);
    const dialog=page.getByRole('dialog');
    const shifts=()=>work.locator('[data-shift-id]');
    const unchanged=async()=>assert.deepEqual(await snapshot(page),baseline);
    await openWork();
    assert.match(await work.innerText(),/MODO DEMOSTRACIÓN/);
    await day('2026-09-24').click();
    const original=await shifts().innerText();
    const id=await shifts().getAttribute('data-shift-id');
    await shifts().getByRole('button',{name:'Editar un turno',exact:true}).focus();await page.keyboard.press('Enter');
    await dialog.waitFor();assert.equal(await dialog.getByLabel('Fecha del turno ficticio',{exact:true}).evaluate(el=>el===document.activeElement),true);
    assert.equal(await dialog.getByRole('option',{name:'Confirmado ficticio',exact:true}).count(),0);
    for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
    await dialog.getByLabel('Fecha del turno ficticio',{exact:true}).fill('');
    await dialog.getByLabel('Tipo de turno ficticio',{exact:true}).selectOption('off');
    await dialog.getByRole('alert').waitFor();
    await dialog.getByLabel('Fecha del turno ficticio',{exact:true}).fill('2026-09-24');
    await dialog.getByLabel('Horas planificadas',{exact:true}).fill('13');
    await dialog.getByRole('button',{name:'Guardar solo en la demo',exact:true}).click();
    await dialog.getByRole('alert').waitFor();assert.equal(await shifts().innerText(),original);
    await dialog.getByLabel('Horas planificadas',{exact:true}).fill('10');
    const bounds=await dialog.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=900);
    await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    assert.ok(await dialog.evaluate(el=>el.scrollTop>0||el.scrollHeight<=el.clientHeight));
    await page.screenshot({path:fileURLToPath(new URL(`editor-bottom-${width}.png`,output))});
    await dialog.evaluate(el=>{el.scrollTop=0;});
    await page.screenshot({path:fileURLToPath(new URL(`editor-${width}.png`,output))});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await dialog.evaluate(el=>el.scrollHeight>el.clientHeight||el.scrollHeight<=innerHeight));
    await dialog.getByRole('button',{name:'Guardar solo en la demo',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    assert.equal(await shifts().getAttribute('data-shift-id'),id);assert.match(await shifts().innerText(),/10 h planificadas/);
    assert.equal(await shifts().getByRole('button',{name:'Editar un turno',exact:true}).evaluate(el=>el===document.activeElement),true);
    await unchanged();
    // Both read-only views consume the same working copy and unchanged pure engine.
    await work.getByRole('button',{name:'Resumen',exact:true}).click();
    assert.match(await work.getByRole('region',{name:'Resumen del ejemplo',exact:true}).innerText(),/58 h/);
    await work.getByRole('button',{name:'Pagos',exact:true}).click();
    assert.match(await work.locator('[data-payment="2026-09-20"]').innerText(),/18 h en esta proyección/);
    assert.equal(await work.locator('[data-payment="2026-09-20"] [data-amount="gross"]').innerText(),new Intl.NumberFormat('es-NZ',{style:'currency',currency:'NZD'}).format(1824));
    await work.getByRole('button',{name:'Roster',exact:true}).click();
    await shifts().getByRole('button',{name:'Duplicar turno',exact:true}).click();
    assert.equal(await shifts().count(),2);
    const ids=await shifts().evaluateAll(nodes=>nodes.map(el=>el.dataset.shiftId));assert.equal(new Set(ids).size,2);assert.equal(ids[0],id);
    await shifts().nth(1).getByRole('button',{name:'Cancelar turno',exact:true}).click();
    assert.match(await shifts().nth(1).innerText(),/Cancelado/);assert.match(await shifts().nth(0).innerText(),/Planificado/);
    await work.getByRole('button',{name:'Resumen',exact:true}).click();
    assert.match(await work.getByRole('region',{name:'Resumen del ejemplo',exact:true}).innerText(),/58 h/);
    await work.getByRole('button',{name:'Roster',exact:true}).click();
    page.once('dialog',d=>d.dismiss());await shifts().nth(1).getByRole('button',{name:'Eliminar turno ficticio',exact:true}).click();assert.equal(await shifts().count(),2);
    page.once('dialog',d=>d.accept());await shifts().nth(1).getByRole('button',{name:'Eliminar turno ficticio',exact:true}).click();assert.equal(await shifts().count(),1);assert.equal(await shifts().getAttribute('data-shift-id'),id);
    assert.equal(await page.locator('#day-detail-title').evaluate(el=>el===document.activeElement),true);
    await unchanged();
    // Escape discards the editor draft and restores keyboard focus.
    await shifts().getByRole('button',{name:'Editar un turno',exact:true}).click();await dialog.getByLabel('Horas planificadas',{exact:true}).fill('8');
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.match(await shifts().innerText(),/10 h planificadas/);
    assert.equal(await shifts().getByRole('button',{name:'Editar un turno',exact:true}).evaluate(el=>el===document.activeElement),true);
    // A zero-shift day adds a record, rather than replacing any of the fixture.
    await day('2026-09-28').click();assert.equal(await shifts().count(),0);
    await work.getByRole('button',{name:'Agregar turno',exact:true}).click();
    await dialog.waitFor();
    await dialog.getByLabel('Tipo de turno ficticio',{exact:true}).selectOption('night');
    assert.equal(await dialog.getByLabel('Fin planificado',{exact:true}).inputValue(),'2026-09-29T07:00');
    await dialog.getByRole('button',{name:'Guardar solo en la demo',exact:true}).click();assert.equal(await shifts().count(),1);
    await work.getByRole('button',{name:'Semana',exact:true}).click();assert.equal(await work.locator('[data-day]').count(),7);
    await work.getByRole('button',{name:'Período siguiente',exact:true}).click();await day('2026-09-28').click();assert.equal(await shifts().count(),1);
    await work.getByRole('button',{name:'Mes',exact:true}).click();assert.equal(await work.locator('[data-day]').count(),42);
    await day('2026-09-28').click();
    await unchanged();
    await page.screenshot({path:fileURLToPath(new URL(`roster-edited-${width}.png`,output)),fullPage:true});
    page.once('dialog',d=>d.dismiss());await work.getByRole('button',{name:'Restablecer ejemplo',exact:true}).click();assert.equal(await shifts().count(),1);
    page.once('dialog',d=>d.accept());await work.getByRole('button',{name:'Restablecer ejemplo',exact:true}).click();
    await day('2026-09-24').click();assert.match(await shifts().innerText(),/12 h planificadas/);
    await unchanged();
    // Exit/reopen drops the working copy, including a newly added shift.
    await shifts().getByRole('button',{name:'Duplicar turno',exact:true}).click();assert.equal(await shifts().count(),2);
    await page.getByRole('button',{name:'Volver a Finanzas',exact:true}).click();
    assert.equal(await financeNode.evaluate(el=>el===document.querySelector('#finance-region')),true);
    await unchanged();
    await openWork();await day('2026-09-24').click();assert.equal(await shifts().count(),1);assert.match(await shifts().innerText(),/12 h planificadas/);
    await unchanged();
    await page.reload();await openWork();await day('2026-09-24').click();assert.equal(await shifts().count(),1);
    // Reload performs Finance's existing one storage read; compare fresh instrumentation with original initial state.
    await unchanged();assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
    checks.push({width,status:'PASS',flows:['edit/ID/invalid/unchanged','dialog keyboard/Escape/focus/scroll','consistent summary/payments','multiple/duplicate/cancel','confirmed deletion','empty day/night/add','month/week navigation','reset confirm','exit/reopen/reload'],workEffects:0,financeUnchanged:true});
    await context.close();
  }
  const result={status:'PASS',node:process.version,chromium:browser.version(),checks,limits:'Local build, isolated synthetic profiles. Native Android/PWA, OS zoom and real screen readers remain manual. No Taura production access.'};
  await writeFile(new URL('editor-result.json',output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await browser.close();await new Promise(done=>server.close(done));}
