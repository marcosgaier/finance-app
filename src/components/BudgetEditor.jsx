import React from 'react';
import { normalizeFinanceData } from '../utils/financeEngine.js';

export function BudgetEditor({ financeData, onChange }) {
  function updateField(path, value) {
    onChange((currentData) => {
      const nextData = structuredClone(normalizeFinanceData(currentData));
      if (path === 'weeklyIncome') nextData.weeklyIncome = Number(value);
      if (path === 'groceries') nextData.variableBudgets.groceries = Number(value);
      if (path === 'fuel') nextData.variableBudgets.fuel = Number(value);
      return nextData;
    });
  }

  function updateWeeklyExpense(expenseId, amount) {
    updateExpenseList('weeklyExpenses', expenseId, { amount: Number(amount) });
  }

  function updateMonthlyExpense(expenseId, amount) {
    updateExpenseList('monthlyExpenses', expenseId, { amount: Number(amount) });
  }

  function updateExpenseName(listName, expenseId, name) {
    updateExpenseList(listName, expenseId, { name });
  }

  function updateExpenseList(listName, expenseId, patch) {
    onChange((currentData) => {
      const normalizedData = normalizeFinanceData(currentData);
      return {
        ...normalizedData,
        [listName]: normalizedData[listName].map((expense) =>
          expense.id === expenseId ? { ...expense, ...patch } : expense,
        ),
      };
    });
  }

  function addExpense(listName, name) {
    onChange((currentData) => {
      const normalizedData = normalizeFinanceData(currentData);
      return {
        ...normalizedData,
        [listName]: [
          ...normalizedData[listName],
          { id: `${listName}-${Date.now()}`, name, amount: 0 },
        ],
      };
    });
  }

  function deleteExpense(listName, expenseId) {
    onChange((currentData) => {
      const normalizedData = normalizeFinanceData(currentData);
      return {
        ...normalizedData,
        [listName]: normalizedData[listName].filter((expense) => expense.id !== expenseId),
      };
    });
  }

  const monthlyTotal = financeData.monthlyExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const monthlyWeeklyReserve = (monthlyTotal / 30) * 7;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">Presupuesto semanal</h2>
          <p className="text-sm text-stone-500">Ajustá ingresos y gastos para recalcular al instante.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-900">Números semanales</h3>
            <button
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-stone-500"
              type="button"
              onClick={() => addExpense('weeklyExpenses', 'Nuevo semanal')}
            >
              Agregar
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MoneyField label="Ingreso base esperado" value={financeData.weeklyIncome} onChange={(value) => updateField('weeklyIncome', value)} />
            <MoneyField label="Supermercado" value={financeData.variableBudgets.groceries} onChange={(value) => updateField('groceries', value)} />
            <MoneyField label="Combustible" value={financeData.variableBudgets.fuel} onChange={(value) => updateField('fuel', value)} />
            {financeData.weeklyExpenses.map((expense) => (
              <EditableMoneyField
                key={expense.id}
                label={expense.name}
                value={expense.amount}
                onAmountChange={(value) => updateWeeklyExpense(expense.id, value)}
                onDelete={() => deleteExpense('weeklyExpenses', expense.id)}
                onNameChange={(value) => updateExpenseName('weeklyExpenses', expense.id, value)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Servicios mensuales</h3>
              <p className="mt-1 text-xs text-stone-500">Reserva semanal: total mensual / 30 × 7</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Guardar por semana</p>
                <p className="text-base font-bold text-sky-950">${Math.round(monthlyWeeklyReserve)}</p>
              </div>
              <button
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-500"
                type="button"
                onClick={() => addExpense('monthlyExpenses', 'Nuevo servicio')}
              >
                Agregar
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {financeData.monthlyExpenses.map((expense) => (
              <EditableMoneyField
                key={expense.id}
                label={expense.name}
                value={expense.amount}
                onAmountChange={(value) => updateMonthlyExpense(expense.id, value)}
                onDelete={() => deleteExpense('monthlyExpenses', expense.id)}
                onNameChange={(value) => updateExpenseName('monthlyExpenses', expense.id, value)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EditableMoneyField({ label, value, onAmountChange, onDelete, onNameChange }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase tracking-wide text-stone-500 outline-none focus:text-stone-800"
          type="text"
          value={label}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <button
          className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
          type="button"
          onClick={onDelete}
        >
          Eliminar
        </button>
      </div>
      <span className="mt-2 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
        <span className="text-stone-400">$</span>
        <input
          className="numeric-input min-w-0 flex-1 bg-transparent text-base font-semibold text-stone-900 outline-none"
          type="number"
          min="0"
          value={value}
          onChange={(event) => onAmountChange(event.target.value)}
        />
      </span>
    </div>
  );
}

function MoneyField({ label, value, onChange }) {
  return (
    <label className="block rounded-lg border border-stone-200 bg-stone-50 p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      <span className="mt-2 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2">
        <span className="text-stone-400">$</span>
        <input
          className="numeric-input min-w-0 flex-1 bg-transparent text-base font-semibold text-stone-900 outline-none"
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}
