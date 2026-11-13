const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function assertCompatiblePlans(plans = []) {
  if (!Array.isArray(plans)) throw new Error('La lista de planes no es compatible.');
  for (const plan of plans) {
    if (!isObject(plan) || plan.calculationMode === 'fixedWeekly' ||
        (plan.type != null && !['promotional-plan', 'statement-balance'].includes(plan.type))) {
      throw new Error('Hay planes que esta versión no puede interpretar con seguridad.');
    }
    const rule = plan.minimumPaymentRule;
    if (rule != null && (!isObject(rule) || !['percentageOrFixedMinimum', 'fixedMonthlyMinimum'].includes(rule.type) ||
        (rule.frequency != null && rule.frequency !== 'monthly'))) {
      throw new Error('Hay reglas de mínimos que esta versión no puede interpretar con seguridad.');
    }
  }
}

export function validateFinanceData(data) {
  if (!isObject(data) || !Array.isArray(data.cards) || !Array.isArray(data.paymentPlans) || !isObject(data.variableBudgets)) {
    throw new Error('Los datos financieros no tienen una estructura compatible.');
  }
  for (const key of ['cards', 'paymentPlans', 'weeklyExpenses', 'monthlyExpenses', 'fixedExpenses', 'reserveBuckets', 'weeklyRecords', 'reserveBucketMovements']) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || data[key].some((item) => !isObject(item)))) {
      throw new Error('Hay listas financieras con un formato incompatible.');
    }
  }
  for (const week of [...(data.weeklyRecords || []), ...(data.activeWeek == null ? [] : [data.activeWeek])]) {
    if (!isObject(week)) throw new Error('El formato de una semana no es compatible.');
    for (const key of ['payments', 'extraIncome', 'variableTransactions', 'reserveMovements']) {
      if (week[key] !== undefined && (!Array.isArray(week[key]) || week[key].some((item) => !isObject(item)))) {
        throw new Error('Los movimientos de una semana no son compatibles.');
      }
    }
  }
  assertCompatiblePlans(data.paymentPlans);
  function checkAmounts(items, fields) {
    for (const item of items) {
      for (const field of fields) {
        if (item[field] != null && !['number', 'string'].includes(typeof item[field])) throw new Error('Hay importes incompatibles.');
        if (item[field] != null && !Number.isFinite(Number(item[field]))) throw new Error('Hay importes incompatibles.');
      }
    }
  }
  checkAmounts([data], ['weeklyIncome']);
  checkAmounts([data.variableBudgets], ['groceries', 'fuel']);
  checkAmounts(data.paymentPlans, ['balance', 'originalAmount', 'thirdPartyContribution']);
  checkAmounts(data.paymentPlans.map((plan) => plan.minimumPaymentRule || {}), ['percentage', 'fixedMinimum', 'amount']);
  for (const key of ['weeklyExpenses', 'monthlyExpenses', 'fixedExpenses', 'reserveBuckets', 'reserveBucketMovements']) {
    checkAmounts(data[key] || [], ['amount', 'balance']);
  }
  for (const week of [...(data.weeklyRecords || []), ...(data.activeWeek == null ? [] : [data.activeWeek])]) {
    checkAmounts([week], ['income', 'realIncome', 'openingBalance']);
    for (const key of ['payments', 'extraIncome', 'variableTransactions', 'reserveMovements']) checkAmounts(week[key] || [], ['amount']);
  }
  return data;
}
