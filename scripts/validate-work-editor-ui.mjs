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
    let financeNode=await page.locator('#finance-region').elementHandle();
    const openWork=async()=>{await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).click();await work.getByRole('button',{name:'Roster',exact:true}).click();};
    const day=date=>work.locator(`[data-day="${date}"]`);
    const dialog=page.getByRole('dialog');
    const shifts=()=>work.locator('[data-shift-id]');
    const unchanged=async()=>assert.deepEqual(await snapshot(page),baseline);
    await openWork();
    // WORK-OT-01: one shared memory preference; no new storage/network effects.
    const paymentsView=async()=>{await work.getByRole('button',{name:'Pagos',exact:true}).click();const detail=work.getByText('Overtime · tratamiento y detalle',{exact:true});if(await detail.getAttribute('aria-expanded')!=='true')await detail.evaluate(el=>el.parentElement.open=true);};
    const choice=work.getByRole('combobox',{name:'Tratamiento overtime 2026-09-20',exact:true});
    const card=work.locator('[data-payment="2026-09-20"]');
    const amounts=()=>card.locator('[data-amount]').allTextContents();
    await paymentsView();assert.equal(await choice.inputValue(),'pay');
    const payAmounts=await amounts();
    await choice.selectOption('bank');const bankAmounts=await amounts();
    await choice.selectOption('pay');assert.deepEqual(await amounts(),payAmounts);assert.notDeepEqual(payAmounts,bankAmounts);
    await choice.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    assert.equal(await choice.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),true);
    const box=await choice.boundingBox();assert.ok(box.height>=44&&box.width>=44);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:fileURLToPath(new URL(`overtime-pay-${width}.png`,output)),fullPage:true});
    await work.getByRole('button',{name:'Resumen',exact:true}).click();
    const summaryPay=await work.locator('section[aria-labelledby="work-summary-title"]').innerText();
    assert.match(summaryPay,/Enhanced Payment estimado/);
    await paymentsView();await choice.selectOption('bank');assert.deepEqual(await amounts(),bankAmounts);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:fileURLToPath(new URL(`overtime-bank-${width}.png`,output)),fullPage:true});
    await work.getByRole('button',{name:'Resumen',exact:true}).click();
    const summaryBank=await work.locator('section[aria-labelledby="work-summary-title"]').innerText();
    assert.match(summaryBank,/Hours Bank \(\+10 h\)/);assert.notEqual(summaryBank,summaryPay);
    await paymentsView();await choice.selectOption('pay');assert.deepEqual(await amounts(),payAmounts);
    await unchanged();
    page.once('dialog',d=>d.dismiss());await work.getByRole('button',{name:'Restablecer ejemplo',exact:true}).click();assert.equal(await choice.inputValue(),'pay');
    await choice.selectOption('bank');
    page.once('dialog',d=>d.accept());await work.getByRole('button',{name:'Restablecer ejemplo',exact:true}).click();assert.equal(await choice.inputValue(),'pay');
    await choice.selectOption('bank');await work.getByRole('button',{name:'Volver a Finanzas',exact:true}).click();await openWork();await paymentsView();assert.equal(await choice.inputValue(),'pay');
    await choice.selectOption('bank');await page.reload();financeNode=await page.locator('#finance-region').elementHandle();await openWork();await paymentsView();assert.equal(await choice.inputValue(),'pay');await unchanged();
    await work.getByRole('button',{name:'Roster',exact:true}).click();
    assert.match(await work.innerText(),/DEMOSTRACIÓN — datos ficticios; no es tu roster/);
    await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).click();
    assert.equal(await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).isDisabled(),true);
    await day('2026-09-20').click();await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).click();
    assert.equal(await dialog.getByRole('button',{name:'Confirmar cambios ficticios',exact:true}).isDisabled(),true);
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal(await day('2026-09-20').getAttribute('aria-pressed'),'true');
    await work.getByRole('button',{name:'Limpiar selección',exact:true}).click();
    await day('2026-09-20').click();await day('2026-09-24').focus();await page.keyboard.press('Space');await day('2026-09-28').click();
    assert.equal(await day('2026-09-24').getAttribute('aria-pressed'),'true');
    // Calendar-first: DOM/visual order, accessible targets, and a keyboard shortcut to the footer.
    const calendar=work.getByRole('list',{name:'Calendario mensual del ejemplo',exact:true});
    const actions=work.locator('#roster-batch-actions');
    assert.equal(await calendar.evaluate(el=>Boolean(el.compareDocumentPosition(document.getElementById('roster-batch-actions'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
    const calendarBounds=await calendar.boundingBox(),actionBounds=await actions.boundingBox();
    assert.ok(actionBounds.y>=calendarBounds.y+calendarBounds.height);
    assert.ok(actionBounds.y-calendarBounds.y<470,'Month and footer stay within a compact span');
    for(const button of await work.locator('[data-day], #roster-batch-actions button').all()){
      const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44,JSON.stringify(box));
    }
    await work.getByRole('link',{name:'Elegir turno · 3',exact:true}).focus();
    await page.keyboard.press('Enter');
    assert.equal(await actions.evaluate(el=>el===document.activeElement),true);
    const footerBounds=await actions.boundingBox();assert.ok(footerBounds.y>=0&&footerBounds.y+footerBounds.height<=900);
    await page.keyboard.press('Tab');assert.equal(await work.getByRole('button',{name:'Limpiar selección',exact:true}).evaluate(el=>el===document.activeElement),true);
    await work.getByRole('button',{name:'Semana',exact:true}).click();
    assert.match(await work.innerText(),/3 días seleccionados/);
    await page.screenshot({path:fileURLToPath(new URL(`batch-week-${width}.png`,output)),fullPage:true});
    await work.getByRole('button',{name:'Mes',exact:true}).click();
    await page.screenshot({path:fileURLToPath(new URL(`batch-selection-${width}.png`,output)),fullPage:true});
    await work.getByRole('button',{name:'Noche 18:00–06:00 (+1 día)',exact:true}).click();await dialog.waitFor();
    assert.match(await dialog.innerText(),/2026-09-20 — Se omitirá/);assert.match(await dialog.innerText(),/2026-09-24 — Se cambiará/);assert.match(await dialog.innerText(),/2026-09-28 — Se agregará/);
    for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:fileURLToPath(new URL(`batch-preview-${width}.png`,output))});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    assert.match(await work.innerText(),/3 días seleccionados/);
    assert.equal(await work.locator('[data-day][aria-pressed="true"]').count(),3);
    assert.equal(await work.getByRole('button',{name:'Noche 18:00–06:00 (+1 día)',exact:true}).evaluate(el=>el===document.activeElement),true);
    await unchanged();
    await work.getByRole('button',{name:'Noche 18:00–06:00 (+1 día)',exact:true}).click();await dialog.getByRole('button',{name:'Confirmar cambios ficticios',exact:true}).click();
    assert.match(await work.innerText(),/1 creados, 1 cambiados, 1 omitidos/);
    const cleared=async()=>{
      assert.match(await work.innerText(),/0 días seleccionados/);
      assert.equal(await work.locator('[data-day][aria-pressed="true"]').count(),0);
      assert.equal(await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await actions.evaluate(el=>el===document.activeElement),true);
      assert.equal(await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).isDisabled(),true);
      assert.equal(await work.getByRole('link',{name:'Elegir turno · 0',exact:true}).count(),1);
    };
    await cleared();
    await page.screenshot({path:fileURLToPath(new URL(`batch-cleared-${width}.png`,output)),fullPage:true});
    // A second, different batch uses only newly selected dates, without toggling multi mode.
    await day('2026-09-29').click();
    await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).click();
    assert.match(await dialog.innerText(),/2026-09-29 — Se agregará/);
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.match(await work.innerText(),/1 días seleccionados/);
    assert.equal(await day('2026-09-29').getAttribute('aria-pressed'),'true');
    await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).click();
    await dialog.getByRole('button',{name:'Confirmar cambios ficticios',exact:true}).click();
    await cleared();
    assert.match(await day('2026-09-29').getAttribute('aria-label'),/Diurno/);
    assert.match(await day('2026-09-28').getAttribute('aria-label'),/Nocturno/);
    // Applying an identical template makes no effective change and preserves selection.
    await day('2026-09-29').click();await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).click();
    await dialog.getByRole('button',{name:'Confirmar cambios ficticios',exact:true}).click();
    assert.equal(await day('2026-09-29').getAttribute('aria-pressed'),'true');
    await work.getByRole('button',{name:'Limpiar selección',exact:true}).click();
    await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).click();
    await day('2026-09-24').click();assert.match(await shifts().innerText(),/18:00/);
    await day('2026-09-28').click();assert.equal(await shifts().count(),1);
    await unchanged();
    // A multi-shift date is listed as a conflict; quick off/day never duplicate it.
    await day('2026-09-24').click();await shifts().getByRole('button',{name:'Duplicar turno',exact:true}).click();
    await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).click();
    await day('2026-09-24').click();await day('2026-09-28').click();
    await work.getByRole('button',{name:'Libre 0 h',exact:true}).click();
    assert.match(await dialog.innerText(),/Varios turnos/);
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    await work.getByRole('button',{name:'Libre 0 h',exact:true}).click();await dialog.getByRole('button',{name:'Confirmar cambios ficticios',exact:true}).click();
    await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).click();await day('2026-09-28').click();assert.match(await shifts().innerText(),/0 h planificadas/);
    await day('2026-09-24').click();assert.equal(await shifts().count(),2);
    await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).click();
    assert.match(await work.innerText(),/0 días seleccionados/);
    await day('2026-09-28').click();await work.getByRole('button',{name:'Día 06:00–18:00',exact:true}).click();await dialog.getByRole('button',{name:'Confirmar cambios ficticios',exact:true}).click();
    await work.getByRole('button',{name:'Seleccionar varios días',exact:true}).click();await day('2026-09-28').click();assert.equal(await shifts().count(),1);assert.match(await shifts().innerText(),/06:00/);
    await shifts().getByRole('button',{name:'Editar un turno',exact:true}).click();await dialog.getByRole('button',{name:'Libre 0 h',exact:true}).click();assert.equal(await dialog.getByLabel('Tipo de turno ficticio',{exact:true}).inputValue(),'off');await dialog.getByRole('button',{name:'Cerrar sin guardar',exact:true}).click();assert.match(await shifts().innerText(),/12 h planificadas/);
    await unchanged();
    page.once('dialog',d=>d.accept());await work.getByRole('button',{name:'Restablecer ejemplo',exact:true}).click();

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
    for(const detail of await work.locator('[data-payment="2026-09-20"] details').all())if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
    assert.match(await work.locator('[data-payment="2026-09-20"]').innerText(),/18 h en esta proyección/);
    assert.equal(await work.locator('[data-payment="2026-09-20"] [data-amount="gross"]').innerText(),new Intl.NumberFormat('es-NZ',{style:'currency',currency:'NZD'}).format(2094));
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
    checks.push({width,status:'PASS',flows:['WORK-OT-01 default pay/bank/pay, summary coherence, keyboard/focus, reset cancellation/confirmation, exit/reload, zero effects','batch selection/month/week/keyboard/preview/cancel/confirm/conflicts/zero-effects','edit/ID/invalid/unchanged','dialog keyboard/Escape/focus/scroll','consistent summary/payments','multiple/duplicate/cancel','confirmed deletion','empty day/night/add','month/week navigation','reset confirm','exit/reopen/reload'],workEffects:0,financeUnchanged:true});
    await context.close();
  }
  const result={status:'PASS',node:process.version,chromium:browser.version(),checks,limits:'Local build, isolated synthetic profiles. Native Android/PWA, OS zoom and real screen readers remain manual. No Taura production access.'};
  await writeFile(new URL('editor-result.json',output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await browser.close();await new Promise(done=>server.close(done));}
