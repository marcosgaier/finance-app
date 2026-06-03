import React, { useMemo, useState } from 'react';
import { AppTabs } from '../components/AppTabs.jsx';
import { BudgetEditor } from '../components/BudgetEditor.jsx';
import { CardSummary } from '../components/CardSummary.jsx';
import { GemMinimumSummary } from '../components/GemMinimumSummary.jsx';
import { PlanList } from '../components/PlanList.jsx';
import { ReserveBuckets } from '../components/ReserveBuckets.jsx';
import { ScenarioSimulator } from '../components/ScenarioSimulator.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { UpcomingDueSummary } from '../components/UpcomingDueSummary.jsx';
import { WeeklyTracker } from '../components/WeeklyTracker.jsx';
import { WeeklyActionPlan } from '../components/WeeklyActionPlan.jsx';
import { WeeklyStatus } from '../components/WeeklyStatus.jsx';
import { calculateWeeklyDebtReserve, formatMoney } from '../utils/financeEngine.js';

const dashboardTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'debts', label: 'Deudas' },
  { id: 'budget', label: 'Presupuesto' },
  { id: 'history', label: 'Historial' },
  { id: 'reserves', label: 'Reservas' },
  { id: 'simulator', label: 'Simulador' },
  { id: 'settings', label: 'Ajustes' },
];

export function Dashboard({ financeData, setFinanceData }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const effectiveFinanceData = useMemo(() => {
    const activeOpeningBalance = Number(financeData.activeWeek?.openingBalance || 0);
    const activeRealIncome = Number(financeData.activeWeek?.realIncome || 0);
    const activeExtraIncome = (financeData.activeWeek?.extraIncome || []).reduce(
      (total, income) => total + Number(income.amount || 0),
      0,
    );
    if (activeOpeningBalance <= 0 && activeRealIncome <= 0 && activeExtraIncome <= 0) return financeData;

    return {
      ...financeData,
      weeklyIncome:
        activeOpeningBalance +
        (activeRealIncome > 0 ? activeRealIncome : Number(financeData.weeklyIncome || 0)) +
        activeExtraIncome,
    };
  }, [financeData]);
  const weeklySummary = useMemo(() => calculateWeeklyDebtReserve(effectiveFinanceData), [effectiveFinanceData]);
  const weeklyGemBuffer = Number(weeklySummary.gemMinimumSummary?.weeklyBuffer || 0);
  const minimumSafeWeeklyPayment = Number(weeklySummary.minimumToAvoidExpiry || 0) + weeklyGemBuffer;
  const extraSuggestedPayment = Math.max(
    0,
    Number(weeklySummary.recommendedPayment || 0) - Number(weeklySummary.minimumToAvoidExpiry || 0),
  );
  const totalRecommendedPayment = minimumSafeWeeklyPayment + extraSuggestedPayment;
  const marginAfterMinimumSafe = Number(weeklySummary.availableBeforeDebt || 0) - minimumSafeWeeklyPayment;
  const safeWeeklyShortfall = Math.max(0, minimumSafeWeeklyPayment - Number(weeklySummary.availableBeforeDebt || 0));
  const weeklyStatusOverride =
    safeWeeklyShortfall > 0
      ? {
          label: 'No llegás al mínimo seguro',
          tone: 'danger',
          message: `Esta semana no llegás al mínimo semanal seguro de ${formatMoney(minimumSafeWeeklyPayment)}. Te faltarían ${formatMoney(safeWeeklyShortfall)}.`,
        }
      : {
          label: marginAfterMinimumSafe < 30 ? 'Llegás muy justo' : 'Llegás al mínimo seguro',
          tone: marginAfterMinimumSafe < 30 ? 'warning' : 'positive',
          message: `Cubriendo el mínimo semanal seguro de ${formatMoney(minimumSafeWeeklyPayment)}, te quedarían ${formatMoney(marginAfterMinimumSafe)} estimados esta semana.`,
        };
  const decisionMessage = `Piso seguro esta semana: ${formatMoney(minimumSafeWeeklyPayment)}. Si pagás eso, te quedarían ${formatMoney(marginAfterMinimumSafe)} estimados. Podés pagar más manualmente si querés acelerar deuda.`;

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

  function saveWeeklyRecord(record) {
    setFinanceData((currentData) => ({
      ...currentData,
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

  function updateReserveBucket(bucketId, patch) {
    setFinanceData((currentData) => ({
      ...currentData,
      reserveBuckets: (currentData.reserveBuckets || []).map((bucket) =>
        bucket.id === bucketId ? { ...bucket, ...patch } : bucket,
      ),
    }));
  }

  function addReserveMovement({ bucketId, type, amount, note }) {
    const movementAmount = Number(amount || 0);
    if (!bucketId || movementAmount <= 0) return;

    setFinanceData((currentData) => {
      const targetBucket = (currentData.reserveBuckets || []).find((bucket) => bucket.id === bucketId);
      const signedAmount = type === 'deposit' ? movementAmount : -movementAmount;
      const movement = {
        id: `reserve-manual-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        bucketId,
        bucketName: targetBucket?.name || 'Reserva',
        type,
        amount: movementAmount,
        note: note || '',
        source: 'manual',
      };

      return {
        ...currentData,
        reserveBuckets: (currentData.reserveBuckets || []).map((bucket) =>
          bucket.id === bucketId
            ? { ...bucket, balance: Number(bucket.balance || 0) + signedAmount }
            : bucket,
        ),
        reserveBucketMovements: [...(currentData.reserveBucketMovements || []), movement],
      };
    });
  }

  function deleteManualReserveMovement(movementId) {
    if (!movementId) return;

    setFinanceData((currentData) => {
      const movementToDelete = (currentData.reserveBucketMovements || []).find(
        (movement) => movement.id === movementId,
      );
      if (!movementToDelete) return currentData;

      const movementAmount = Number(movementToDelete.amount || 0);
      const balanceDelta = movementToDelete.type === 'withdrawal' ? movementAmount : -movementAmount;

      return {
        ...currentData,
        reserveBuckets: (currentData.reserveBuckets || []).map((bucket) =>
          bucket.id === movementToDelete.bucketId
            ? { ...bucket, balance: Number(bucket.balance || 0) + balanceDelta }
            : bucket,
        ),
        reserveBucketMovements: (currentData.reserveBucketMovements || []).filter(
          (movement) => movement.id !== movementId,
        ),
      };
    });
  }

  function transferFromCurrentWeekToReserve({ bucketId, date, amount, note }) {
    const transferAmount = Number(amount || 0);
    if (!bucketId || transferAmount <= 0) return;

    setFinanceData((currentData) => {
      if (!currentData.activeWeek) return currentData;

      const targetBucket = (currentData.reserveBuckets || []).find((bucket) => bucket.id === bucketId);
      const movement = {
        id: `reserve-transfer-${Date.now()}`,
        date,
        bucketId,
        bucketName: targetBucket?.name || 'Reserva',
        type: 'deposit',
        fundingSource: 'weekly-income',
        amount: transferAmount,
        note: note || '',
      };

      return {
        ...currentData,
        reserveBuckets: (currentData.reserveBuckets || []).map((bucket) =>
          bucket.id === bucketId
            ? { ...bucket, balance: Number(bucket.balance || 0) + transferAmount }
            : bucket,
        ),
        activeWeek: {
          ...currentData.activeWeek,
          reserveMovements: [...(currentData.activeWeek.reserveMovements || []), movement],
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function deleteActiveWeekReserveMovement(movementId) {
    if (!movementId) return;

    setFinanceData((currentData) => {
      if (!currentData.activeWeek) return currentData;

      const movementToDelete = (currentData.activeWeek.reserveMovements || []).find(
        (movement) => movement.id === movementId,
      );
      if (!movementToDelete) return currentData;

      const movementAmount = Number(movementToDelete.amount || 0);
      const balanceDelta = movementToDelete.type === 'withdrawal' ? movementAmount : -movementAmount;

      return {
        ...currentData,
        reserveBuckets: (currentData.reserveBuckets || []).map((bucket) =>
          bucket.id === movementToDelete.bucketId
            ? { ...bucket, balance: Number(bucket.balance || 0) + balanceDelta }
            : bucket,
        ),
        activeWeek: {
          ...currentData.activeWeek,
          reserveMovements: (currentData.activeWeek.reserveMovements || []).filter(
            (movement) => movement.id !== movementId,
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  function adjustReserveBucketBalance(bucketId, delta) {
    if (!bucketId || bucketId === 'weekly-income' || Number(delta || 0) === 0) return;

    setFinanceData((currentData) => ({
      ...currentData,
      reserveBuckets: (currentData.reserveBuckets || []).map((bucket) =>
        bucket.id === bucketId
          ? { ...bucket, balance: Number(bucket.balance || 0) + Number(delta || 0) }
          : bucket,
      ),
    }));
  }

  function closeActiveWeek(record) {
    setFinanceData((currentData) => ({
      ...currentData,
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

  function reopenWeeklyRecord(recordId) {
    setFinanceData((currentData) => {
      const recordToReopen = (currentData.weeklyRecords || []).find((record) => record.id === recordId);
      if (!recordToReopen) return currentData;

      return {
        ...currentData,
        activeWeek: {
          ...recordToReopen,
          weekStartDate: recordToReopen.weekStartDate || recordToReopen.weekDate,
          weekDate: recordToReopen.weekDate || recordToReopen.weekStartDate,
          updatedAt: new Date().toISOString(),
        },
        weeklyRecords: (currentData.weeklyRecords || []).filter((record) => record.id !== recordId),
      };
    });
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
            <WeeklyActionPlan financeData={financeData} weeklySummary={weeklySummary} />
            <WeeklyStatus summary={weeklySummary} statusOverride={weeklyStatusOverride} />

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Ingreso usado esta semana" value={weeklySummary.weeklyIncome} helper="Saldo inicial + ingreso principal usado + ingresos extra de la semana activa." />
              <StatCard label="Disponible para deudas" value={weeklySummary.availableForDebt} helper="Después de números semanales, servicios, supermercado y combustible." tone="strong" />
              <StatCard
                label={marginAfterMinimumSafe < 0 ? 'Faltante para mínimo seguro' : 'Margen después del mínimo seguro'}
                value={Math.abs(marginAfterMinimumSafe)}
                helper={
                  marginAfterMinimumSafe < 0
                    ? 'Eso faltaría para cubrir el piso seguro esta semana.'
                    : 'Estimado después de pagar lo necesario para estar tranquilo.'
                }
                tone={marginAfterMinimumSafe < 0 ? 'danger' : 'positive'}
              />
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Pagos semanales</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard label="Mínimo base semanal" value={weeklySummary.minimumToAvoidExpiry} helper="Piso interest-free para llegar a vencimientos." />
                <StatCard label="Colchón GEM semanal" value={weeklyGemBuffer} helper="Buffer conservador por mínimos GEM." />
                <StatCard label="Mínimo semanal seguro" value={minimumSafeWeeklyPayment} helper="El piso que conviene tomar en serio." tone="warning" />
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Motor de decision</p>
              <p className="mt-2 text-base leading-7 text-stone-800">{decisionMessage}</p>
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
                minimumToAvoidExpiry: weeklySummary.minimumToAvoidExpiry,
                extraSuggestedPayment,
                minimumSafeWeeklyPayment,
                totalRecommendedPayment,
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
            onReopenWeek={reopenWeeklyRecord}
            onUpdateWeek={updateWeeklyRecord}
            onCloseWeek={closeActiveWeek}
            onReserveBucketBalanceChange={adjustReserveBucketBalance}
            onStartActiveWeek={startActiveWeek}
            onUpdateActiveWeek={updateActiveWeek}
          />
        )}

        {activeTab === 'reserves' && (
          <ReserveBuckets
            activeWeek={financeData.activeWeek || null}
            buckets={financeData.reserveBuckets || []}
            canTransferFromCurrentWeek={Boolean(financeData.activeWeek)}
            onAddMovement={addReserveMovement}
            onDeleteActiveWeekReserveMovement={deleteActiveWeekReserveMovement}
            onDeleteManualReserveMovement={deleteManualReserveMovement}
            onTransferFromCurrentWeek={transferFromCurrentWeekToReserve}
            onUpdateBucket={updateReserveBucket}
            reserveBucketMovements={financeData.reserveBucketMovements || []}
            weeklyRecords={financeData.weeklyRecords || []}
          />
        )}

        {activeTab === 'simulator' && <ScenarioSimulator financeData={effectiveFinanceData} />}

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
