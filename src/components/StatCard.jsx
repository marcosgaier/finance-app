import React from 'react';
import { formatMoney } from '../utils/financeEngine.js';

export function StatCard({ label, value, helper, tone = 'default' }) {
  const toneClass = {
    default: 'border-stone-200 bg-white',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    danger: 'border-red-200 bg-red-50',
    strong: 'border-sky-200 bg-sky-50',
  }[tone];

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{typeof value === 'number' ? formatMoney(value) : value}</p>
      {helper ? <p className="mt-2 text-sm leading-5 text-stone-600">{helper}</p> : null}
    </section>
  );
}
