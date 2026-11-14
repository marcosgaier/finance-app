import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root=resolve('src/modules/work');
const manifest=JSON.parse(await readFile(join(root,'provenance.json')));
const temp=await mkdtemp(join(tmpdir(),'work-parity-'));
const bundle=async(entry,name)=>{const file=join(temp,name+'.mjs');await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile:file});return import(pathToFileURL(file));};
try {
  for(const f of manifest.files){
    const content=await readFile(join(root,'vendor/taura',f.path));
    const hash=createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    assert.equal(hash,f.gitBlob,`Exact upstream bytes: ${f.path}`);
    assert.equal(createHash('sha256').update(content).digest('hex'),f.sha256);
  }
  const allowed=new Set(manifest.files.map(f=>resolve(root,'vendor/taura',f.path)));
  for(const file of allowed){const source=await readFile(file,'utf8');for(const match of source.matchAll(/from ['"]([^'"]+)['"]/g))assert.ok(allowed.has(resolve(dirname(file),match[1]+'.ts')),match[1]);}
  async function audit(dir){for(const ent of await readdir(dir,{withFileTypes:true})){const file=join(dir,ent.name);if(ent.isDirectory())await audit(file);else if(/\.(tsx?|css)$/.test(file)){const source=await readFile(file,'utf8');assert.doesNotMatch(source,/\b(localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|BroadcastChannel|postMessage|sendBeacon|serviceWorker|appStorage|useRoster|Supabase|exporter)\b/);if(file.endsWith('.css'))assert.doesNotMatch(source,/:root|:global|@import|url\(|\bbody\b/);}}}
  await audit(root);
  const graph = [];
  async function visit(file) {
    if(graph.includes(file))return;
    graph.push(file);
    const source=await readFile(file,'utf8');
    for(const m of source.matchAll(/(?:\bfrom\s+|\bimport\s*)['"]([^'"]+)['"]/g)) {
      if(m[1]==='react')continue;
      assert.ok(m[1].startsWith('.'), 'External import '+m[1]);
      const target=resolve(dirname(file),m[1]);
      assert.ok(target.startsWith(root+'/') || target.startsWith(root+'\\'), 'Module escape');
      if(target.endsWith('.module.css'))continue;
      let next;
      for(const ext of ['.ts','.tsx']){try{await readFile(target+ext);next=target+ext;break;}catch{}}
      assert.ok(next,'Unresolved '+target);await visit(next);
    }
  }
  await visit(join(root,'WorkDemo.tsx'));
  console.log('Module import graph:',graph.map(f=>f.slice(root.length+1)).sort().join(', '));
  const attempts=[];
  for(const key of ['localStorage','sessionStorage','indexedDB','caches','fetch','XMLHttpRequest','WebSocket','Worker','BroadcastChannel'])Object.defineProperty(globalThis,key,{configurable:true,get(){attempts.push(key);throw Error(key);}});
  const fixture=await bundle(join(root,'demo/fixtures.ts'),'fixture');
  const contract=await bundle(join(root,'vendor/taura/domain/contractRules.ts'),'contract');
  const payroll=await bundle(join(root,'vendor/taura/lib/payroll.ts'),'payroll');
  const periods=await bundle(join(root,'vendor/taura/domain/payPeriods.ts'),'periods');
  const tax=await bundle(join(root,'vendor/taura/domain/tax/calculateWeeklyPAYE.ts'),'tax');
  fixture.validateDemo();assert.throws(()=>fixture.validateDemo([{...fixture.shifts[0],planned_paid_hours:NaN}]));assert.throws(()=>fixture.validateDemo(fixture.shifts,'2028-01-01'));
  const {shifts,settings,overtimePreferences,referenceDate}=fixture.validateDemo();
  const before=JSON.stringify({shifts,settings,overtimePreferences});
  const bank=payroll.totals([...contract.calculateContractOvertime(shifts,settings,overtimePreferences).values()]);
  const pay=payroll.totals([...contract.calculateContractOvertime(shifts,settings,[]).values()]);
  assert.equal(bank.ordinary,40);assert.equal(bank.overtime,20);assert.equal(bank.bankableHours,10);assert.equal(pay.gross-bank.gross,300);
  assert.equal(contract.getOvertimeWeekStart('2026-09-23').getDay(),0);
  assert.equal(payroll.hoursBetween('2026-09-23T19:00:00','2026-09-24T07:00:00'),12);
  assert.ok(bank.nightAllowance>0);assert.ok(bank.weekendAllowance>0);
  const projections=periods.buildPayProjections(shifts,settings,referenceDate,4,overtimePreferences);assert.ok(projections.length);assert.ok(projections.every(p=>p.estimatedGross>=p.estimatedNet));
  assert.equal(JSON.stringify({shifts,settings,overtimePreferences}),before);assert.deepEqual(attempts,[]);
  // Optional independent upstream tree; exact blob identity above is always enforced offline.
  if(process.env.TAURA_PARITY_ROOT){for(const f of manifest.files)assert.deepEqual(await readFile(join(process.env.TAURA_PARITY_ROOT,'src',f.path)),await readFile(join(root,'vendor/taura',f.path)));const upstream=await bundle(join(process.env.TAURA_PARITY_ROOT,'src/domain/payPeriods.ts'),'upstream');for(const prefs of [[],overtimePreferences])assert.deepEqual(upstream.buildPayProjections(shifts,settings,referenceDate,4,prefs),periods.buildPayProjections(shifts,settings,referenceDate,4,prefs));}
  assert.ok(tax.calculateEstimatedWeeklyNet(1800,'2026-09-30',3,'M'));
  console.log('PASS: exact upstream blobs, closed import graph, no effects, synthetic overtime pay/bank, night/weekend, dates, payroll/tax and optional upstream parity');
} finally {await rm(temp,{recursive:true,force:true});}
