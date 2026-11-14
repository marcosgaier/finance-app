import { isReserveFunded } from './fundingSourceUtils.js';

export function buildReserveMovementHistory({ activeWeek, buckets, reserveBucketMovements, weeklyRecords }) {
  const bucketNameById = Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.name]));
  const closedRecords = [...(weeklyRecords || [])];

  const manualMovements = (reserveBucketMovements || []).map((movement) => ({
    id: movement.id,
    movementId: movement.id,
    date: movement.date,
    bucketId: movement.bucketId,
    bucketName: movement.bucketName || bucketNameById[movement.bucketId] || 'Reserva',
    amount: movement.type === 'withdrawal' ? -Number(movement.amount || 0) : Number(movement.amount || 0),
    label: movement.type === 'withdrawal' ? 'Retiro manual' : 'Depósito manual',
    note: movement.note || '',
    source: 'manual-reserve-movement',
    canDelete: true,
  }));

  const activeWeekReserveMovements = (activeWeek?.reserveMovements || []).map((movement) => ({
    id: movement.id,
    movementId: movement.id,
    date: movement.date || activeWeek.weekDate || activeWeek.weekStartDate,
    bucketId: movement.bucketId,
    bucketName: movement.bucketName || bucketNameById[movement.bucketId] || 'Reserva',
    amount: movement.type === 'withdrawal' ? -Number(movement.amount || 0) : Number(movement.amount || 0),
    label: 'Transferido desde semana actual',
    note: movement.note || '',
    source: 'active-week-reserve-transfer',
    canDelete: !activeWeek.reopenedFromHistory,
  }));

  const closedWeekReserveMovements = closedRecords.flatMap((record) =>
    (record.reserveMovements || []).map((movement) => ({
      id: movement.id,
      date: movement.date || record.weekDate || record.weekStartDate,
      bucketId: movement.bucketId,
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
        bucketId: transaction.fundingSource,
        bucketName: bucketNameById[transaction.fundingSource] || 'Reserva',
        amount: -Number(transaction.amount || 0),
        label: 'Usado en gasto',
        note: transaction.description || '',
      })),
  );

  const reserveFundedPayments = records.flatMap((record) =>
    (record.payments || [])
      .map((payment, index) => ({ payment, index }))
      .filter(({ payment }) => isReserveFunded(payment))
      .map(({ payment, index }) => ({
        id: JSON.stringify([
          'reserve-payment',
          record.id || record.weekDate || record.weekStartDate || 'week',
          payment.id || null,
          !payment.id || record.payments.filter((item) => item.id === payment.id).length > 1 ? index : null,
        ]),
        date: payment.date || record.weekDate || record.weekStartDate,
        bucketId: payment.fundingSource,
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
