export const sampleFinanceData = {
  weeklyIncome: 1280,
  weeklyExpenses: [
    { id: 'rent', name: 'Alquiler', amount: 520 },
    { id: 'argentina-card', name: 'Tarjeta Argentina', amount: 75 },
  ],
  monthlyExpenses: [
    { id: 'netflix', name: 'Netflix', amount: 25 },
    { id: 'gpt-plus', name: 'GPT Plus', amount: 20 },
    { id: 'cellphone', name: 'Celular', amount: 50 },
    { id: 'siteground', name: 'SiteGround', amount: 35 },
    { id: 'car-insurance', name: 'Seguro auto', amount: 180 },
  ],
  variableBudgets: {
    groceries: 190,
    fuel: 85,
  },
  cards: [
    { id: 'gem-visa', name: 'GEM Visa', color: '#0f766e' },
    { id: 'purple-visa', name: 'Purple Visa', color: '#7c3aed' },
    { id: 'travel-card', name: 'Travel Card', color: '#b45309' },
  ],
  paymentPlans: [
    {
      id: 'gem-fridge',
      name: 'Heladera',
      cardId: 'gem-visa',
      balance: 860,
      dueDate: '2026-06-23',
      thirdPartyContribution: 0,
    },
    {
      id: 'purple-dentist',
      name: 'Dentista',
      cardId: 'purple-visa',
      balance: 1320,
      dueDate: '2026-08-04',
      thirdPartyContribution: 180,
    },
    {
      id: 'gem-laptop',
      name: 'Notebook',
      cardId: 'gem-visa',
      balance: 2450,
      dueDate: '2027-08-28',
      thirdPartyContribution: 0,
    },
    {
      id: 'travel-flights',
      name: 'Vuelos familiares',
      cardId: 'travel-card',
      balance: 640,
      dueDate: '2026-05-18',
      thirdPartyContribution: 120,
    },
  ],
  weeklyRecords: [],
};
