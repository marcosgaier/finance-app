// Synthetic UI validation. Uses an ephemeral server/profile and intercepts every external request.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sampleFinanceData } from '../src/data/sampleData.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const output = process.env.VALIDATION_OUTPUT_DIR ? pathToFileURL(resolve(process.env.VALIDATION_OUTPUT_DIR) + '/') : new URL('../docs/validation/arch-01b3a/editor/', import.meta.url);
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
    console.log('INTERCEPT', mode, route.request().url());
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
    const {context,page,outbound}=await makeContext(width);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('download',()=>errors.push('download'));
    const work=page.locator('#work-demo');
    const open=async()=>{await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).click();await work.getByRole('button',{name:'Roster',exact:true}).click();};
    await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).waitFor();
    const baseState=await snapshot(page),financeNode=await page.locator('#finance-region').elementHandle();
    await open();
    const day=work.locator('[data-day="2026-09-24"]');await day.click();
    const detail=work.getByRole('region',{name:/Detalle del ejemplo/});
    const initial=await detail.innerText();
    const original=detail.locator('[data-shift-id="demo-4"]');
    await original.getByRole('button',{name:'Editar turno ficticio',exact:true}).focus();await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Editar turno ficticio'});
    assert.equal(await dialog.getByLabel('Fecha del turno',{exact:true}).evaluate(el=>el===document.activeElement),true);
    await dialog.getByRole('button',{name:'Descartar edición'}).focus();await page.keyboard.press('Tab');
    assert.equal(await dialog.getByLabel('Fecha del turno',{exact:true}).evaluate(el=>el===document.activeElement),true,'native modal focus containment');
    await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
    assert.equal(await original.getByRole('button',{name:'Editar turno ficticio',exact:true}).evaluate(el=>el===document.activeElement),true);
    await original.getByRole('button',{name:'Editar turno ficticio',exact:true}).click();
    await dialog.getByLabel('Pausa planificada (h)',{exact:true}).fill('-1');
    await dialog.getByRole('button',{name:'Aceptar turno ficticio'}).click();
    await dialog.getByRole('alert').waitFor();assert.equal(await detail.innerText(),initial);
    await page.screenshot({path:fileURLToPath(new URL(`error-${width}.png`,output))});
    await dialog.getByLabel('Pausa planificada (h)',{exact:true}).fill('1');
    await dialog.evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:fileURLToPath(new URL(`editor-${width}.png`,output))});
    assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog fits width');
    await dialog.getByRole('button',{name:'Aceptar turno ficticio'}).click();
    assert.match(await original.innerText(),/11 h planificadas/);
    await original.getByRole('button',{name:'Duplicar turno ficticio'}).click();
    assert.equal(await detail.locator('[data-shift-id]').count(),2);
    const ids=await detail.locator('[data-shift-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.shiftId));assert.equal(new Set(ids).size,2);
    await original.getByRole('button',{name:'Cancelar turno ficticio'}).click();assert.match(await original.innerText(),/Cancelado/);
    const second=detail.locator(`[data-shift-id="${ids[1]}"]`),secondText=await second.innerText();
    page.once('dialog',d=>d.dismiss());await original.getByRole('button',{name:'Eliminar turno ficticio'}).click();assert.equal(await detail.locator('[data-shift-id]').count(),2);
    page.once('dialog',d=>d.accept());await original.getByRole('button',{name:'Eliminar turno ficticio'}).click();assert.equal(await detail.locator('[data-shift-id]').count(),1);assert.equal(await second.innerText(),secondText);
    await work.getByRole('button',{name:'Pagos',exact:true}).click();
    const pay=work.locator('[data-payment="2026-09-20"]');
    const money=value=>new Intl.NumberFormat('es-NZ',{style:'currency',currency:'NZD'}).format(value);
    assert.equal(await pay.locator('[data-amount="base"]').innerText(),money(1770));
    await page.screenshot({path:fileURLToPath(new URL(`recalculated-${width}.png`,output)),fullPage:true});
    await work.getByRole('button',{name:'Roster',exact:true}).click();assert.equal(await day.getAttribute('aria-expanded'),'true');
    await work.locator('[data-day="2026-09-27"]').click();await detail.getByRole('button',{name:'Agregar turno ficticio'}).click();
    await dialog.getByRole('combobox',{name:/^Tipo/}).selectOption('off');await dialog.getByRole('button',{name:'Aceptar turno ficticio'}).click();assert.match(await detail.innerText(),/Libre/);
    page.once('dialog',d=>d.dismiss());await work.getByRole('button',{name:'Restablecer ejemplo'}).click();assert.match(await detail.innerText(),/Libre/);
    page.once('dialog',d=>d.accept());await work.getByRole('button',{name:'Restablecer ejemplo'}).click();assert.match(await detail.innerText(),/Sin turnos/);
    await day.click();assert.equal(await detail.innerText(),initial);
    await original.getByRole('button',{name:'Duplicar turno ficticio'}).click();
    await work.getByRole('button',{name:'Volver a Finanzas',exact:true}).click();
    assert.deepEqual(await snapshot(page),baseState);assert.equal(await page.locator('#finance-region').evaluate((el,old)=>el===old,financeNode),true);
    await open();await work.locator('[data-day="2026-09-24"]').click();assert.equal(await detail.innerText(),initial);
    await detail.getByRole('button',{name:'Duplicar turno ficticio'}).click();
    await page.reload();await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).waitFor();
    const reloaded=await snapshot(page);assert.deepEqual(reloaded.local,baseState.local);assert.deepEqual(reloaded.session,baseState.session);
    const afterReload=await snapshot(page);await open();await work.locator('[data-day="2026-09-24"]').click();assert.equal(await detail.innerText(),initial);
    assert.deepEqual(await snapshot(page),afterReload);assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
    if(width===1280){await detail.getByRole('button',{name:'Editar turno ficticio',exact:true}).click();await page.evaluate(()=>document.documentElement.style.zoom='2');assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:fileURLToPath(new URL('editor-zoom-200.png',output))});}
    checks.push(`${width}: add empty/off; edit/validation atomic; ID retained; duplicate unique/multiple; cancel; explicit delete dismiss/accept isolated; payments recalculated; reset dismiss/accept; exit and reload restore; native dialog keyboard/focus/Escape/scroll/layout; Finance DOM identity and all storage unchanged; zero Work effects/network/downloads`);
    await context.close();
  }
  await writeFile(new URL('ui-results.json',output),JSON.stringify({status:'PASS',checks,limitations:['No physical Android/PWA, screen reader, native browser zoom/pinch testing.','DST follows device timezone; NZ DST automated with Pacific/Auckland. Ambiguous/nonexistent times blocked.']},null,2));
  console.log(checks.join('\n'));
} finally {await browser.close();await new Promise(done=>server.close(done));}
