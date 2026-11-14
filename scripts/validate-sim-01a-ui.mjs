import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {paymentFixture} from './fixtures/card-payment-data.mjs';
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
const evidence=process.env.VALIDATION_OUTPUT_DIR || 'docs/validation/sim-01a';
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
try {
 for(const width of [360,1280]) for(const kind of ['empty','partial','reserve','expected']) {
  const data=paymentFixture(); data.variableBudgets={groceries:100,fuel:40};
  if(kind==='expected') data.activeWeek.realIncome=data.activeWeek.income=0;
  if(kind==='partial'||kind==='reserve') data.activeWeek.variableTransactions=[{id:'purchase',date:'2026-11-10',description:'Compra ficticia',category:'groceries',amount:25,fundingSource:kind==='reserve'?'custom-gem-reserve':'weekly-income'}];
  data.weeklyRecords=[{...structuredClone(data.activeWeek),id:'closed-fixture',closedAt:'2026-11-09T12:00:00Z',weekDate:'2026-11-03',weekStartDate:'2026-11-03',budgetSnapshot:{weeklyIncome:400,weeklyExpenses:[],monthlyExpenses:[],variableBudgets:{groceries:100,fuel:40}}}];
  await run(kind,width,async p=>{
   const before=await stored(p);
   assert.match(await p.locator('body').innerText(),/Plan estimado con presupuesto/i);
   assert.match(await p.locator('body').innerText(),/no confirma un depósito bancario/);
   assert.match(await p.locator('body').innerText(),/No es el saldo del banco/);
   await p.screenshot({path:evidence+'/plan-'+kind+'-'+width+'.png',fullPage:true});
   await p.getByRole('button',{name:'Historial',exact:true}).click();
   const purchases=p.getByRole('button',{name:/Compras registradas \(opcional\)/});
   assert.match(await purchases.innerText(),kind==='partial'||kind==='reserve'?/1 compras registradas/:/No cargaste compras/);
   assert.equal(await p.getByText('Comercio / descripción',{exact:true}).isVisible(),false);
   await purchases.click();
   assert.equal(await p.getByText('Comercio / descripción',{exact:true}).isVisible(),true);
   await p.getByRole('button',{name:/Resultado calculado con movimientos registrados/}).click();
   assert.doesNotMatch(await p.locator('body').innerText(),/Resultado real de la semana|Margen real|Gasto variable real|Gasté de menos|Gasté de más/);
   assert.deepEqual(await stored(p),before);assert.equal(await writes(p),0);
   await p.screenshot({path:evidence+'/'+kind+'-'+width+'.png',fullPage:true});
   // Closing needs no purchase entry; preserve history and reserve balances.
   if(kind==='empty'){
    await p.getByRole('button',{name:/Pago elegido esta semana/}).click();
    p.on('dialog',d=>d.accept());
    await p.getByRole('button',{name:'Cerrar semana',exact:true}).click();
    await p.waitForFunction(()=>window.__writes.length>0);
    const after=await stored(p);
    assert.deepEqual(after.reserveBuckets,before.reserveBuckets);
    assert.deepEqual(after.weeklyRecords[0],before.weeklyRecords[0]);
    assert.equal(after.weeklyRecords.length,before.weeklyRecords.length+1);
   }
  },{data});
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile(evidence+'/ui-results.json',JSON.stringify(results,null,2));}
console.log('UI TOTAL',results.length,'PASS');
