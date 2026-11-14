import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {test,after} from 'node:test';

// Fail closed on ANY browser storage/network access, including module loading.
const attempts=[];
const previous=new Map();
const blocked=name=>new Proxy(function(){},{get(){attempts.push(name);throw Error('Forbidden access: '+name);},apply(){attempts.push(name);throw Error('Forbidden access: '+name);}});
for(const name of ['window','localStorage','indexedDB','caches','fetch']){
  previous.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
  Object.defineProperty(globalThis,name,{configurable:true,value:blocked(name)});
}
after(()=>{assert.deepEqual(attempts,[],'Contract must not access browser storage/network');for(const [name,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
const {parseTauraPreview,revisionFor,destinationWeek,MAX_PREVIEW_BYTES}=await import('../src/services/tauraPreview.js');
const {buildIncomePlan,nextPlanningTuesday}=await import('../src/services/incomePlanning.js');
const text=await readFile(new URL('./fixtures/arch-01a-taura-v1.json',import.meta.url),'utf8');
const fixture=()=>JSON.parse(text);
const parse=data=>parseTauraPreview(JSON.stringify(data));
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
async function resign(item){const {revision,...payload}=item;item.revision=await revisionFor(payload);}

test('real exporter fixture: exact cents, independent SHA-256 and allowed contract metadata',async()=>{
  const input=freeze(fixture()),before=structuredClone(input),out=await parse(input);
  assert.equal(out.items.length,7);assert.equal(out.sourceId,'taura-local');assert.equal(out.schemaVersion,1);
  assert.equal(out.items[1].grossCents,120017);assert.equal(out.items[1].netCents,96413);
  assert.deepEqual(out.items.map(x=>x.netCents),[96413,96413,96413,96413,0,96413,96413]);
  for(const item of out.items){
    assert.equal(item.status,'estimated');
    assert.equal(item.grossCents-item.deductions.payeCents-item.deductions.kiwiSaverCents,item.netCents);
    assert.equal(item.deductions.payeIncludesAcc,true);
    const {revision,...payload}=item;
    assert.equal(revision,'sha256:'+createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    assert.equal(await revisionFor(payload),revision);
    assert.equal(item.warnings.length,7);
  }
  assert.deepEqual(input,before);
});

test('several periods same payDate: unique cents sum, partial selection and no inferred cash',async()=>{
  const data=fixture();data.items.push(structuredClone(data.items[1]));
  const preview=freeze(await parse(data)),before=structuredClone(preview);
  const options=freeze({startTuesday:'2026-09-22',weekCount:4,weeklyRecords:[],activeWeek:null});
  const plan=buildIncomePlan(preview,options);
  assert.equal(preview.duplicates,1);
  assert.deepEqual(plan.weeks.map(w=>w.knownIncomeCents),[192826,96413,0,null]);
  assert.deepEqual(plan.weeks.map(w=>w.incomeState),['estimated','estimated','explicit-zero','unknown']);
  assert.deepEqual(plan.weeks.map(w=>w.periodCount),[2,1,1,0]);
  assert.equal(plan.weeks[0].periods[0].periodStart,'2026-09-06'); // work week != Finance destination
  assert.equal(plan.status,'estimated');assert.equal(plan.coverage,'partial');
  assert.equal(plan.totals.knownIncomeCents,289239);
  assert.equal(plan.weeks[0].readOnly,true);
  assert.ok(plan.weeks[2].warnings.some(w=>w.code==='ZERO_MAY_BE_INCOMPLETE_ROSTER'));
  assert.deepEqual(preview,before);
  plan.weeks[0].periods[0].note='detached output';
  assert.deepEqual(preview,before);
});

test('payDate mapping Monday/Tuesday, month/year and NZ DST civil boundaries',async()=>{
  for(const [date,start,end]of [
    ['2026-09-28','2026-09-22','2026-09-28'],['2026-09-29','2026-09-29','2026-10-05'],
    ['2026-09-27','2026-09-22','2026-09-28'],['2026-04-05','2026-03-31','2026-04-06'],
    ['2027-01-04','2026-12-29','2027-01-04'],['2027-01-05','2027-01-05','2027-01-11'],
  ]) assert.deepEqual(destinationWeek(date),{start,end});
  const p=await parse(fixture());
  assert.equal(buildIncomePlan(p,{startTuesday:'2026-12-29'}).weeks[0].knownIncomeCents,96413);
  assert.equal(buildIncomePlan(p,{startTuesday:'2026-12-29'}).weeks[1].knownIncomeCents,96413);
  assert.equal(buildIncomePlan(p,{startTuesday:'2026-03-31'}).weeks[0].knownIncomeCents,96413);
  for(const [instant,start]of [['2026-09-26T14:00:00Z','2026-09-29'],['2026-04-04T14:00:00Z','2026-04-07']])assert.equal(nextPlanningTuesday(Date.parse(instant)),start);
});

test('changed payDate requires new revision, keeps period identity, replaces instead of accumulating',async()=>{
  const original=fixture().items[1],changed=structuredClone(original);
  changed.payDate='2026-09-29';
  const data=fixture();data.items=[changed];
  await assert.rejects(parse(data),/Revisión/);
  await resign(changed);
  assert.notEqual(changed.revision,original.revision);assert.equal(changed.periodId,original.periodId);
  const next=await parse(data);
  assert.deepEqual(buildIncomePlan(next,{startTuesday:'2026-09-22'}).weeks.map(w=>w.knownIncomeCents),[null,96413,null,null]);
  data.items=[original,changed];await assert.rejects(parse(data),/Conflicto/);
});

test('same period revised amount conflicts; generatedAt is not a payment identity or sequence',async()=>{
  const data=fixture(),item=structuredClone(data.items[1]);
  item.grossCents++;item.netCents++;await resign(item);data.items.push(item);
  await assert.rejects(parse(data),/Conflicto/);
  const a=await parse(fixture());const b=fixture();b.generatedAt='2026-11-15T00:00:00.000Z';
  assert.deepEqual((await parse(b)).items,a.items);
});

test('adversarial future contract drift: exact fields/version/status fail legibly even with valid hash',async()=>{
  for(const mutate of [
    d=>{d.schemaVersion=2;},d=>{d.futureField=true;},d=>{delete d.currency;},
    d=>{d.items[0].status='confirmed';},d=>{d.items[0].status='paid';},
    d=>{d.items[0].workStatus='paid';},d=>{d.items[0].depositId='not-an-estimate';},
    d=>{d.items[0].rulesSnapshot.newRule=true;},d=>{d.items[0].deductions.accCents=1;},
  ]){
    const d=fixture();mutate(d);await resign(d.items[0]);
    await assert.rejects(parse(freeze(d)),/campos|soportado|Estado|estimado/i);
  }
});

test('corrupt hashes, cents, missing zero, invalid dates and net arithmetic rejected',async()=>{
  for(const mutate of [d=>{d.items[0].revision='sha256:'+'0'.repeat(64);},d=>{d.items[0].deductions.payeCents++;},d=>{d.items[0].netCents=96413.1;},d=>{delete d.items[4].netCents;},d=>{d.items[0].payDate='2026-02-30';}]){
    const d=fixture();mutate(d);await assert.rejects(parse(freeze(d)),/Revisión|coincide|inválido|ausentes|inexistente/);
  }
});

test('backups, malformed JSON, item/UTF-8 size limits rejected without side effects',async()=>{
  for(const value of ['{',JSON.stringify({type:'weekly-finance-planner-backup',schemaVersion:1,financeData:{}}),JSON.stringify({schemaVersion:2,data:{settings:{},shifts:[]}})])await assert.rejects(parseTauraPreview(value));
  await assert.rejects(parseTauraPreview('é'.repeat(MAX_PREVIEW_BYTES/2+1)),/grande/);
  for(const items of [[],Array(105).fill(fixture().items[0])])await assert.rejects(parse({...fixture(),items}),/períodos/);
});

test('closed/reopened week metadata is read only and excluded; errors also leave all inputs intact',async()=>{
  const preview=freeze(await parse(fixture()));
  const options=freeze({startTuesday:'2026-09-22',weeklyRecords:[{id:'closed',weekDate:'2026-09-22'}],activeWeek:{id:'reopened',weekStartDate:'2026-09-29',reopenedFromHistory:true}});
  const before=structuredClone(options),plan=buildIncomePlan(preview,options);
  assert.deepEqual(plan.weeks.slice(0,2).map(w=>[w.weekState,w.excludedFromFuture]),[['closed',true],['reopened',true]]);
  assert.equal(plan.totals.eligibleKnownIncomeCents,0);
  assert.throws(()=>buildIncomePlan(preview,{...options,startTuesday:'2026-09-21'}),/martes/);
  assert.deepEqual(options,before);assert.deepEqual(attempts,[]);
});
