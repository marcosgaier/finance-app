// Synthetic UI validation. Uses an ephemeral server/profile and intercepts every external request.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sampleFinanceData } from '../src/data/sampleData.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const output = new URL('../docs/validation/arch-01b2-1/', import.meta.url);
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
  for (const width of [360, 390, 1280]) {
    const { context, page, outbound, setMode } = await makeContext(width);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const region = page.getByRole('region', { name: 'Accesos a mis aplicaciones' });
    const link = region.getByRole('link', { name: 'Abrir Taura en otra pestaña', exact: true });
    await link.waitFor();
    assert.equal(await link.getAttribute('href'), target);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    assert.match(await region.innerText(), /datos siguen separados/);
    assert.equal(outbound.length, 0);
    const box = await link.boundingBox();
    assert.ok(box.height >= 44 && box.width >= 44);
    await page.keyboard.press('Tab');
    assert.equal(await link.evaluate(el => el === document.activeElement), true);
    assert.equal(await link.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await link.evaluate(el => el === document.activeElement), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: fileURLToPath(new URL(`access-${width}.png`, output)), fullPage: true });
    const before = await snapshot(page);
    async function roundTrip() {
      const state = await snapshot(page);
      const financeNode = await page.locator('#finance-region').elementHandle();
      const plannerNode = await page.locator('[data-testid="planning-preview"]').count() ? await page.locator('[data-testid="planning-preview"]').elementHandle() : null;
      const cssBefore = await page.locator('#finance-region header').evaluate(el => ({color:getComputedStyle(el).color, font:getComputedStyle(el).font, width:el.getBoundingClientRect().width}));
      await page.getByRole('button', {name:'Ver demostración de Trabajo',exact:true}).click();
      await page.getByRole('heading',{name:'Trabajo · Taura',exact:true}).waitFor();
      assert.equal(await page.locator('#finance-region').evaluate(el=>getComputedStyle(el).display),'none');
      assert.equal(await page.locator('#work-demo-title').evaluate(el=>el===document.activeElement),true);
      assert.match(await page.locator('#work-demo').innerText(),/DEMOSTRACIÓN — datos ficticios; no es tu roster/);
      assert.match(await page.locator('#work-demo').innerText(),/2026-09-24/);
      assert.equal(await page.locator('#work-demo button').count(),1);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.equal(await page.getByText('Demostración no disponible.',{exact:false}).count(),0);
      await page.screenshot({path:fileURLToPath(new URL('work-'+width+'.png',output)),fullPage:true});
      await page.getByRole('button',{name:'Volver a Finanzas',exact:true}).click();
      assert.equal(await page.locator('#open-work-demo').evaluate(el=>el===document.activeElement),true);
      assert.equal(await financeNode.evaluate(el=>el===document.querySelector('#finance-region')),true);
      if(plannerNode) assert.equal(await plannerNode.evaluate(el=>el===document.querySelector('[data-testid="planning-preview"]')),true);
      assert.deepEqual(await page.locator('#finance-region header').evaluate(el=>({color:getComputedStyle(el).color,font:getComputedStyle(el).font,width:el.getBoundingClientRect().width})),cssBefore);
      assert.deepEqual(await snapshot(page),state);
    }
    await roundTrip();
    for (const name of tabs) {
      await page.getByRole('button', { name, exact: true }).click();
      await link.waitFor();
      await roundTrip();
    }
    assert.deepEqual(await snapshot(page), before);
    // A real imported synthetic planning session, edited in memory, survives all tabs and external opening.
    await page.getByRole('button', { name: 'Estimaciones Taura', exact: true }).click();
    await page.locator('#taura-file').setInputFiles(fileURLToPath(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url)));
    const plan = page.getByTestId('planning-preview');
    await plan.waitFor();
    const card = plan.getByTestId('planning-week').first();
    await card.getByTestId('week-editor').locator(':scope > summary').click();
    await card.getByRole('button', { name: 'Agregar gasto hipotético', exact: true }).click();
    const draft = card.getByLabel('Gasto adicional 1 (NZD)', { exact: true });
    await draft.fill('12.34');
    const content = await plan.innerText();
    await roundTrip();
    assert.equal(await draft.inputValue(),'12.34');
    for (const name of tabs) await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Estimaciones Taura', exact: true }).click();
    assert.equal(await draft.inputValue(), '12.34');
    assert.equal(await plan.innerText(), content);
    for (const mode of ['ok', '404', 'offline']) {
      setMode(mode);
      const pending = context.waitForEvent('page');
      if (mode === 'ok') { await link.focus(); await page.keyboard.press('Enter'); }
      else await link.click();
      const popup = await pending;
      await popup.waitForURL(target + '/', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(error => { if (mode !== 'offline') throw error; });
      assert.equal(await popup.evaluate(() => window.opener), null);
      await popup.close();
      await page.bringToFront();
      assert.equal(await draft.inputValue(), '12.34');
      assert.equal(await plan.innerText(), content);
      assert.deepEqual(await snapshot(page), before);
    }
    assert.ok(outbound.length >= 3); // Chromium may retry an aborted navigation.
    assert.deepEqual(errors, []);
    // Budget edits are existing financial actions; take a fresh baseline after that action.
    await page.getByRole('button', { name: 'Presupuesto', exact: true }).click();
    const budget = page.getByLabel(/Supermercado/);
    await budget.fill('42');
    const edited = await snapshot(page);
    await roundTrip();
    assert.equal(await budget.inputValue(),'42');
    setMode('ok');
    const pending = context.waitForEvent('page');
    await link.click();
    const popup = await pending;
    await popup.waitForLoadState();
    await popup.close();
    assert.equal(await budget.inputValue(), '42');
    assert.deepEqual(await snapshot(page), edited);
    checks.push(`${width}px: demo round trips from every tab, DOM identity/hidden/focus/CSS, zero demo effects, eight tabs, keyboard/focus/touch/layout, synthetic planning session and budget, native popup/Enter, noopener/no referrer, 404/offline, unchanged Finance storage/history`);
    await context.close();
  }
  for (const [label, raw, readError] of [['incompatible', '{"schemaVersion":999}', false], ['read-error', '{}', true]]) {
    const { context, page } = await makeContext(390, raw, readError);
    await page.getByRole('heading', { name: 'Tus datos necesitan una revisión' }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Abrir Taura/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Reintentar carga' }).count(), 1);
    assert.ok((await snapshot(page)).effects.every(x=>x==='Storage.getItem'));
    checks.push(`${label}: original recovery gate retained, no B1 access or storage writes`);
    await context.close();
  }
  {
    const {context,page} = await makeContext(390);
    await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).waitFor();
    const baseline=await snapshot(page);
    await page.evaluate(()=>{window.__dateFormatter=Intl.DateTimeFormat;Intl.DateTimeFormat=function(...args){if(args[0]==='es-NZ')throw Error('Synthetic demo rendering failure');return new window.__dateFormatter(...args);};});
    await page.getByRole('button',{name:'Ver demostración de Trabajo',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Demostración no disponible'}).waitFor();
    await page.evaluate(()=>{Intl.DateTimeFormat=window.__dateFormatter;});
    await page.getByRole('button',{name:'Volver a Finanzas',exact:true}).click();
    assert.deepEqual(await snapshot(page),baseline);
    await page.getByRole('button',{name:'Dashboard',exact:true}).waitFor();
    checks.push('demo render failure contained; Finance state, return and recovery intact');
    await context.close();
  }
  const { context, page } = await makeContext(390);
  await page.getByRole('button', { name: 'Presupuesto', exact: true }).click();
  await page.evaluate(() => { window.__failSave = true; });
  await page.getByLabel(/Supermercado/).fill('43');
  await page.getByRole('heading', { name: 'Hay cambios sin guardar' }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Abrir Taura/ }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Descargar cambios sin guardar' }).count(), 1);
  checks.push('unsaved: original recovery gate and recovery download retained');
  await context.close();
  await writeFile(new URL('ui-results.json', output), JSON.stringify({ status: 'PASS', checks, syntheticOnly: true, externalNetwork: 'intercepted; no live Taura requests', limitations: ['No physical Android/PWA or screen reader testing'] }, null, 2) + '\n');
  console.log(checks.join('\n'));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}

