import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeFinanceData} from '../src/utils/financeEngine.js';
import {paymentFixture,payment} from './fixtures/card-payment-data.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
// Own an ephemeral local static server; never reuse a user's running app/profile.
const server=createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,'http://localhost').pathname;
  const asset=/^\/assets\/[a-zA-Z0-9_.-]+$/.test(pathname);
  const file=asset?pathname.slice(1):'index.html';
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(await readFile(new URL('../dist/'+file,import.meta.url)));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const baseURL='http://127.0.0.1:'+server.address().port;
const evidence=process.env.VALIDATION_OUTPUT_DIR || 'docs/validation/aud-01b';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.CHROMIUM_PATH ? undefined:'chrome',...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const results=[];
async function run(name,width,fn,{data=paymentFixture(),now='2026-11-10T12:00:00+13:00'}={}){
 const context=await browser.newContext({viewport:{width,height:850},timezoneId:'Pacific/Auckland',serviceWorkers:'block'});
 const errors=[],outbound=[];
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===new URL(baseURL).origin)return route.continue();outbound.push(route.request().url());return route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(({data})=>{
   if (!sessionStorage.getItem('fixture-seeded')) {
    localStorage.setItem('weekly-finance-planner',JSON.stringify(data));
    sessionStorage.setItem('fixture-seeded','1');
   }
   window.__writes=[];
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){if(key==='weekly-finance-planner')window.__writes.push(value);return original.call(this,key,value);};
  },{data});
  await page.goto(baseURL);await page.getByRole('button',{name:'Historial',exact:true}).waitFor();
  await fn(page);
  assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
  results.push({name,width,status:'PASS'});console.log('PASS',width,name);
 }catch(e){results.push({name,width,status:'FAIL',error:e.stack});console.error('FAIL',width,name,e);console.error(await page.locator('body').innerText());throw e;}
 finally{await context.close();}
}
const stored=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('weekly-finance-planner')));
const writes=p=>p.evaluate(()=>window.__writes.length);
async function form(p){await p.getByRole('button',{name:'Historial',exact:true}).click();await p.getByRole('button',{name:/Pago elegido esta semana/}).click();return p.getByText('Agregar pago',{exact:true}).locator('..');}
async function fill(box,amount,date='2026-11-10',source='custom-gem-reserve'){
 await box.getByLabel('Tarjeta',{exact:false}).selectOption('gem');await box.getByLabel('Origen',{exact:false}).selectOption(source);
 await box.locator('input[type=date]').fill(date);await box.getByLabel('Monto',{exact:false}).fill(String(amount));
}
async function saveWait(p,count){await p.waitForFunction(n=>window.__writes.length===n,count);}
async function confirm(p,button,accept,pattern){
 let message;
 const handled=new Promise(resolve=>p.once('dialog',async d=>{message=d.message();await (accept?d.accept():d.dismiss());resolve();}));
 await button.click();await handled;assert.match(message,pattern);return message;
}
try{
 for(const width of [360,1280]){
  for(const kind of ['missing','duplicate']){
   const data=paymentFixture();
   data.activeWeek.payments=[payment({id:kind==='missing'?undefined:'repeated',amount:80.17}),payment({id:kind==='missing'?undefined:'repeated',amount:20})];
   await run('legacy '+kind+' IDs: add preserves identities, delete refunds one and survives reload',width,async p=>{
    const box=await form(p);
    const rows=p.getByText('Pagos registrados',{exact:true}).locator('..').locator('..');
    assert.equal(await rows.getByRole('button',{name:'Eliminar',exact:true}).count(),2);
    assert.equal(await writes(p),0);
    await fill(box,10);await box.getByRole('button',{name:'Agregar',exact:true}).click();await saveWait(p,1);
    const added=await stored(p);assert.equal(added.activeWeek.payments.length,3);
    assert.equal(new Set(added.activeWeek.payments.map(x=>x.id)).size,3);
    await rows.getByRole('button',{name:'Eliminar',exact:true}).first().evaluate(el=>{el.click();el.click();});
    await saveWait(p,2);const removed=await stored(p);
    assert.equal(removed.activeWeek.payments.length,2);
    assert.equal(Math.round(removed.reserveBuckets[0].balance*100),31017);
    assert.deepEqual(removed.weeklyRecords,data.weeklyRecords);
    await p.reload();await form(p);
    assert.deepEqual(await stored(p),removed);
    const again=p.getByText('Pagos registrados',{exact:true}).locator('..').locator('..');
    await again.getByRole('button',{name:'Eliminar',exact:true}).first().click();await saveWait(p,1);
    const final=await stored(p);assert.equal(final.activeWeek.payments.length,1);
    assert.equal(Math.round(final.reserveBuckets[0].balance*100),33017);
   },{data});
   await run('legacy '+kind+' IDs: direct delete refunds only one',width,async p=>{
    await form(p);
    const rows=p.getByText('Pagos registrados',{exact:true}).locator('..').locator('..');
    await rows.getByRole('button',{name:'Eliminar',exact:true}).first().evaluate(el=>{el.click();el.click();});
    await saveWait(p,1);const d=await stored(p);
    assert.equal(d.activeWeek.payments.length,1);assert.equal(d.activeWeek.payments[0].amount,20);
    assert.equal(Math.round(d.reserveBuckets[0].balance*100),32017);
   },{data});
  }
  await run('single save, double click, reserve note, cycle, deletion refund',width,async p=>{
   const box=await form(p);await fill(box,80);
   assert.match(await box.innerText(),/Fondo GEM ficticio/);assert.match(await box.innerText(),/240/);assert.match(await box.innerText(),/no registres además un retiro manual/i);
   assert.equal(await writes(p),0);
   await box.getByRole('button',{name:'Agregar',exact:true}).evaluate(el=>{el.click();el.click();});
   await saveWait(p,1);const d=await stored(p);assert.equal(d.reserveBuckets[0].balance,160);assert.equal(d.activeWeek.payments.length,1);assert.deepEqual(d.paymentPlans,normalizeFinanceData(paymentFixture()).paymentPlans);
   assert.equal(d.activeWeek.payments[0].fundingSource,'custom-gem-reserve');
   await p.screenshot({path:evidence+'/payment-'+width+'.png',fullPage:true});
   const rows=p.getByText('Pagos registrados',{exact:true}).locator('..').locator('..');
   await rows.getByRole('button',{name:'Eliminar',exact:true}).evaluate(el=>{el.click();el.click();});
   await saveWait(p,2);assert.equal((await stored(p)).reserveBuckets[0].balance,240);
  });
  for(const [name,amount,date,pattern] of [['insufficient',300,'2026-11-10',/supera el saldo/],['future',80,'2026-11-11',/futura/],['duplicate',80,'2026-11-10',/posible duplicado/]]){
   const data=paymentFixture();if(name==='duplicate')data.weeklyRecords=[{id:'old',weekDate:'2026-11-03',payments:[payment()],budgetSnapshot:{weeklyIncome:400}}];
   await run(name+' cancel untouched then explicit accept saves once',width,async p=>{
    const box=await form(p);await fill(box,amount,date);const before=await stored(p);
    await confirm(p,box.getByRole('button',{name:'Agregar',exact:true}),false,pattern);
    assert.equal(await writes(p),0);assert.deepEqual(await stored(p),before);
    await confirm(p,box.getByRole('button',{name:'Agregar',exact:true}),true,pattern);
    await saveWait(p,1);const d=await stored(p);assert.equal(d.activeWeek.payments.length,1);assert.equal(d.reserveBuckets[0].balance,240-amount);
   },{data});
  }
  await run('two legitimate equal payments require acknowledgement and retain identity',width,async p=>{
   const box=await form(p);await fill(box,80);await box.getByRole('button',{name:'Agregar',exact:true}).click();await saveWait(p,1);
   await fill(box,80);await confirm(p,box.getByRole('button',{name:'Agregar',exact:true}),true,/posible duplicado/);await saveWait(p,2);
   const d=await stored(p);assert.equal(d.activeWeek.payments.length,2);assert.notEqual(d.activeWeek.payments[0].id,d.activeWeek.payments[1].id);assert.equal(d.reserveBuckets[0].balance,80);
   await p.getByRole('button',{name:'Reservas',exact:true}).click();assert.equal(await p.getByText('Usado en pago de deuda',{exact:true}).count(),2);
  });
  const midnight=paymentFixture();midnight.activeWeek.weekStartDate=midnight.activeWeek.weekDate='2026-11-17';
  await run('manual withdrawal note, local NZ midnight date and double click',width,async p=>{
   await p.getByRole('button',{name:'Reservas',exact:true}).click();
   const box=p.getByText('Movimiento manual',{exact:true}).locator('..');
   assert.match(await box.innerText(),/no registres ambas cosas/i);
   await box.getByLabel('Sobre',{exact:false}).selectOption('custom-gem-reserve');await box.getByLabel('Tipo',{exact:false}).selectOption('withdrawal');await box.getByLabel('Monto',{exact:false}).fill('80.17');
   await box.getByRole('button',{name:'Agregar',exact:true}).evaluate(el=>{el.click();el.click();});await saveWait(p,1);
   const d=await stored(p);assert.equal(Math.round(d.reserveBuckets[0].balance*100),15983);assert.equal(d.reserveBucketMovements.length,1);assert.equal(d.reserveBucketMovements[0].date,'2026-11-20');
   assert.equal(d.activeWeek.payments.length,0);
   await p.screenshot({path:evidence+'/manual-'+width+'.png',fullPage:true});
  },{data:midnight,now:'2026-11-20T00:30:00+13:00'});
 }
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile(evidence+'/ui-results.json',JSON.stringify(results,null,2));
}
console.log('UI TOTAL',results.length,'PASS');
