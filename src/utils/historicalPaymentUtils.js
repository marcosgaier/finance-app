import { isReserveFunded } from './fundingSourceUtils.js';

// The historical editor never inserts, removes or reorders payments. Position
// distinguishes legacy payments (including identical ones) without changing IDs.
export function updateHistoricalPaymentAmount(payments, paymentIndex, amount) {
  return payments.map((payment, index) => index === paymentIndex ? { ...payment, amount } : payment);
}

export function prepareHistoricalPayments(originalPayments, draftPayments, cards) {
  if (originalPayments.length !== draftPayments.length) {
    throw new Error('No se pueden agregar ni eliminar pagos desde esta edición.');
  }
  return originalPayments.map((original, index) => {
    const draft = draftPayments[index];
    const { amount: originalAmount, ...originalFields } = original;
    const { amount: draftAmount, ...draftFields } = draft;
    if (JSON.stringify(originalFields) !== JSON.stringify(draftFields)) {
      throw new Error('Solo se puede corregir el importe de cada pago histórico.');
    }
    if (draftAmount === originalAmount) return original;
    const amount = Number(draftAmount);
    if ((typeof draftAmount !== 'string' && typeof draftAmount !== 'number') ||
        String(draftAmount).trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Ingresá un importe válido mayor a cero para cada pago modificado.');
    }
    if (amount === Number(originalAmount)) return original;
    if (isReserveFunded(original)) {
      throw new Error('No se puede cambiar este importe porque salió de una reserva. Requiere conciliación de saldos (FIN-002C).');
    }
    if (!cards.some((card) => card.id === original.cardId)) {
      throw new Error('No se puede modificar un pago cuya tarjeta ya no existe. El registro original se conserva.');
    }
    return { ...original, amount };
  });
}
