import assert from 'node:assert/strict';
import {
  getCreatableFinancialWeekStartDate,
  getFinancialWeekStartDay,
  getNextFinancialWeekStartDate,
  getNextFinancialWeekStartDateAfterClosedRecord,
  getPendingFinancialWeekStartDate,
  isSameIsoDate,
} from '../src/utils/dateUtils.js';
import { normalizeFinanceData } from '../src/utils/financeEngine.js';
import { readFinanceBackup } from '../src/services/backupService.js';

const baseFinanceData = {
  weeklyIncome: 0,
  weeklyExpenses: [],
  monthlyExpenses: [],
  variableBudgets: {
    groceries: 0,
    fuel: 0,
  },
  cards: [],
  paymentPlans: [],
  reserveBuckets: [],
  activeWeek: null,
  weeklyRecords: [],
};

function localDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

function createBackupFile(financeData) {
  const content = JSON.stringify({
    type: 'weekly-finance-planner-backup',
    schemaVersion: 1,
    appVersion: '1.0.0',
    exportedAt: '2026-07-15T00:00:00.000Z',
    financeData,
  });

  return {
    name: 'finance-app-backup.json',
    size: content.length,
    async text() {
      return content;
    },
  };
}

function runFinancialWeekTests() {
  assert.equal(getFinancialWeekStartDay(baseFinanceData), 2, 'old data without settings falls back to Tuesday');
  [
    [5, 5],
    ['5', 5],
    ['2', 2],
    ['bad', 2],
    ['', 2],
    [null, 2],
    [7, 2],
    [-1, 2],
    [2.5, 2],
  ].forEach(([inputValue, expectedValue]) => {
    assert.equal(
      getFinancialWeekStartDay({
        settings: { financialWeekStartDay: inputValue },
      }),
      expectedValue,
      `financialWeekStartDay ${String(inputValue)} normalizes to ${expectedValue}`,
    );

    const normalizedData = normalizeFinanceData({
      ...baseFinanceData,
      settings: { financialWeekStartDay: inputValue },
    });
    assert.equal(
      normalizedData.settings.financialWeekStartDay,
      expectedValue,
      `normalizeFinanceData canonizes ${String(inputValue)} to ${expectedValue}`,
    );
    assert.equal(typeof normalizedData.settings.financialWeekStartDay, 'number');
  });

  const activeWeekData = normalizeFinanceData({
    ...baseFinanceData,
    settings: { financialWeekStartDay: 2 },
    activeWeek: { id: 'active-week-2026-07-14', weekStartDate: '2026-07-14' },
  });
  const changedSettingsData = normalizeFinanceData({
    ...activeWeekData,
    settings: { financialWeekStartDay: 5 },
  });
  assert.equal(
    changedSettingsData.activeWeek.weekStartDate,
    '2026-07-14',
    'changing the setting does not modify the open activeWeek start date',
  );
  assert.equal(
    getPendingFinancialWeekStartDate({
      activeWeekStartDate: '2026-07-14',
      financialWeekStartDay: 5,
      referenceDate: localDate('2026-07-16'),
    }),
    null,
    'changing Tuesday to Friday while the active week is open does not create a false pending week',
  );

  assert.equal(
    getNextFinancialWeekStartDate({
      lastWeekStartDate: '2026-07-14',
      financialWeekStartDay: 5,
    }),
    '2026-07-24',
    'last Tuesday plus new Friday creates the next Friday after the 7-day eligibility limit',
  );
  assert.equal(
    getNextFinancialWeekStartDate({
      lastWeekStartDate: '2026-07-14',
      financialWeekStartDay: 1,
    }),
    '2026-07-27',
    'Tuesday to Monday does not create a week before the eligibility limit',
  );
  assert.equal(
    getNextFinancialWeekStartDate({
      lastWeekStartDate: '2026-07-17',
      financialWeekStartDay: 2,
    }),
    '2026-07-28',
    'Friday to Tuesday does not overlap weeks',
  );
  const saturdayToSunday = getNextFinancialWeekStartDate({
    lastWeekStartDate: '2026-07-18',
    financialWeekStartDay: 0,
  });
  assert.equal(
    saturdayToSunday,
    '2026-07-26',
    'Saturday to Sunday creates the Sunday after the 7-day eligibility limit',
  );
  assert.notEqual(saturdayToSunday, '2026-07-19', 'Saturday to Sunday must not overlap the previous week');
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'transition-tuesday-friday',
        weekStartDate: '2026-07-14',
        closedDate: '2026-07-15',
      },
      financialWeekStartDay: 5,
    }),
    '2026-07-17',
    'Tuesday 14 closed Wednesday 15 with new Friday starts Friday 17',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'transition-same-day',
        weekStartDate: '2026-07-14',
        closedDate: '2026-07-17',
      },
      financialWeekStartDay: 5,
    }),
    '2026-07-17',
    'Tuesday 14 closed Friday 17 with new Friday can start Friday 17',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'transition-tuesday-monday',
        weekStartDate: '2026-07-14',
        closedDate: '2026-07-15',
      },
      financialWeekStartDay: 1,
    }),
    '2026-07-20',
    'Tuesday to Monday after Wednesday close starts the immediate following Monday',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'transition-friday-tuesday',
        weekStartDate: '2026-07-17',
        closedDate: '2026-07-18',
      },
      financialWeekStartDay: 2,
    }),
    '2026-07-21',
    'Friday to Tuesday after Saturday close starts the immediate following Tuesday',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'normal-friday-cycle',
        weekStartDate: '2026-07-17',
        closedDate: '2026-07-18',
      },
      financialWeekStartDay: 5,
    }),
    '2026-07-24',
    'after the transition is consumed, Friday returns to the normal weekly cycle',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'old-record-with-closed-at',
        weekStartDate: '2026-07-14',
        closedAt: '2026-07-15T02:00:00.000Z',
      },
      financialWeekStartDay: 5,
    }),
    '2026-07-17',
    'old records without closedDate can fall back to a valid closedAt local date',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'old-record-no-close-date',
        weekStartDate: '2026-07-14',
        closedAt: 'not-a-date',
      },
      financialWeekStartDay: 5,
    }),
    '2026-07-24',
    'records without a reliable close date fall back to weekStartDate plus the normal cycle',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'near-midnight-close',
        weekStartDate: '2026-07-14',
        closedAt: '2026-07-15T12:30:00.000Z',
      },
      financialWeekStartDay: 3,
    }),
    '2026-07-22',
    'closedAt is interpreted as a local day instead of cutting the UTC string',
  );
  assert.equal(
    getNextFinancialWeekStartDateAfterClosedRecord({
      closedRecord: {
        id: 'invalid-week-start',
        weekStartDate: 'not-a-date',
        closedDate: '2026-07-15',
      },
      financialWeekStartDay: 5,
    }),
    null,
    'invalid weekStartDate does not generate a next financial week',
  );
  assert.equal(isSameIsoDate('2026-07-24', '2026-07-24'), true, 'short ISO dates compare as the same day');
  assert.equal(
    isSameIsoDate('2026-07-24T00:00:00.000Z', '2026-07-24'),
    true,
    'timestamp and short ISO date compare as the same day',
  );
  assert.equal(isSameIsoDate('not-a-date', '2026-07-24'), false, 'invalid dates do not match valid dates');
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-16'),
      weeklyRecords: [],
      financialWeekStartDay: 5,
    }),
    '2026-07-10',
    'without activeWeek or history, the app uses the most recent configured weekday',
  );
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-15'),
      weeklyRecords: [{ id: 'week-1', weekStartDate: '2026-07-10' }],
      financialWeekStartDay: 5,
    }),
    null,
    'a closed week is not duplicated before the next eligible start date arrives',
  );
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-24'),
      weeklyRecords: [{ id: 'week-1', weekStartDate: '2026-07-24T00:00:00.000Z' }],
      financialWeekStartDay: 5,
    }),
    null,
    'a closed week with timestamp is not duplicated as a short ISO active week',
  );
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-16'),
      weeklyRecords: [{ id: 'week-1', weekStartDate: '2026-07-14', closedDate: '2026-07-15' }],
      financialWeekStartDay: 5,
    }),
    null,
    'refresh after closing before the transition date does not create a future week early',
  );
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-17'),
      weeklyRecords: [{ id: 'week-1', weekStartDate: '2026-07-14', closedDate: '2026-07-15' }],
      financialWeekStartDay: 5,
    }),
    '2026-07-17',
    'refresh on the transition date creates the same calculated week',
  );
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-24'),
      weeklyRecords: [{ id: 'week-1', weekStartDate: '2026-07-14' }],
      financialWeekStartDay: 5,
    }),
    '2026-07-24',
    'legacy records without close date keep the safe weekStartDate plus 7-day rule',
  );
  assert.equal(
    getCreatableFinancialWeekStartDate({
      referenceDate: localDate('2026-07-17'),
      weeklyRecords: [
        { id: 'week-1', weekStartDate: '2026-07-14', closedDate: '2026-07-15' },
        { id: 'week-2', weekStartDate: '2026-07-17', closedDate: '2026-07-17' },
      ],
      financialWeekStartDay: 5,
    }),
    null,
    'a closed transition week prevents duplicate activeWeek creation after refresh',
  );

  const historyData = normalizeFinanceData({
    ...baseFinanceData,
    weeklyRecords: [{ id: 'week-1', weekStartDate: '2026-07-14', weekDate: '2026-07-14' }],
    settings: { financialWeekStartDay: 5 },
  });
  assert.equal(historyData.weeklyRecords[0].weekStartDate, '2026-07-14', 'history weekStartDate stays intact');
  assert.equal(historyData.weeklyRecords[0].weekDate, '2026-07-14', 'history weekDate stays intact');
}

async function runBackupTests() {
  const oldBackupPreview = await readFinanceBackup(createBackupFile(baseFinanceData));
  assert.equal(
    oldBackupPreview.financeData.settings.financialWeekStartDay,
    2,
    'old backups without financialWeekStartDay fall back to Tuesday',
  );

  const fridayBackupPreview = await readFinanceBackup(
    createBackupFile({
      ...baseFinanceData,
      settings: { financialWeekStartDay: 5 },
    }),
  );
  assert.equal(
    fridayBackupPreview.financeData.settings.financialWeekStartDay,
    5,
    'backups with financialWeekStartDay keep the configured day',
  );
}

runFinancialWeekTests();
await runBackupTests();
console.log('Financial week tests passed');
