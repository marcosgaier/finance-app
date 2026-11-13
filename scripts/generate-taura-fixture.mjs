import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
// Pass the unmodified producer from Taura PR #9 commit 5cbceda6 (read-only).
if (!process.argv[2]) throw new Error('Usage: node scripts/generate-taura-fixture.mjs /path/to/incomeProjections.ts');
const source = await readFile(process.argv[2], 'utf8');
const js = await transform(source, { loader: 'ts', format: 'esm' });
const { createIncomeProjections, serializeIncomeProjections } = await import(`data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`);
const settings = { kiwisaver_rate: 3, tax_code: 'M', student_loan: false, day_rate: 30, night_shift_allowance: 2, weekend_allowance: 3, weekend_allowance_effective_from: '2026-04-01', overtime_multiplier: 1.5 };
const period = (startsOn, endsOn, payDate, zero = false) => ({startsOn, endsOn, payDate, status: 'projected', estimatedTaxCode: 'M', estimatedTaxYear: '2026-27', payeIncludesAccEarnersLevy: true, estimatedGross: zero ? 0 : 1200, estimatedPAYE: zero ? 0 : 200, estimatedKiwiSaver: zero ? 0 : 36, estimatedNet: zero ? 0 : 964, bankableHours: 0, basePay: zero ? 0 : 1200, nightAllowance: 0, weekendAllowance: 0, enhancedPayment: 0});
const data = await createIncomeProjections([
 period('2026-09-20','2026-09-26','2026-09-28'),
 period('2026-09-27','2026-10-03','2026-10-06',true),
 period('2026-12-20','2026-12-26','2027-01-04'),
],settings,'2026-11-13T20:00:00.000Z');
await writeFile(new URL('./fixtures/taura-income-projections-v1.json', import.meta.url), serializeIncomeProjections(data));
