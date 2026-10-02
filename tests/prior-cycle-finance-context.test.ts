import test from 'node:test';
import assert from 'node:assert/strict';
import { priorCycleFinanceContextFromRows } from '../src/evidence/prior-cycle-finance-context.js';

test('maps proven prior-cycle finance without merging sessions or families', () => {
  const context = priorCycleFinanceContextFromRows([
    {
      source_session: '2021-2022',
      contribution_rows: 14,
      contribution_amount: 12000,
      expenditure_rows: 5,
      expenditure_amount: 7000,
      independent_expenditure_rows: 2,
      independent_expenditure_amount: 3000,
      earliest_proven_available_on: '2022-11-01',
      latest_proven_available_on: '2023-02-01',
    },
    {
      source_session: '2023-2024',
      contribution_rows: 20,
      contribution_amount: 18000,
      expenditure_rows: 4,
      expenditure_amount: 6000,
      independent_expenditure_rows: 0,
      independent_expenditure_amount: 0,
      earliest_proven_available_on: '2024-01-05',
      latest_proven_available_on: '2024-12-15',
    },
  ]);

  assert.equal(context.length, 2);
  assert.deepEqual(context[0], {
    sourceSession: '2021-2022',
    contributionRows: 14,
    contributionAmount: 12000,
    expenditureRows: 5,
    expenditureAmount: 7000,
    independentExpenditureRows: 2,
    independentExpenditureAmount: 3000,
    earliestProvenAvailableOn: '2022-11-01',
    latestProvenAvailableOn: '2023-02-01',
  });
  assert.equal(context[1]?.sourceSession, '2023-2024');
  assert.equal(context[1]?.independentExpenditureRows, 0);
});

test('keeps unknown proof bounds absent instead of inventing a date', () => {
  const [context] = priorCycleFinanceContextFromRows([{
    source_session: '2021-2022',
    contribution_rows: 0,
    contribution_amount: 0,
    expenditure_rows: 0,
    expenditure_amount: 0,
    independent_expenditure_rows: 1,
    independent_expenditure_amount: 100,
    earliest_proven_available_on: null,
    latest_proven_available_on: null,
  }]);

  assert.equal(context?.earliestProvenAvailableOn, undefined);
  assert.equal(context?.latestProvenAvailableOn, undefined);
});
