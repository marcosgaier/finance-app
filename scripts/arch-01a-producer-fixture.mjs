import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {transform} from 'esbuild';
import {parseTauraPreview} from '../src/services/tauraPreview.js';

// Aggregate exporter inputs, NOT a second payroll calculator. All amounts fake.
export function syntheticInputs() {
  const specs = [
    ['2026-03-29','2026-04-04','2026-04-05'],
    ['2026-09-06','2026-09-12','2026-09-28'],
    ['2026-09-13','2026-09-19','2026-09-28'],
    ['2026-09-20','2026-09-26','2026-09-29'],
    ['2026-09-27','2026-10-03','2026-10-06',true],
    ['2026-12-20','2026-12-26','2027-01-04'],
    ['2026-12-27','2027-01-02','2027-01-05'],
  ];
  return {
    settings: {kiwisaver_rate:3,tax_code:'M',student_loan:false,day_rate:30,night_shift_allowance:2,weekend_allowance:3,weekend_allowance_effective_from:'2026-04-01',overtime_multiplier:1.5},
    periods: specs.map(([startsOn,endsOn,payDate,zero],i)=>({startsOn,endsOn,payDate,status:['projected','partially_worked','worked'][i%3],estimatedTaxCode:'M',estimatedTaxYear:'2026-27',payeIncludesAccEarnersLevy:true,estimatedGross:zero?0:1200.17,estimatedPAYE:zero?0:200.03,estimatedKiwiSaver:zero?0:36.01,estimatedNet:zero?0:964.13,bankableHours:0,basePay:zero?0:1200.17,nightAllowance:0,weekendAllowance:0,enhancedPayment:0})),
  };
}

const [sourcePath, mode='--check'] = process.argv.slice(2);
if (!sourcePath || !['--check','--write'].includes(mode)) throw Error('Usage: node scripts/arch-01a-producer-fixture.mjs /external/incomeProjections.ts [--check|--write]');
const source=await readFile(sourcePath,'utf8');
console.log('Producer SHA-256:',createHash('sha256').update(source).digest('hex'));
const attempts=[];
for(const name of ['window','localStorage','indexedDB','caches','fetch']) Object.defineProperty(globalThis,name,{configurable:true,value:new Proxy(function(){},{get(){attempts.push(name);throw Error('Forbidden access: '+name);},apply(){attempts.push(name);throw Error('Forbidden access: '+name);}})});
// Compile only the real pure exporter, never App/useRoster/storage or payroll.
const compiled=await transform(source,{loader:'ts',format:'esm'});
const {createIncomeProjections,serializeIncomeProjections}=await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
const {periods,settings}=syntheticInputs();
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
freeze(periods);freeze(settings);
const exported=serializeIncomeProjections(await createIncomeProjections(periods,settings,'2026-11-14T00:00:00.000Z'));
assert.equal(exported,serializeIncomeProjections(await createIncomeProjections(periods,settings,'2026-11-14T00:00:00.000Z')),'Producer must be deterministic');
assert.deepEqual(attempts,[],'Producer must not access browser storage/network');
try { await parseTauraPreview(exported); }
catch(cause){throw Error('Taura → Finance contract incompatible: '+cause.message,{cause});}
const target=new URL('./fixtures/arch-01a-taura-v1.json',import.meta.url);
if(mode==='--write') await writeFile(target,exported);
else assert.equal(exported,(await readFile(target,'utf8')).replaceAll('\r\n','\n'),'Producer drift: export differs from pinned fixture. Review contract changes; do not regenerate blindly.');
console.log('PASS real Taura exporter → Finance parser; deterministic fixture',mode);
