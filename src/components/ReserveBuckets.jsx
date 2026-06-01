import React, { useState } from 'react';
import { isReserveFunded } from '../utils/fundingSourceUtils.js';
import { formatMoney } from '../utils/financeEngine.js';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function ReserveBuckets({
  activeWeek = null,
  buckets,
  canTransferFromCurrentWeek = false,
  onAddMovement,
  onDeleteActiveWeekReserveMovement,
  onTransferFromCurrentWeek,
  onUpdateBucket,
  reserveBucketMovements = [],
  weeklyRecords = [],
}) {
  const [movementDraft, setMovementDraft] = useState({
    bucketId: buckets[0]?.id || '',
    type: 'deposit',
    amount: '',
    note: '',
  });
  const [transferDraft, setTransferDraft] = useState({
    date: getTodayIsoDate(),
    bucketId: buckets[0]?.id || '',
    amount: '',
    note: '',
  });
  const totalReserved = buckets.reduce((total, bucket) => total + Number(bucket.balance || 0), 0);
  const recentMovements = buildReserveMovementHistory({
    activeWeek,
    buckets,
    reserveBucketMovements,
    weeklyRecords,
  });

  function updateMovementDraft(patch) {
    setMovementDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  function updateTransferDraft(patch) {
    setTransferDraft((currentDraft) => ({ ...currentDraft, ...patch }));
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

  function transferFromCurrentWeek() {
    const amount = Number(transferDraft.amount || 0);
    if (!transferDraft.bucketId || amount <= 0 || !canTransferFromCurrentWeek) return;

    onTransferFromCurrentWeek({
      date: transferDraft.date || getTodayIsoDate(),
      bucketId: transferDraft.bucketId,
      amount,
      note: transferDraft.note,
    });
    setTransferDraft((currentDraft) => ({ ...currentDraft, amount: '', note: '' }));
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

      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Transferir desde semana actual</p>
        <p className="mt-1 text-sm text-emerald-950">
          Mové plata disponible de esta semana a un sobre. No cuenta como gasto.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1fr_0.8fr_1.4fr_auto] md:items-end">
          <label className="text-sm font-medium text-stone-600">
            Fecha
            <input
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              type="date"
              value={transferDraft.date}
              onChange={(event) => updateTransferDraft({ date: event.target.value })}
            />
          </label>
          <label className="text-sm font-medium text-stone-600">
            Destino
            <select
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              value={transferDraft.bucketId}
              onChange={(event) => updateTransferDraft({ bucketId: event.target.value })}
            >
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </label>
          <MoneyInput label="Monto" value={transferDraft.amount} onChange={(value) => updateTransferDraft({ amount: value })} />
          <label className="text-sm font-medium text-stone-600">
            Nota
            <input
              className="mt-1 w-full rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-sky-500"
              type="text"
              value={transferDraft.note}
              onChange={(event) => updateTransferDraft({ note: event.target.value })}
              placeholder="Ej: sobrante IRD"
            />
          </label>
          <button
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            type="button"
            disabled={!canTransferFromCurrentWeek}
            onClick={transferFromCurrentWeek}
          >
            Transferir
          </button>
        </div>
        {!canTransferFromCurrentWeek ? (
          <p className="mt-2 text-xs font-semibold text-amber-800">Necesitás una semana activa para registrar esta transferencia.</p>
        ) : null}
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

      <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-stone-600">Movimientos recientes</p>
            <p className="mt-1 text-sm text-stone-500">Entradas, salidas y usos de tus sobres.</p>
          </div>
          <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
            {recentMovements.length} movimientos
          </span>
        </div>

        {recentMovements.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {recentMovements.map((movement) => (
              <div
                key={movement.id}
                className="grid gap-1 rounded-md border border-stone-200 bg-white p-3 text-sm sm:grid-cols-[0.8fr_1.2fr_0.8fr_1fr_1.5fr_auto] sm:items-center"
              >
                <span className="text-stone-500">{formatDisplayDate(movement.date)}</span>
                <span className="font-semibold text-stone-900">{movement.bucketName}</span>
                <span className={`font-bold ${movement.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {movement.amount >= 0 ? '+' : '-'}
                  {formatMoney(Math.abs(movement.amount))}
                </span>
                <span className="text-stone-600">{movement.label}</span>
                <span className="text-stone-500">{movement.note || '-'}</span>
                {movement.canDelete ? (
                  <button
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    type="button"
                    onClick={() => onDeleteActiveWeekReserveMovement?.(movement.movementId)}
                  >
                    Eliminar
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-stone-300 bg-white p-3 text-sm text-stone-500">
            Todavía no hay movimientos de reservas para mostrar.
          </p>
        )}
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

function buildReserveMovementHistory({ activeWeek, buckets, reserveBucketMovements, weeklyRecords }) {
  const bucketNameById = Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.name]));
  const closedRecords = [...(weeklyRecords || [])];

  const manualMovements = (reserveBucketMovements || []).map((movement) => ({
    id: movement.id,
    date: movement.date,
    bucketName: movement.bucketName || bucketNameById[movement.bucketId] || 'Reserva',
    amount: movement.type === 'withdrawal' ? -Number(movement.amount || 0) : Number(movement.amount || 0),
    label: movement.type === 'withdrawal' ? 'Retiro manual' : 'Depósito manual',
    note: movement.note || '',
  }));

  const activeWeekReserveMovements = (activeWeek?.reserveMovements || []).map((movement) => ({
    id: movement.id,
    movementId: movement.id,
    date: movement.date || activeWeek.weekDate || activeWeek.weekStartDate,
    bucketName: movement.bucketName || bucketNameById[movement.bucketId] || 'Reserva',
    amount: movement.type === 'withdrawal' ? -Number(movement.amount || 0) : Number(movement.amount || 0),
    label: 'Transferido desde semana actual',
    note: movement.note || '',
    source: 'active-week-reserve-transfer',
    canDelete: true,
  }));

  const closedWeekReserveMovements = closedRecords.flatMap((record) =>
    (record.reserveMovements || []).map((movement) => ({
      id: movement.id,
      date: movement.date || record.weekDate || record.weekStartDate,
      bucketName: movement.bucketName || bucketNameById[movement.bucketId] || 'Reserva',
      amount: movement.type === 'withdrawal' ? -Number(movement.amount || 0) : Number(movement.amount || 0),
      label: 'Transferido desde semana actual',
      note: movement.note || '',
      source: 'closed-week-reserve-transfer',
      canDelete: false,
    })),
  );

  const records = [...closedRecords];
  if (activeWeek) records.push(activeWeek);

  const reserveFundedExpenses = records.flatMap((record) =>
    (record.variableTransactions || [])
      .filter((transaction) => isReserveFunded(transaction))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date || record.weekDate || record.weekStartDate,
        bucketName: bucketNameById[transaction.fundingSource] || 'Reserva',
        amount: -Number(transaction.amount || 0),
        label: 'Usado en gasto',
        note: transaction.description || '',
      })),
  );

  const reserveFundedPayments = records.flatMap((record) =>
    (record.payments || [])
      .filter((payment) => isReserveFunded(payment))
      .map((payment, index) => ({
        id: `${record.id || record.weekDate || 'week'}-${payment.cardId || index}-reserve-payment`,
        date: record.weekDate || record.weekStartDate,
        bucketName: bucketNameById[payment.fundingSource] || 'Reserva',
        amount: -Number(payment.amount || 0),
        label: 'Usado en pago de deuda',
        note: payment.cardName || 'Pago de deuda',
      })),
  );

  return [
    ...manualMovements,
    ...activeWeekReserveMovements,
    ...closedWeekReserveMovements,
    ...reserveFundedExpenses,
    ...reserveFundedPayments,
  ]
    .filter((movement) => movement.date && Number(movement.amount || 0) !== 0)
    .sort((firstMovement, secondMovement) => String(secondMovement.date).localeCompare(String(firstMovement.date)));
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return '';
  const [year, month, day] = String(dateValue).split('T')[0].split('-');
  if (!year || !month || !day) return dateValue;
  return `${day}/${month}/${year}`;
}
