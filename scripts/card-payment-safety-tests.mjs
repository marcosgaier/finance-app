import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {paymentFixture,payment} from './fixtures/card-payment-data.mjs';
import {getCardPaymentWarnings,recordCardPayment,removeActiveCardPayment} from '../src/utils/cardPaymentUtils.js';
import {buildReserveMovementHistory} from '../src/utils/reserveHistoryUtils.js';
import {formatMoney,formatActionMoney,displayMoneyValue} from '../src/utils/moneyDisplay.js';
import {calculateWeeklyDebtReserve} from '../src/utils/financeEngine.js';
import {buildWeeklyMoneyFlowSummary} from '../src/utils/weeklyRecordUtils.js';
import {closeFinancialWeek,reopenFinancialWeek,closeReopenedFinancialWeek,buildReopenedWeekCorrection} from '../src/utils/weekReopeningUtils.js';
const today='2026-11-10',ref=new Date(2026,10,10,12);
const sum=d=>calculateWeeklyDebtReserve(d,ref);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const history=d=>buildReserveMovementHistory({activeWeek:d.activeWeek,buckets:d.reserveBuckets,reserveBucketMovements:d.reserveBucketMovements,weeklyRecords:d.weeklyRecords});

test('80 from arbitrary reserve ID: one debit/event, no plan or weekly-income double charge',()=>{
 const d=freeze(paymentFixture()),before=structuredClone(d),p=freeze(payment());
 const out=recordCardPayment(d,p);
 assert.equal(out.reserveBuckets[0].balance,160);assert.deepEqual(out.activeWeek.payments,[p]);
 assert.deepEqual(out.paymentPlans,d.paymentPlans);assert.deepEqual(d,before);
 assert.equal(sum(out).gemMinimumSummary.paymentsThisCycle,80);
 for(const key of ['minimumToAvoidExpiry','recommendedPayment'])assert.equal(sum(out)[key],sum(d)[key]);
 assert.equal(sum(out).gemMinimumSummary.weeklyBuffer,sum(d).gemMinimumSummary.weeklyBuffer);
 const flow=x=>buildWeeklyMoneyFlowSummary({record:x.activeWeek,financeData:x,useCurrentBudget:true,weeklySummary:sum(x)});
 assert.equal(flow(out).margin,flow(d).margin);
 assert.equal(recordCardPayment(out,p),out);
});

test('insufficient funds and future date produce warnings without mutations; explicit continuation supported',()=>{
 const d=freeze(paymentFixture()),p=freeze(payment({amount:300,date:'2026-11-11'})),before=structuredClone(d);
 const warnings=getCardPaymentWarnings(d,p,today);
 assert.equal(warnings.length,2);assert.match(warnings.join(' '),/negativo/);assert.match(warnings.join(' '),/futura/);assert.deepEqual(d,before);
 assert.equal(recordCardPayment(d,p).reserveBuckets[0].balance,-60);
});

test('duplicates compare card+effective date+cents across active and historical, independent of funding',()=>{
 const d=paymentFixture();d.weeklyRecords=[{id:'old',weekDate:today,payments:[payment({amount:80.001,fundingSource:'weekly-income'})]}];
 assert.equal(getCardPaymentWarnings(d,payment(),today).length,1);
 for(const patch of [{cardId:'other'},{date:'2026-11-09'},{amount:80.01}])assert.equal(getCardPaymentWarnings(d,payment(patch),today).length,0);
 d.weeklyRecords[0].payments[0].date=undefined;assert.equal(getCardPaymentWarnings(d,payment(),today).length,1);
 const a=recordCardPayment(paymentFixture(),payment()),b=recordCardPayment(a,payment({id:'another-legitimate'}));
 assert.equal(getCardPaymentWarnings(a,payment(),today).length,1);assert.equal(b.activeWeek.payments.length,2);
 const rows=history(b);assert.equal(new Set(rows.map(r=>r.id)).size,2);assert.equal(b.reserveBuckets[0].balance,80);
});

test('weekly-income and other funding remain legitimate; no unrelated reserve debit',()=>{
 const d=paymentFixture(),out=recordCardPayment(d,payment({fundingSource:'weekly-income'}));
 assert.equal(out.reserveBuckets,d.reserveBuckets);assert.equal(getCardPaymentWarnings(d,payment({amount:300,fundingSource:'weekly-income'}),today).length,0);
 assert.equal(recordCardPayment(d,payment({fundingSource:'other-reserve',amount:10})).reserveBuckets[1].balance,10);
 for(const patch of [{amount:NaN},{amount:Infinity},{amount:0},{cardId:'missing'},{fundingSource:'missing'}])assert.equal(recordCardPayment(d,payment(patch)),d);
});

test('active deletion/replacement with cents refunds once, repeated deletion is harmless',()=>{
 const d=paymentFixture(),paid=recordCardPayment(d,payment({amount:80.17}));
 assert.equal(Math.round(paid.reserveBuckets[0].balance*100),15983);
 const removed=removeActiveCardPayment(paid,'payment-synthetic');
 assert.equal(Math.round(removed.reserveBuckets[0].balance*100),24000);assert.equal(removed.activeWeek.payments.length,0);
 assert.equal(removeActiveCardPayment(removed,'payment-synthetic'),removed);
 const corrected=recordCardPayment(removed,payment({id:'corrected',amount:80.19}));
 assert.equal(Math.round(corrected.reserveBuckets[0].balance*100),15981);assert.deepEqual(corrected.paymentPlans,d.paymentPlans);
});

test('history: real payment dates; stable unique keys including missing/duplicate legacy IDs; no mutation',()=>{
 const d=paymentFixture();d.activeWeek.payments=[payment({date:'2026-11-11'}),payment({date:'2026-11-12'})];
 d.weeklyRecords=[{id:'old',weekDate:'2026-11-03',payments:[payment({id:undefined,date:undefined}),payment({id:undefined,date:'2026-11-04'})]}];
 const before=structuredClone(d),rows=history(freeze(d));assert.equal(rows.length,4);
 assert.equal(new Set(rows.map(r=>r.id)).size,4);assert.deepEqual(rows,history(d));
 assert.deepEqual(rows.map(r=>r.date),['2026-11-12','2026-11-11','2026-11-04','2026-11-03']);assert.deepEqual(d,before);
 assert.deepEqual(history({...d,activeWeek:structuredClone(d.activeWeek)}),rows);
 const unique=recordCardPayment(recordCardPayment(paymentFixture(),payment()),payment({id:'second'}));
 const secondId=history(unique).find(row=>row.id.includes('second')).id;
 assert.equal(history(removeActiveCardPayment(unique,'payment-synthetic'))[0].id,secondId);
});

test('closing/reopening/reclosing preserves snapshots, payments, dates and balances; historical correction blocked',()=>{
 const d=recordCardPayment(paymentFixture(),payment()),record={...d.activeWeek,id:'closed',closedAt:'2026-11-16T12:00:00Z',budgetSnapshot:{weeklyIncome:400,custom:'keep'}};
 let closed=closeFinancialWeek(d,record);
 for(let n=0;n<3;n++){const opened=reopenFinancialWeek(closed,'closed');assert.equal(sum(opened).gemMinimumSummary.paymentsThisCycle,80);
 assert.equal(recordCardPayment(opened,payment({id:'blocked'})),opened);assert.equal(removeActiveCardPayment(opened,payment().id),opened);
 assert.throws(()=>buildReopenedWeekCorrection(opened.activeWeek,{income:400,note:'fixture',payments:[payment({amount:81})]},d.cards),/reserva/);
 closed=closeFinancialWeek(opened,closeReopenedFinancialWeek(opened.activeWeek));}
 assert.deepEqual(closed.weeklyRecords,[record]);assert.deepEqual(closed.reserveBuckets,d.reserveBuckets);
});

test('cycle 19/20 unchanged after safe recording; Latitude update only changes plan-derived calculations',()=>{
 let d=recordCardPayment(paymentFixture(),payment({date:'2026-11-19'}));
 d=recordCardPayment(d,payment({id:'next-cycle',date:'2026-11-20',amount:20}));
 assert.equal(calculateWeeklyDebtReserve(d,new Date(2026,10,19)).gemMinimumSummary.paymentsThisCycle,80);
 assert.equal(calculateWeeklyDebtReserve(d,new Date(2026,10,20)).gemMinimumSummary.paymentsThisCycle,20);
 const updated={...d,paymentPlans:d.paymentPlans.map(p=>({...p,balance:520}))};
 assert.equal(updated.paymentPlans[0].originalAmount,1000);assert.equal(updated.reserveBuckets,d.reserveBuckets);assert.equal(updated.activeWeek,d.activeWeek);
 assert.notEqual(sum(updated).minimumToAvoidExpiry,sum(d).minimumToAvoidExpiry);
});

test('display suppresses only sub-half-cent negative zero; raw amounts and financial engine unchanged',()=>{
 for(const value of [-0,-1e-16,-0.0049,0,0.0049]){assert.equal(displayMoneyValue(value),0);assert.doesNotMatch(formatMoney(value),/-|−/);assert.doesNotMatch(formatActionMoney(value),/-|−/);}
 assert.equal(displayMoneyValue(-0.005),-0.005);assert.equal(displayMoneyValue(-1.23),-1.23);
 const d=paymentFixture();d.reserveBuckets[0].balance=-1e-16;formatMoney(d.reserveBuckets[0].balance);assert.equal(d.reserveBuckets[0].balance,-1e-16);
});

test('device-local date helper preserves NZ midnight and DST civil dates',()=>{
 const code="import {formatIsoDate} from './src/utils/dateUtils.js'; console.log(['2026-11-19T11:30:00Z','2026-09-26T12:30:00Z','2026-04-04T12:30:00Z'].map(x=>formatIsoDate(new Date(x))).join(','));";
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),env:{...process.env,TZ:'Pacific/Auckland'},encoding:'utf8'});
 assert.equal(result.status,0);assert.equal(result.stdout.trim(),'2026-11-20,2026-09-27,2026-04-05');
});
