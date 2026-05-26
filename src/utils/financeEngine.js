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

const smartExtraAllocationRatio = 0.65;

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
  const paymentPlans = (financeData.paymentPlans || []).filter((plan) => plan.calculationMode !== 'fixedWeekly');
  const weeklyRecords = financeData.weeklyRecords || [];

  if (financeData.weeklyExpenses && financeData.monthlyExpenses) {
    return {
      ...financeData,
      weeklyExpenses: normalizeWeeklyExpenses(financeData.weeklyExpenses),
      monthlyExpenses: normalizeMonthlyServices(financeData.monthlyExpenses),
      paymentPlans,
      weeklyRecords,
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
  };
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
  return new Intl.NumberFormat('es-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
