import React, { useState } from 'react';
import { formatMoney } from '../utils/financeEngine.js';

export function ReserveBuckets({ buckets, onAddMovement, onUpdateBucket }) {
  const [movementDraft, setMovementDraft] = useState({
    bucketId: buckets[0]?.id || '',
    type: 'deposit',
    amount: '',
    note: '',
  });
  const totalReserved = buckets.reduce((total, bucket) => total + Number(bucket.balance || 0), 0);

  function updateMovementDraft(patch) {
    setMovementDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  function addMovement() {
    const amount = Number(movementDraft.amount || 0);
    if (!movementDraft.bucketId || amount <= 0) return;

    onAddMovement({
      bucketId: movementDraft.bucketId,
      type: movementDraft.type,
      amount,
      note: movementDraft.note,
    });
    setMovementDraft((currentDraft) => ({ ...currentDraft, amount: '', note: '' }));
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Reservas</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">Sobres virtuales</h2>
          <p className="mt-1 text-sm text-stone-500">Separá plata guardada sin mezclarla con el sueldo semanal.</p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total reservado</p>
          <p className="text-lg font-bold text-emerald-950">{formatMoney(totalReserved)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {buckets.map((bucket) => (
          <article key={bucket.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Nombre
              <input
                className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none focus:border-sky-500"
                type="text"
                value={bucket.name}
                onChange={(event) => onUpdateBucket(bucket.id, { name: event.target.value })}
              />
            </label>
            <MoneyInput
              label="Saldo"
              value={bucket.balance}
              onChange={(value) => onUpdateBucket(bucket.id, { balance: Number(value || 0) })}
            />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Nota
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-sky-500"
                value={bucket.note || ''}
                onChange={(event) => onUpdateBucket(bucket.id, { note: event.target.value })}
              />
            </label>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Movimiento manual</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.8fr_0.8fr_1.4fr_auto] md:items-end">
          <label className="text-sm font-medium text-stone-600">
            Sobre
            <select
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              value={movementDraft.bucketId}
              onChange={(event) => updateMovementDraft({ bucketId: event.target.value })}
            >
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-stone-600">
            Tipo
            <select
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              value={movementDraft.type}
              onChange={(event) => updateMovementDraft({ type: event.target.value })}
            >
              <option value="deposit">Depósito</option>
              <option value="withdrawal">Retiro</option>
            </select>
          </label>
          <MoneyInput label="Monto" value={movementDraft.amount} onChange={(value) => updateMovementDraft({ amount: value })} />
          <label className="text-sm font-medium text-stone-600">
            Nota
            <input
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              type="text"
              value={movementDraft.note}
              onChange={(event) => updateMovementDraft({ note: event.target.value })}
              placeholder="Opcional"
            />
          </label>
          <button
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
            type="button"
            onClick={addMovement}
          >
            Agregar
          </button>
        </div>
      </div>
    </section>
  );
}

function MoneyInput({ label, value, onChange }) {
  return (
    <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-stone-500">
      {label}
      <span className="mt-1 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
        <span className="text-stone-400">$</span>
        <input
          className="numeric-input min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-900 outline-none"
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}
