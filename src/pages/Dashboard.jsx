import React, { useMemo, useState } from 'react';
import { AppTabs } from '../components/AppTabs.jsx';
import { BudgetEditor } from '../components/BudgetEditor.jsx';
import { CardSummary } from '../components/CardSummary.jsx';
import { GemMinimumSummary } from '../components/GemMinimumSummary.jsx';
import { PlanList } from '../components/PlanList.jsx';
import { ScenarioSimulator } from '../components/ScenarioSimulator.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { UpcomingDueSummary } from '../components/UpcomingDueSummary.jsx';
import { WeeklyTracker } from '../components/WeeklyTracker.jsx';
import { WeeklyStatus } from '../components/WeeklyStatus.jsx';
import { calculateWeeklyDebtReserve, formatMoney } from '../utils/financeEngine.js';

const dashboardTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'debts', label: 'Deudas' },
  { id: 'budget', label: 'Presupuesto' },
  { id: 'history', label: 'Historial' },
  { id: 'simulator', label: 'Simulador' },
  { id: 'settings', label: 'Ajustes' },
];

export function Dashboard({ financeData, setFinanceData }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const weeklySummary = useMemo(() => calculateWeeklyDebtReserve(financeData), [financeData]);

  function updatePlan(planId, patch) {
    setFinanceData((currentData) => ({
      ...currentData,
      paymentPlans: currentData.paymentPlans.map((plan) => (plan.id === planId ? { ...plan, ...patch } : plan)),
    }));
  }

  function addPlan() {
    setFinanceData((currentData) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 28);

      return {
        ...currentData,
        paymentPlans: [
          ...currentData.paymentPlans,
          {
            id: `plan-${Date.now()}`,
            name: 'Nuevo plan',
            cardId: currentData.cards[0]?.id || '',
            originalAmount: 0,
            balance: 0,
            dueDate: dueDate.toISOString().slice(0, 10),
            thirdPartyContribution: 0,
            minimumPaymentRule: null,
          },
        ],
      };
    });
  }

  function deletePlan(planId) {
    setFinanceData((currentData) => ({
      ...currentData,
      paymentPlans: currentData.paymentPlans.filter((plan) => plan.id !== planId),
    }));
  }

  function updateWeeklyIncome(weeklyIncome) {
    setFinanceData((currentData) => ({
      ...currentData,
      weeklyIncome,
    }));
  }

  function saveWeeklyRecord(record) {
    setFinanceData((currentData) => ({
      ...currentData,
      weeklyIncome: record.income,
      weeklyRecords: [...(currentData.weeklyRecords || []), record],
    }));
  }

  function startActiveWeek(activeWeek) {
    setFinanceData((currentData) => ({
      ...currentData,
      activeWeek,
    }));
  }

  function updateActiveWeek(updater) {
    setFinanceData((currentData) => {
      if (!currentData.activeWeek) return currentData;

      const nextActiveWeek =
        typeof updater === 'function' ? updater(currentData.activeWeek) : { ...currentData.activeWeek, ...updater };

      return {
        ...currentData,
        activeWeek: {
          ...nextActiveWeek,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function closeActiveWeek(record) {
    setFinanceData((currentData) => ({
      ...currentData,
      weeklyIncome: record.income,
      activeWeek: null,
      weeklyRecords: [...(currentData.weeklyRecords || []), record],
    }));
  }

  function deleteWeeklyRecord(recordId) {
    setFinanceData((currentData) => ({
      ...currentData,
      weeklyRecords: (currentData.weeklyRecords || []).filter((record) => record.id !== recordId),
    }));
  }

  function updateWeeklyRecord(recordId, updater) {
    setFinanceData((currentData) => ({
      ...currentData,
      weeklyRecords: (currentData.weeklyRecords || []).map((record) => {
        if (record.id !== recordId) return record;
        return typeof updater === 'function' ? updater(record) : { ...record, ...updater };
      }),
    }));
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-stone-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Finanzas personales</p>
            <h1 className="mt-1 text-3xl font-bold text-stone-950 sm:text-4xl">Plan semanal de deudas</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-stone-600">
              Calculá cuánto reservar esta semana con prioridad real para vencimientos cercanos, sin castigar el presupuesto por planes lejanos.
            </p>
          </div>
        </header>

        <AppTabs tabs={dashboardTabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'dashboard' && (
          <div className="grid gap-5">
            <WeeklyStatus summary={weeklySummary} />

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Ingreso semanal" value={weeklySummary.weeklyIncome} helper="Base editable para todos los cálculos." />
              <StatCard label="Disponible para deudas" value={weeklySummary.availableForDebt} helper="Después de números semanales, servicios, supermercado y combustible." tone="strong" />
              <StatCard label="Mínimo para no vencer" value={weeklySummary.minimumToAvoidExpiry} helper="Pago escalonado necesario para llegar a cada fecha límite." tone="warning" />
              <StatCard label="Pago inteligente" value={weeklySummary.recommendedPayment} helper={`${formatMoney(weeklySummary.smartExtraReserve)} extra sugerido sobre el mínimo.`} tone="strong" />
              <StatCard
                label={weeklySummary.weeklyShortfall > 0 ? 'Faltante semanal' : `Margen de vida: ${weeklySummary.lifeMarginStatus.label}`}
                value={weeklySummary.weeklyShortfall > 0 ? weeklySummary.weeklyShortfall : weeklySummary.lifeMargin}
                helper={
                  weeklySummary.weeklyShortfall > 0
                    ? 'Ese es el extra real que falta para cubrir todos los vencimientos a tiempo.'
                    : 'Disponible después del pago inteligente recomendado.'
                }
                tone={weeklySummary.weeklyShortfall > 0 ? 'danger' : weeklySummary.lifeMarginStatus.tone}
              />
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Motor de decision</p>
              <p className="mt-2 text-base leading-7 text-stone-800">{weeklySummary.decisionMessage}</p>
            </section>

            <UpcomingDueSummary plans={weeklySummary.plans} />
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="grid gap-5">
            <CardSummary cards={weeklySummary.cardSummaries} />
            <GemMinimumSummary
              summary={{
                ...weeklySummary.gemMinimumSummary,
                interestFreeRecommendedPayment: weeklySummary.interestFreeRecommendedPayment,
                suggestedSafeWeeklyPayment: weeklySummary.suggestedSafeWeeklyPayment,
              }}
            />
            <PlanList plans={weeklySummary.plans} cards={financeData.cards} onAddPlan={addPlan} onDeletePlan={deletePlan} onUpdatePlan={updatePlan} />
          </div>
        )}

        {activeTab === 'budget' && <BudgetEditor financeData={financeData} onChange={setFinanceData} />}

        {activeTab === 'history' && (
          <WeeklyTracker
            financeData={financeData}
            weeklySummary={weeklySummary}
            onDeleteWeek={deleteWeeklyRecord}
            onUpdateWeek={updateWeeklyRecord}
            onCloseWeek={closeActiveWeek}
            onIncomeChange={updateWeeklyIncome}
            onStartActiveWeek={startActiveWeek}
            onUpdateActiveWeek={updateActiveWeek}
          />
        )}

        {activeTab === 'simulator' && <ScenarioSimulator financeData={financeData} />}

        {activeTab === 'settings' && (
          <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Ajustes</p>
            <h2 className="mt-2 text-lg font-semibold text-stone-950">Funciones futuras</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Acá vamos a poder agregar exportar/importar datos, resetear la app y preparar sincronización cuando pasemos de localStorage a una base online.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
