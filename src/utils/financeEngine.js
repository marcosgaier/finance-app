import { calculateWeeksUntilDue } from './dateUtils.js';

const urgencyRank = {
  overdue: 0,
  urgent: 1,
  attention: 2,
  calm: 3,
};

const urgencyLabels = {
  overdue: 'Atrasado',
  urgent: 'Urgente',
  attention: 'Atención',
  calm: 'Tranquilo',
};

const urgencyDescriptions = {
  overdue: 'La fecha ya pasó, conviene resolverlo antes de nuevos planes.',
  urgent: 'Vence en 4 semanas o menos, por eso toma prioridad alta.',
  attention: 'Vence dentro de 5 a 12 semanas, ya necesita una reserva consistente.',
  calm: 'Vence en más de 12 semanas, se mantiene visible sin presionar de más.',
};

const monthlyServiceTemplates = [
  { id: 'netflix', name: 'Netflix', amount: 25 },
  { id: 'gpt-plus', name: 'GPT Plus', amount: 20 },
  { id: 'cellphone', name: 'Celular', amount: 50 },
  { id: 'siteground', name: 'SiteGround', amount: 35 },
  { id: 'car-insurance', name: 'Seguro auto', amount: 180 },
];

const reserveBucketTemplates = [
  { id: 'emergency-fund', name: 'Fondo de emergencia', balance: 0, note: '' },
  { id: 'bbva', name: 'BBVA Argentina', balance: 0, note: '' },
  { id: 'free-savings', name: 'Ahorro libre', balance: 0, note: '' },
];

const smartExtraAllocationRatio = 0.65;
const gemCardNamePattern = /gem/i;
const approximateWeeksPerMonthlyCycle = 30 / 7;

export function calculateUrgency(weeksUntilDue) {
  if (weeksUntilDue < 0) return 'overdue';
  if (weeksUntilDue <= 4) return 'urgent';
  if (weeksUntilDue <= 12) return 'attention';
  return 'calm';
}

export function calculateWeeklyAvailable(financeData) {
  const normalizedData = normalizeFinanceData(financeData);
  const weeklyExpensesTotal = normalizedData.weeklyExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const monthlyExpensesTotal = normalizedData.monthlyExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const monthlyReserveWeekly = (monthlyExpensesTotal / 30) * 7;
  const groceries = Number(financeData.variableBudgets.groceries || 0);
  const fuel = Number(financeData.variableBudgets.fuel || 0);
  const weeklyIncome = Number(financeData.weeklyIncome || 0);
  const availableBeforeDebt = weeklyIncome - weeklyExpensesTotal - monthlyReserveWeekly - groceries - fuel;

  return {
    weeklyIncome,
    fixedTotal: weeklyExpensesTotal + monthlyReserveWeekly,
    weeklyExpensesTotal,
    monthlyExpensesTotal,
    monthlyReserveWeekly,
    groceries,
    fuel,
    availableBeforeDebt,
    availableForDebt: availableBeforeDebt,
  };
}

export function normalizeFinanceData(financeData) {
  const paymentPlans = (financeData.paymentPlans || [])
    .filter((plan) => plan.calculationMode !== 'fixedWeekly')
    .map((plan) => ({
      ...plan,
      originalAmount: Number(plan.originalAmount ?? plan.balance ?? 0),
      minimumPaymentRule: normalizeMinimumPaymentRule(plan.minimumPaymentRule),
    }));
  const weeklyRecords = financeData.weeklyRecords || [];
  const reserveBuckets = normalizeReserveBuckets(financeData.reserveBuckets);

  if (financeData.weeklyExpenses && financeData.monthlyExpenses) {
    return {
      ...financeData,
      weeklyExpenses: normalizeWeeklyExpenses(financeData.weeklyExpenses),
      monthlyExpenses: normalizeMonthlyServices(financeData.monthlyExpenses),
      paymentPlans,
      weeklyRecords,
      reserveBuckets,
    };
  }

  const legacyFixedExpenses = financeData.fixedExpenses || [];
  const weeklyExpenses = legacyFixedExpenses.filter((expense) => expense.id === 'rent');
  const monthlyExpenses = legacyFixedExpenses
    .filter((expense) => expense.id !== 'rent')
    .map((expense) => ({
      ...expense,
      amount: Number(expense.amount || 0) * 4.2857,
    }));

  return {
    ...financeData,
    weeklyExpenses: normalizeWeeklyExpenses(weeklyExpenses),
    monthlyExpenses: normalizeMonthlyServices(monthlyExpenses),
    paymentPlans,
    weeklyRecords,
    reserveBuckets,
  };
}

function normalizeReserveBuckets(reserveBuckets = []) {
  const bucketsById = Object.fromEntries(reserveBuckets.map((bucket) => [bucket.id, bucket]));

  return reserveBucketTemplates.map((template) => {
    const bucket = bucketsById[template.id];
    return {
      ...template,
      ...bucket,
      balance: Number(bucket?.balance ?? template.balance),
      note: bucket?.note ?? template.note,
    };
  });
}

function normalizeMinimumPaymentRule(rule) {
  if (!rule || rule.enabled === false) return null;

  if (rule.type === 'percentageOrFixedMinimum') {
    return {
      enabled: true,
      type: 'percentageOrFixedMinimum',
      percentage: Number(rule.percentage || 0),
      fixedMinimum: Number(rule.fixedMinimum || 0),
      frequency: 'monthly',
    };
  }

  if (rule.type === 'fixedMonthlyMinimum') {
    return {
      enabled: true,
      type: 'fixedMonthlyMinimum',
      amount: Number(rule.amount || 0),
      frequency: 'monthly',
    };
  }

  return null;
}

function normalizeWeeklyExpenses(weeklyExpenses = []) {
  const expensesById = Object.fromEntries(weeklyExpenses.map((expense) => [expense.id, expense]));
  const templates = [
    { id: 'rent', name: 'Alquiler', amount: 520 },
    { id: 'argentina-card', name: 'Tarjeta Argentina', amount: 75 },
  ];

  if (weeklyExpenses.length > 0 && templates.some((template) => expensesById[template.id])) {
    return weeklyExpenses;
  }

  return templates;
}

function normalizeMonthlyServices(monthlyExpenses = []) {
  const expensesById = Object.fromEntries(monthlyExpenses.map((expense) => [expense.id, expense]));
  const legacyPhone = expensesById.phone;
  const legacySubscriptions = expensesById.subscriptions;

  if (monthlyExpenses.length > 0 && monthlyServiceTemplates.some((template) => expensesById[template.id])) {
    return monthlyExpenses;
  }

  return monthlyServiceTemplates.map((template) => {
    if (template.id === 'cellphone' && legacyPhone) return { ...template, amount: Number(legacyPhone.amount || template.amount) };
    if (template.id === 'netflix' && legacySubscriptions) return { ...template, amount: template.amount };
    return template;
  });
}

export function calculateBaseWeeklyPayment(plan, referenceDate = new Date()) {
  const weeksUntilDue = calculateWeeksUntilDue(plan.dueDate, referenceDate);
  const adjustedBalance = Math.max(0, Number(plan.balance || 0) - Number(plan.thirdPartyContribution || 0));
  const payableWeeks = Math.max(1, weeksUntilDue);

  return {
    adjustedBalance,
    weeksUntilDue,
    baseWeeklyPayment: adjustedBalance / payableWeeks,
  };
}

export function calculateRecommendedWeeklyPayment(plan, weeklyAvailable, referenceDate = new Date()) {
  const base = calculateBaseWeeklyPayment(plan, referenceDate);
  const urgency = calculateUrgency(base.weeksUntilDue);
  const requiredWeeklyPayment = Math.min(base.adjustedBalance, Math.max(0, base.baseWeeklyPayment));

  return {
    ...base,
    urgency,
    urgencyLabel: urgencyLabels[urgency],
    requiredWeeklyPayment,
    recommendedPayment: requiredWeeklyPayment,
    rolloverPressure: requiredWeeklyPayment,
    explanation: buildRecommendationExplanation(urgency, base.weeksUntilDue, base.baseWeeklyPayment, requiredWeeklyPayment, requiredWeeklyPayment),
  };
}

export function buildRecommendationExplanation(urgency, weeksUntilDue, baseWeeklyPayment, recommendedPayment, rolloverPressure) {
  const weekText = weeksUntilDue < 0 ? 'ya venció' : `faltan ${weeksUntilDue} semana${weeksUntilDue === 1 ? '' : 's'}`;
  const standaloneText = `Si este plan estuviera solo, pediría ${formatMoney(baseWeeklyPayment)} por semana.`;

  if (recommendedPayment < baseWeeklyPayment) {
    return `${urgencyDescriptions[urgency]} ${standaloneText} Como los pagos de vencimientos anteriores se liberan después, esta semana alcanza con sumar ${formatMoney(recommendedPayment)} para sostener una reserva total de ${formatMoney(rolloverPressure)}.`;
  }

  if (urgency === 'calm') {
    return `${urgencyDescriptions[urgency]} ${standaloneText} Para llegar sin correr al final, conviene sumar ${formatMoney(recommendedPayment)} a la reserva semanal.`;
  }
  return `${urgencyDescriptions[urgency]} Como ${weekText}, necesitás reservar ${formatMoney(recommendedPayment)} por semana para cubrirlo a tiempo.`;
}

export function enrichPaymentPlans(financeData, referenceDate = new Date()) {
  const budget = calculateWeeklyAvailable(financeData);
  const cardsById = Object.fromEntries(financeData.cards.map((card) => [card.id, card]));

  const standalonePlans = financeData.paymentPlans
    .map((plan) => ({
      ...plan,
      card: cardsById[plan.cardId],
      ...calculateRecommendedWeeklyPayment(plan, budget.availableBeforeDebt, referenceDate),
    }))
    .sort(sortPlansByPriority);

  return applyRolloverRecommendations(standalonePlans);
}

export function applyRolloverRecommendations(plans) {
  let cumulativeBalance = 0;
  let currentWeeklyPressure = 0;

  return plans.map((plan) => {
    cumulativeBalance += plan.adjustedBalance;
    const payableWeeks = Math.max(1, plan.weeksUntilDue);
    const pressureAtDeadline = cumulativeBalance / payableWeeks;
    const nextWeeklyPressure = Math.max(currentWeeklyPressure, pressureAtDeadline);
    const recommendedPayment = Math.min(plan.adjustedBalance, Math.max(0, nextWeeklyPressure - currentWeeklyPressure));
    currentWeeklyPressure = nextWeeklyPressure;

    return {
      ...plan,
      recommendedPayment,
      smartExtraPayment: 0,
      totalRecommendedPayment: recommendedPayment,
      rolloverPressure: currentWeeklyPressure,
      explanation: buildRecommendationExplanation(
        plan.urgency,
        plan.weeksUntilDue,
        plan.baseWeeklyPayment,
        recommendedPayment,
        currentWeeklyPressure,
      ),
    };
  });
}

export function classifyLifeMargin(lifeMargin) {
  if (lifeMargin < 0) return { key: 'critical', label: 'Crítico', tone: 'danger' };
  if (lifeMargin < 30) return { key: 'very-tight', label: 'Muy justo', tone: 'warning' };
  if (lifeMargin < 75) return { key: 'tight', label: 'Ajustado', tone: 'warning' };
  if (lifeMargin < 150) return { key: 'manageable', label: 'Manejable', tone: 'positive' };
  return { key: 'comfortable', label: 'Cómodo', tone: 'positive' };
}

export function buildDecisionMessage(summary) {
  if (summary.weeklyShortfall > 0) {
    return `Esta semana quedás ${formatMoney(summary.weeklyShortfall)} corto para no vencer. Necesitás compensarlo antes del próximo vencimiento.`;
  }

  if (summary.smartExtraReserve > 0) {
    return `Llegás a los vencimientos. Pagar ${formatMoney(summary.recommendedPayment)} esta semana suma ${formatMoney(summary.smartExtraReserve)} extra para acelerar deuda y te deja ${formatMoney(summary.lifeMargin)} de margen.`;
  }

  return `Llegás a los vencimientos con el mínimo de ${formatMoney(summary.minimumToAvoidExpiry)}. No sugiero extra porque conviene proteger tu margen de vida.`;
}

export function buildWeeklyStatus(summary) {
  if (summary.weeklyShortfall > 0) {
    return {
      label: 'Semana crítica',
      tone: 'danger',
      message: `Te faltan ${formatMoney(summary.weeklyShortfall)} para cubrir el mínimo y no caer en vencimientos.`,
    };
  }

  if (summary.lifeMargin < 30) {
    return {
      label: 'Llegás muy justo',
      tone: 'warning',
      message: `Cubrirías el mínimo, pero quedarías con solo ${formatMoney(summary.lifeMargin)} libres esta semana.`,
    };
  }

  if (summary.lifeMargin < 75) {
    return {
      label: 'Llegás ajustado',
      tone: 'warning',
      message: `Llegás a los vencimientos y te quedan ${formatMoney(summary.lifeMargin)} de margen.`,
    };
  }

  if (summary.smartExtraReserve > 0) {
    return {
      label: 'Llegás y acelerás',
      tone: 'positive',
      message: `Podés cubrir el mínimo, pagar ${formatMoney(summary.smartExtraReserve)} extra y quedar con ${formatMoney(summary.lifeMargin)} libres.`,
    };
  }

  return {
    label: 'Llegás bien',
    tone: 'positive',
    message: `Cubriendo el mínimo de ${formatMoney(summary.minimumToAvoidExpiry)}, te quedan ${formatMoney(summary.lifeMargin)} libres.`,
  };
}

export function applySmartExtraPayments(plans, extraBudget) {
  let remainingExtra = Math.max(0, Number(extraBudget || 0));

  return plans.map((plan) => {
    const extraCap = calculatePlanExtraCap(plan);
    const smartExtraPayment = Math.min(remainingExtra, extraCap);
    remainingExtra -= smartExtraPayment;

    return {
      ...plan,
      smartExtraPayment,
      totalRecommendedPayment: plan.recommendedPayment + smartExtraPayment,
    };
  });
}

function calculatePlanExtraCap(plan) {
  const remainingAfterMinimum = Math.max(0, plan.adjustedBalance - plan.recommendedPayment);
  const urgencyMultiplier = {
    overdue: 0.65,
    urgent: 0.5,
    attention: 0.35,
    calm: 0.15,
  }[plan.urgency];

  return Math.min(remainingAfterMinimum, plan.requiredWeeklyPayment * urgencyMultiplier);
}

export function sortPlansByPriority(planA, planB) {
  const urgencyDifference = urgencyRank[planA.urgency] - urgencyRank[planB.urgency];
  if (urgencyDifference !== 0) return urgencyDifference;
  return new Date(planA.dueDate).getTime() - new Date(planB.dueDate).getTime();
}

export function calculateWeeklyDebtReserve(financeData, referenceDate = new Date()) {
  const budget = calculateWeeklyAvailable(financeData);
  const minimumPlans = enrichPaymentPlans(financeData, referenceDate);
  const priorityPlans = minimumPlans.filter((plan) => plan.urgency !== 'calm');
  const calmPlans = minimumPlans.filter((plan) => plan.urgency === 'calm');
  const priorityReserve = priorityPlans.reduce((total, plan) => total + plan.recommendedPayment, 0);
  const calmReserve = calmPlans.reduce((total, plan) => total + plan.recommendedPayment, 0);
  const minimumToAvoidExpiry = priorityReserve + calmReserve;
  const freeAfterMinimum = budget.availableBeforeDebt - minimumToAvoidExpiry;
  const extraCapacity = Math.max(0, budget.availableForDebt - minimumToAvoidExpiry);
  const smartExtraBudget = extraCapacity * smartExtraAllocationRatio;
  const plans = applySmartExtraPayments(minimumPlans, smartExtraBudget);
  const cardSummaries = calculateCardSummaries(financeData.cards, plans);
  const smartExtraReserve = plans.reduce((total, plan) => total + plan.smartExtraPayment, 0);
  const weeklyShortfall = Math.max(0, minimumToAvoidExpiry - budget.availableBeforeDebt);
  const recommendedPayment = Math.max(
    minimumToAvoidExpiry,
    Math.min(minimumToAvoidExpiry + smartExtraReserve, budget.availableForDebt),
  );
  const gemMinimumSummary = calculateGemMinimumSummary(financeData, referenceDate);
  const suggestedSafeWeeklyPayment = recommendedPayment + gemMinimumSummary.weeklyBuffer;
  const lifeMargin = budget.availableBeforeDebt - recommendedPayment;
  const lifeMarginStatus = classifyLifeMargin(lifeMargin);
  const summary = {
    ...budget,
    plans,
    cardSummaries,
    priorityReserve,
    calmReserve,
    minimumToAvoidExpiry,
    minimumDebtReserve: minimumToAvoidExpiry,
    debtReserve: minimumToAvoidExpiry,
    smartExtraReserve,
    recommendedPayment,
    interestFreeRecommendedPayment: recommendedPayment,
    gemMinimumSummary,
    suggestedSafeWeeklyPayment,
    smartDebtReserve: recommendedPayment,
    freeAfterReserve: freeAfterMinimum,
    lifeMarginAfterMinimum: freeAfterMinimum,
    lifeMarginAfterRecommended: lifeMargin,
    lifeMargin,
    lifeMarginStatus,
    weeklyShortfall,
  };

  return {
    ...summary,
    decisionMessage: buildDecisionMessage(summary),
    weeklyStatus: buildWeeklyStatus(summary),
  };
}

export function calculateMonthlyMinimumForPlan(plan) {
  const rule = normalizeMinimumPaymentRule(plan.minimumPaymentRule);
  if (!rule) return 0;

  const originalAmount = Math.max(0, Number(plan.originalAmount ?? plan.balance ?? 0));

  if (rule.type === 'percentageOrFixedMinimum') {
    return Math.max(originalAmount * Number(rule.percentage || 0), Number(rule.fixedMinimum || 0));
  }

  if (rule.type === 'fixedMonthlyMinimum') {
    return Number(rule.amount || 0);
  }

  return 0;
}

export function getGemBillingCycle(referenceDate = new Date()) {
  const date = getLocalStartOfDay(referenceDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const cycleStart = date.getDate() >= 20 ? new Date(year, month, 20) : new Date(year, month - 1, 20);
  const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 19);

  return {
    startDate: toIsoDate(cycleStart),
    endDate: toIsoDate(cycleEnd),
    start: cycleStart,
    end: cycleEnd,
  };
}

export function calculateGemMinimumSummary(financeData, referenceDate = new Date()) {
  const normalizedData = normalizeFinanceData(financeData);
  const gemCards = normalizedData.cards.filter((card) => gemCardNamePattern.test(card.id) || gemCardNamePattern.test(card.name));
  const gemCardIds = new Set(gemCards.map((card) => card.id));
  const cycle = getGemBillingCycle(referenceDate);
  const plans = normalizedData.paymentPlans
    .filter((plan) => gemCardIds.has(plan.cardId))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      cardId: plan.cardId,
      monthlyMinimum: calculateMonthlyMinimumForPlan(plan),
      rule: normalizeMinimumPaymentRule(plan.minimumPaymentRule),
    }))
    .filter((plan) => plan.monthlyMinimum > 0);
  const monthlyMinimumTotal = plans.reduce((total, plan) => total + plan.monthlyMinimum, 0);
  const paymentsThisCycle = calculateCardCyclePayments(normalizedData, gemCardIds, cycle);
  const cycleShortfall = Math.max(0, monthlyMinimumTotal - paymentsThisCycle);
  const weeklySuggestedPayment = cycleShortfall / calculateRemainingWeeklySlots(cycle.end, referenceDate);
  const weeklyBuffer = monthlyMinimumTotal / approximateWeeksPerMonthlyCycle;

  return {
    cardIds: [...gemCardIds],
    cycleStartDate: cycle.startDate,
    cycleEndDate: cycle.endDate,
    plans,
    monthlyMinimumTotal,
    paymentsThisCycle,
    cycleShortfall,
    weeklyBuffer,
    weeklySuggestedPayment,
  };
}

function calculateCardCyclePayments(financeData, cardIds, cycle) {
  const records = [...(financeData.weeklyRecords || [])];
  if (financeData.activeWeek) records.push(financeData.activeWeek);

  return records.reduce((total, record) => {
    const recordDate = new Date(`${record.weekDate || record.weekStartDate || ''}T00:00:00`);
    if (Number.isNaN(recordDate.getTime()) || recordDate < cycle.start || recordDate > cycle.end) return total;

    return (
      total +
      (record.payments || [])
        .filter((payment) => cardIds.has(payment.cardId))
        .reduce((paymentTotal, payment) => paymentTotal + Number(payment.amount || 0), 0)
    );
  }, 0);
}

function calculateRemainingWeeklySlots(cycleEnd, referenceDate = new Date()) {
  const today = getLocalStartOfDay(referenceDate);
  const daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  return Math.max(1, Math.ceil((daysRemaining + 1) / 7));
}

function getLocalStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateCardSummaries(cards, plans) {
  return cards
    .map((card) => {
      const cardPlans = plans.filter((plan) => plan.cardId === card.id);
      const nextDuePlan = [...cardPlans]
        .filter((plan) => plan.weeksUntilDue !== null && plan.adjustedBalance > 0)
        .sort((planA, planB) => new Date(planA.dueDate).getTime() - new Date(planB.dueDate).getTime())[0];

      return {
        ...card,
        planCount: cardPlans.length,
        totalBalance: cardPlans.reduce((total, plan) => total + Number(plan.adjustedBalance || 0), 0),
        minimumPayment: cardPlans.reduce((total, plan) => total + Number(plan.recommendedPayment || 0), 0),
        recommendedPayment: cardPlans.reduce((total, plan) => total + Number(plan.totalRecommendedPayment || 0), 0),
        nextDueDate: nextDuePlan?.dueDate || null,
        nextDuePlanName: nextDuePlan?.name || null,
        nextDueWeeks: nextDuePlan?.weeksUntilDue ?? null,
      };
    })
    .filter((card) => card.planCount > 0 || card.totalBalance > 0);
}

export function simulatePaymentScenario(financeData, weeklyPayment, referenceDate = new Date()) {
  const plans = enrichPaymentPlans(financeData, referenceDate);
  let remainingPayment = Number(weeklyPayment || 0);

  return plans.map((plan) => {
    const suggested = Math.min(plan.adjustedBalance, remainingPayment, plan.totalRecommendedPayment);
    remainingPayment -= suggested;
    const projectedBalance = Math.max(0, plan.adjustedBalance - suggested);

    return {
      ...plan,
      scenarioPayment: suggested,
      projectedBalance,
      coveredThisWeek: suggested >= Math.min(plan.adjustedBalance, plan.recommendedPayment),
    };
  });
}

export function formatMoney(value) {
  const amount = Number(value || 0);
  const hasCents = !Number.isInteger(Math.round(amount * 100) / 100);

  return new Intl.NumberFormat('es-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}
