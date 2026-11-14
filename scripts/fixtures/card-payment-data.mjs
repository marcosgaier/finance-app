export function paymentFixture() {
  return {
    weeklyIncome: 400, weeklyExpenses: [], monthlyExpenses: [], variableBudgets: {groceries: 0, fuel: 0},
    cards: [{id:'gem',name:'GEM Visa'},{id:'other',name:'Otra tarjeta'}],
    reserveBuckets: [{id:'custom-gem-reserve',name:'Fondo GEM ficticio',balance:240},{id:'other-reserve',name:'Otro sobre',balance:20}],
    reserveBucketMovements: [], weeklyRecords: [],
    activeWeek: {id:'active-synthetic',weekStartDate:'2026-11-10',weekDate:'2026-11-10',realIncome:400,income:400,openingBalance:0,extraIncome:[],payments:[],reserveMovements:[],variableTransactions:[],note:'fixture'},
    paymentPlans: [{id:'plan',name:'Financiación ficticia',cardId:'gem',type:'promotional-plan',balance:600,originalAmount:1000,dueDate:'2027-01-05',thirdPartyContribution:0,minimumPaymentRule:{type:'fixedMonthlyMinimum',amount:100}}],
  };
}
export function payment(patch={}) {
  return {id:'payment-synthetic',date:'2026-11-10',cardId:'gem',cardName:'GEM Visa',amount:80,fundingSource:'custom-gem-reserve',note:'fixture',...patch};
}
