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
const fixtures=await load('src/modules/work/demo/fixtures.ts','fixtures');
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
