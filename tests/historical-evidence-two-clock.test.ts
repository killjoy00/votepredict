import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHistoricalFinanceTimelines,
  historicalClockDate,
  historicalFinanceAsOf,
  historicalFinanceFeatures,
  isHistoricalEvidenceUsableBefore,
  type HistoricalFinanceRow,
} from '../src/evaluation/historical-evidence-two-clock.js';

test('two-clock policy separates underlying activity from public availability', () => {
  const row = {
    activityOn: '2022-06-15',
    availableOn: '2024-01-10',
  };
  assert.equal(historicalClockDate(row, 'underlying_activity'), '2022-06-15');
  assert.equal(historicalClockDate(row, 'public_availability'), '2024-01-10');
  assert.equal(isHistoricalEvidenceUsableBefore(row, '2023-03-01', 'underlying_activity'), true);
  assert.equal(isHistoricalEvidenceUsableBefore(row, '2023-03-01', 'public_availability'), false);
});

test('both clocks exclude same-day evidence under date-granular replay', () => {
  const row = {
    activityOn: '2023-05-01',
    availableOn: '2024-02-01',
  };
  assert.equal(isHistoricalEvidenceUsableBefore(row, '2023-05-01', 'underlying_activity'), false);
  assert.equal(isHistoricalEvidenceUsableBefore(row, '2023-05-02', 'underlying_activity'), true);
  assert.equal(isHistoricalEvidenceUsableBefore(row, '2024-02-01', 'public_availability'), false);
  assert.equal(isHistoricalEvidenceUsableBefore(row, '2024-02-02', 'public_availability'), true);
});

test('reporting-period end provides a conservative retrospective activity clock for annual summaries', () => {
  const annualLobbyingSummary = {
    reportingPeriodEndOn: '2022-12-31',
    availableOn: '2024-08-29',
  };
  assert.equal(
    isHistoricalEvidenceUsableBefore(annualLobbyingSummary, '2023-01-01', 'underlying_activity'),
    true,
  );
  assert.equal(
    isHistoricalEvidenceUsableBefore(annualLobbyingSummary, '2022-12-31', 'underlying_activity'),
    false,
  );
  assert.equal(
    isHistoricalEvidenceUsableBefore(annualLobbyingSummary, '2023-01-01', 'public_availability'),
    false,
  );
});

test('finance timelines use the selected clock without changing the feature transform', () => {
  const rows: HistoricalFinanceRow[] = [
    {
      membershipId: 'm1',
      rowKey: 'r1',
      subtype: 'candidate_contribution_record',
      amount: 100,
      activityOn: '2022-01-15',
      availableOn: '2022-03-01',
    },
    {
      membershipId: 'm1',
      rowKey: 'r2',
      subtype: 'candidate_contribution_record',
      amount: 250,
      activityOn: '2022-02-15',
      availableOn: null,
    },
    {
      membershipId: 'm1',
      rowKey: 'r3',
      subtype: 'candidate_expenditure_record',
      amount: 40,
      activityOn: '2022-02-20',
      availableOn: '2022-04-01',
    },
  ];

  const strict = buildHistoricalFinanceTimelines(rows, 'public_availability');
  const retrospective = buildHistoricalFinanceTimelines(rows, 'underlying_activity');

  const strictAtMarch = historicalFinanceAsOf(strict.get('m1'), '2022-03-15');
  const retrospectiveAtMarch = historicalFinanceAsOf(retrospective.get('m1'), '2022-03-15');

  assert.deepEqual(strictAtMarch, {
    available: 1,
    contributionCount: 1,
    contributionAmount: 100,
    expenditureCount: 0,
    expenditureAmount: 0,
  });
  assert.deepEqual(retrospectiveAtMarch, {
    available: 1,
    contributionCount: 2,
    contributionAmount: 350,
    expenditureCount: 1,
    expenditureAmount: 40,
  });
  assert.equal(historicalFinanceFeatures(strictAtMarch).length, 5);
  assert.equal(historicalFinanceFeatures(retrospectiveAtMarch).length, 5);
});
