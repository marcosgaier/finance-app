import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
process.env.TZ='Pacific/Auckland';
const dir=await mkdtemp(join(tmpdir(),'work-editor-'));
async function load(path,name){const out=join(dir,name+'.mjs');await build({entryPoints:[resolve(path)],outfile:out,bundle:true,platform:'node',format:'esm',loader:{'.css':'empty'}});return import(pathToFileURL(out));}
const api=await load('src/modules/work/editor/shiftDraft.ts','editor');
const batch=await load('src/modules/work/editor/batchPlan.ts','batch');
const fixtures=await load('src/modules/work/demo/fixtures.ts','fixtures');
const overtime=await load('src/modules/work/demo/overtime.ts','overtime');
const payroll=await load('src/modules/work/vendor/taura/lib/payroll.ts','payroll');
const tax=await load('src/modules/work/vendor/taura/domain/tax/calculateWeeklyPAYE.ts','tax');
const projections=await load('src/modules/work/vendor/taura/domain/payPeriods.ts','projections');
const payments=await load('src/modules/work/pages/PaymentsPage.tsx','payments');
const engine=await load('src/modules/work/vendor/taura/domain/contractRules.ts','engine');
const details=await load('src/modules/work/components/DayDetails.tsx','details');
const {newDraft,validateDraft,commitDraft,actOnShift}=api;
const before=JSON.stringify(fixtures.validateDemo());
const day='2026-09-24';
const draft=()=>newDraft(day,'demo-new');
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('commit updates only chosen ID, preserves created_at and unknown nested fields, without mutating source',()=>{
  const rows=freeze([{...draft(),id:'demo-a',created_at:'2026-01-01T00:00:00Z',future:{nested:[1]}},{...draft(),id:'demo-b'}]);
  const updated=commitDraft(rows,{...rows[0],id:'demo-changed',created_at:'bad',planned_rate:31},'demo-a');
  assert.equal(updated[0].id,'demo-a');assert.equal(updated[0].created_at,rows[0].created_at);
  assert.deepEqual(updated[0].future,{nested:[1]});assert.deepEqual(updated[1],rows[1]);
  updated[0].future.nested.push(2);assert.deepEqual(rows[0].future,{nested:[1]});
});
test('zero/multiple same-day shifts add without overwriting; duplicate ID rejected; unique duplicate clears actuals',()=>{
  const one=commitDraft([],draft()),two=actOnShift(one,'demo-new','duplicate','demo-copy');
  assert.equal(two.length,2);assert.deepEqual(two[0],one[0]);assert.equal(two[1].id,'demo-copy');assert.equal(two[1].actual_paid_hours,null);
  assert.throws(()=>actOnShift(one,'demo-new','duplicate','demo-new'));
  assert.equal(commitDraft(two,{...draft(),id:'demo-third'}).length,3);
});
test('cancel keeps record and excludes hours/pay; delete requires confirmation and preserves others',()=>{
  const rows=[draft(),{...draft(),id:'demo-other'}];
  const rated=input=>[...engine.calculateContractOvertime(input,fixtures.settings,[]).values()].reduce((sum,row)=>sum+row.ordinary+row.overtime,0);
  assert.equal(rated(rows),24);
  const cancelled=actOnShift(rows,'demo-new','cancel');assert.equal(cancelled.length,2);assert.equal(cancelled[0].status,'cancelled');assert.equal(rated(cancelled),12);
  assert.throws(()=>actOnShift(rows,'demo-new','delete'));
  assert.deepEqual(actOnShift(rows,'demo-new','delete',undefined,true),[rows[1]]);
});
test('payslip/confirmed (and invalid paid status) cannot be created or altered by any action',()=>{
  for(const status of ['payslip','confirmed','paid']) {
    const locked={...draft(),status};
    assert.throws(()=>validateDraft(locked));assert.throws(()=>commitDraft([locked],draft(),locked.id));
    for(const action of ['cancel','duplicate','delete'])assert.throws(()=>actOnShift([locked],locked.id,action,'demo-copy',true));
  }
});
test('invalid dates, times, optional types, negatives, >12 hours and incompatible status leave source unchanged',()=>{
  const source=freeze([draft()]),copy=JSON.stringify(source);
  for(const patch of [{shift_date:'2026-02-30'},{shift_date:'2026-09-31'},{shift_date:'bad'},{shift_date:'2028-01-01'},
    {planned_start:'2026-09-24T25:00'},{planned_end:'2026-09-24T07:00'}, {planned_end:null},
    {planned_paid_hours:12.01},{planned_paid_hours:NaN},{planned_unpaid_break:-1},{planned_unpaid_break:12},
    {planned_rate:-1},{planned_end:'2026-09-24T20:00',planned_unpaid_break:1},{actual_paid_hours:'2'},{actual_paid_hours:13},{actual_rate:Infinity},{actual_unpaid_break:-1},
    {actual_start:'2026-09-24T08:00',actual_end:null},{status:'unknown'},{status:'paid_leave'}, {kind:'holiday'}]) {
    assert.throws(()=>commitDraft(source,{...draft(),...patch},source[0].id),JSON.stringify(patch));assert.equal(JSON.stringify(source),copy);
  }
});
test('night crosses midnight; NZ DST gap/fold rejected; transition nights validate elapsed time and paid maximum',()=>{
  assert.equal(validateDraft(newDraft('2026-09-23','demo-night','night')).planned_paid_hours,12);
  assert.throws(()=>validateDraft({...draft(),shift_date:'2026-09-27',planned_start:'2026-09-27T02:30',planned_end:'2026-09-27T06:30',planned_paid_hours:3}));
  assert.throws(()=>validateDraft({...draft(),shift_date:'2026-04-05',planned_start:'2026-04-05T02:30',planned_end:'2026-04-05T06:30',planned_paid_hours:3}));
  const spring={...newDraft('2026-09-26','demo-spring','night'),planned_paid_hours:11};assert.equal(validateDraft(spring).planned_paid_hours,11);
  const autumn={...newDraft('2026-04-04','demo-autumn','night'),planned_unpaid_break:1};assert.equal(validateDraft(autumn).planned_paid_hours,12);
  assert.throws(()=>validateDraft({...autumn,planned_unpaid_break:0}));
});
test('off/leave and optional actual data maintain compatible model; original frozen fixture resets byte-identically',()=>{
  const off=newDraft(day,'demo-off','off');assert.equal(validateDraft(off).planned_paid_hours,0);
  assert.throws(()=>validateDraft({...off,actual_paid_hours:2}));
  for(const kind of ['annual_leave','sick_leave'])for(const status of ['paid_leave','unpaid_leave'])assert.equal(validateDraft({...newDraft(day,'demo-leave',kind),status}).status,status);
  assert.equal(validateDraft({...draft(),status:'worked',actual_paid_hours:11}).actual_paid_hours,11);
  const working=structuredClone(fixtures.validateDemo().shifts);working[0].status='cancelled';
  assert.equal(JSON.stringify(fixtures.validateDemo()),before);assert.ok(Object.isFrozen(fixtures.shifts[0]));
});
test('protected fictitious records render only consultation; add does not authorize editing them',()=>{
  for(const status of ['payslip','confirmed']) {
    const html=renderToStaticMarkup(React.createElement(details.DayDetails,{date:day,shifts:[{...draft(),status}],onClose(){},onEdit(){},onAction(){},onAdd(){}}));
    assert.match(html,/protegido, solo consulta/);
    assert.doesNotMatch(html,/>Editar un turno<|>Duplicar turno<|>Cancelar turno<|>Eliminar turno ficticio</);
    assert.match(html,/>Agregar turno</);
  }
});
test.after(async()=>{assert.equal(JSON.stringify(fixtures.validateDemo()),before);await rm(dir,{recursive:true,force:true});});


test('batch 0/1/N dates: create/change/skip, immutable IDs and metadata, no hidden duplicates',()=>{
  const settings=fixtures.settings;
  const original={...draft(),created_at:'keep',future:{nested:[1]}};
  const rows=freeze([original,{...draft(),id:'demo-work',shift_date:'2026-09-25',status:'worked'},{...draft(),id:'demo-m1',shift_date:'2026-09-26'},{...draft(),id:'demo-m2',shift_date:'2026-09-26'}]);
  const before=JSON.stringify(rows);
  assert.deepEqual(batch.applyBatch(rows,batch.planBatch(rows,[],'day',settings,d=>'demo-'+d)),rows);
  const plan=batch.planBatch(rows,['2026-09-24','2026-09-25','2026-09-26','2026-09-27','2026-09-27'],'night',settings,d=>'demo-'+d);
  assert.deepEqual(plan.rows.map(r=>r.action),['change','skip','skip','create']);
  assert.ok(plan.rows.filter(r=>r.action==='skip').every(r=>r.reason.length));
  assert.equal(JSON.stringify(rows),before,'preview/cancel has no mutation');
  const next=batch.applyBatch(rows,plan);
  assert.equal(next.length,rows.length+1);assert.equal(new Set(next.map(s=>s.id)).size,next.length);
  assert.equal(next[0].id,original.id);assert.equal(next[0].created_at,'keep');assert.deepEqual(next[0].future,original.future);
  assert.deepEqual(next.slice(1,4),rows.slice(1));assert.equal(next[0].planned_start,'2026-09-24T18:00:00');
  assert.throws(()=>batch.applyBatch(next,plan),/sesión cambió/);
  assert.throws(()=>batch.applyBatch([{...rows[0],future:{nested:[2]}},...rows.slice(1)],plan));
  assert.equal(JSON.stringify(rows),before);
  assert.throws(()=>batch.applyBatch(rows,plan,1),/sesión cambió/);
  const forged={...plan,rows:plan.rows.map(r=>r.action==='skip'?{...r,action:'change',shift:{...draft(),id:'demo-work',shift_date:r.date}}:r)};
  assert.throws(()=>batch.applyBatch(rows,forged));
  assert.equal(JSON.stringify(rows),before);
});

test('batch protects every nonplanned status and any actual data, including zero and notes',()=>{
  for(const patch of [{status:'worked'},{status:'modified'},{status:'confirmed'},{status:'payslip'},{status:'paid'},{status:'cancelled'},{status:'paid_leave'},{actual_paid_hours:0},{actual_start:'2026-09-24T07:00:00'},{actual_notes:'keep'},{confirmed_at:'keep'}]){
    const rows=[{...draft(),...patch}],plan=batch.planBatch(rows,[day],'off',fixtures.settings,()=> 'demo-unused');
    assert.equal(plan.rows[0].action,'skip',JSON.stringify(patch));assert.ok(plan.rows[0].reason);assert.deepEqual(batch.applyBatch(rows,plan),rows);
  }
});

test('quick templates: day/night/off, intermonth/year, NZ DST, atomic invalid batch and unique IDs',()=>{
  const quick=(date,kind)=>batch.quickDraft(date,'demo-q',kind,fixtures.settings);
  assert.equal(quick(day,'day').planned_start,day+'T06:00:00');assert.equal(quick(day,'day').planned_end,day+'T18:00:00');
  assert.equal(quick('2026-09-30','night').planned_end,'2026-10-01T06:00:00');assert.equal(quick('2026-12-31','night').planned_end,'2027-01-01T06:00:00');
  assert.equal(quick('2026-09-26','night').planned_paid_hours,11);
  assert.throws(()=>quick('2026-04-04','night'),/13 h/,'13 elapsed hours require individual review');
  assert.equal(batch.planBatch([],['2026-04-04'],'night',fixtures.settings,()=> 'demo-dst').rows[0].action,'skip');
  const off=quick(day,'off');assert.equal(off.planned_start,null);assert.equal(off.planned_end,null);assert.equal(off.planned_paid_hours,0);assert.equal(off.planned_rate,0);
  const source=[draft()],before=JSON.stringify(source);
  assert.throws(()=>batch.planBatch(source,['2026-09-28','2026-02-30'],'day',fixtures.settings,()=> 'demo-x'));
  assert.throws(()=>batch.planBatch([],['2026-09-28','2026-09-29'],'day',fixtures.settings,()=> 'demo-x'));
  assert.equal(JSON.stringify(source),before);
  const changed=batch.applyBatch(source,batch.planBatch(source,[day],'off',fixtures.settings,()=> 'demo-x'));
  const hours=rows=>[...engine.calculateContractOvertime(rows,fixtures.settings,[]).values()].reduce((n,row)=>n+row.ordinary+row.overtime,0);
  assert.equal(hours(changed),0);assert.equal(hours(source),12);
});

test('WORK-OT-01 pay/bank/pay, base always paid, exact tax/net/bank consistency, no mutation and reset',()=>{
  const data=fixtures.validateDemo(), original=JSON.stringify(data),week='2026-09-20';
  const update=(prefs,treatment,shifts=data.shifts)=>overtime.changeOvertime(prefs,shifts,data.settings,data.referenceDate,week,treatment);
  const project=prefs=>projections.buildPayProjections(data.shifts,data.settings,data.referenceDate,4,prefs).find(p=>p.id===week);
  const pay=update(data.overtimePreferences,'pay'),bank=update(pay,'bank'),again=update(bank,'pay');
  assert.deepEqual(project(pay),project(again));
  const a=project(pay),b=project(bank);
  assert.equal(a.basePay,b.basePay);assert.equal(a.basePay,60*30);
  assert.equal(b.bankableHours,20*(data.settings.overtime_multiplier-1));assert.equal(a.bankableHours,0);
  assert.equal(a.estimatedGross-b.estimatedGross,a.enhancedPayment);assert.equal(b.enhancedPayment,0);
  assert.ok(a.estimatedPAYE>b.estimatedPAYE);assert.ok(a.estimatedKiwiSaver>b.estimatedKiwiSaver);
  for(const [p,prefs] of [[a,pay],[b,bank]]) {
    const sum=payroll.totals([...engine.calculateContractOvertime(data.shifts,data.settings,prefs).values()]);
    const estimate=tax.calculateEstimatedWeeklyNet(sum.gross,p.payDate,data.settings.kiwisaver_rate,'M');
    for(const key of ['estimatedGross','estimatedPAYE','estimatedKiwiSaver','estimatedNet'])assert.equal(p[key],estimate[key]);
    assert.equal(p.bankableHours,sum.bankableHours);assert.equal(p.basePay,sum.basePay);
    assert.ok(Math.abs(p.estimatedNet-(p.estimatedGross-p.estimatedPAYE-p.estimatedKiwiSaver))<0.011);
  }
  assert.equal(JSON.stringify(data),original);assert.deepEqual(fixtures.validateDemo().overtimePreferences,data.overtimePreferences);
  assert.equal(project(structuredClone(fixtures.validateDemo().overtimePreferences)).bankableHours,10);
});
test('WORK-OT-01 independent weeks, no overtime and protected periods reject updates and hide controls',()=>{
  const d=fixtures.validateDemo(),week='2026-09-20';
  const second=d.shifts.map(s=>({...s,id:s.id+'-next'}));
  // Use ISO calendar arithmetic for dates spanning the month boundary.
  second.forEach((s,i)=>{s.shift_date=new Date(Date.UTC(2026,8,27+i)).toISOString().slice(0,10)});
  const shifts=[...d.shifts,...second];
  const first=overtime.changeOvertime(d.overtimePreferences,shifts,d.settings,d.referenceDate,week,'pay');
  const both=overtime.changeOvertime(first,shifts,d.settings,d.referenceDate,'2026-09-27','bank');
  assert.equal(both.find(p=>p.weekStart===week).overtimeTreatment,'pay');assert.equal(both.find(p=>p.weekStart==='2026-09-27').overtimeTreatment,'bank');
  for(const status of ['confirmed','payslip','paid']) {
    const locked=d.shifts.map((s,i)=>i===0?{...s,status}:s);
    assert.equal(overtime.changeOvertime(d.overtimePreferences,locked,d.settings,d.referenceDate,week,'pay'),d.overtimePreferences);
    const html=renderToStaticMarkup(React.createElement(payments.PaymentsPage,{...d,shifts:locked,onOvertimeTreatmentChange(){}}));
    assert.doesNotMatch(html,/<select/);assert.match(html,/Solo consulta/);
  }
  const period=projections.buildPayProjections(d.shifts,d.settings,d.referenceDate,4,d.overtimePreferences).find(p=>p.id===week);
  assert.equal(overtime.canChangeOvertime({...period,status:'paid'},week),false);
  const short=d.shifts.slice(0,2);
  assert.equal(overtime.changeOvertime(d.overtimePreferences,short,d.settings,d.referenceDate,week,'pay'),d.overtimePreferences);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(payments.PaymentsPage,{...d,shifts:short,onOvertimeTreatmentChange(){}})),/<select/);
});
