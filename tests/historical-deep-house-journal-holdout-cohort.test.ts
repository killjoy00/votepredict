import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE,
  HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_TOTAL,
  selectHistoricalDeepHouseJournalHoldoutCases,
} from '../src/evaluation/historical-deep-house-journal-holdout-cohort.js';
import type { HistoricalDeepExpansionCandidate } from '../src/evaluation/historical-deep-expansion-cohort.js';

function candidate(index: number, overrides: Partial<HistoricalDeepExpansionCandidate> = {}): HistoricalDeepExpansionCandidate {
  const current = Array.from({ length: 12 }, (_, member) => `member-${member}`);
  const disagreementCount = index % 13;
  const needOnly = [
    ...current.slice(0, 12 - disagreementCount),
    ...Array.from({ length: disagreementCount }, (_, member) => `alternate-${index}-${member}`),
  ];
  return {
    stableKey: `2025-2026|house|external-${index}`,
    caseKey: `2025-2026|house|HF${index + 1}|2025-03-${String((index % 28) + 1).padStart(2, '0')}`,
    voteEventId: `vote-${index}`,
    externalKey: `external-${index}`,
    identifier: `HF${index + 1}`,
    title: `Holdout fixture ${index}`,
    session: '2025-2026',
    chamber: 'house',
    occurredOn: `2025-03-${String((index % 28) + 1).padStart(2, '0')}`,
    targetVersionId: 'target-v1',
    quickModelVersion: 'quick-v1',
    activeMembers: 134,
    currentDeepTargetIds: current,
    needOnlyTargetIds: needOnly,
    targetOverlap: 12 - disagreementCount,
    targetDisagreementRate: disagreementCount / 12,
    ...overrides,
  };
}

test('freezes exactly 24 2025-2026 House cases with 12 cases in each predeclared tranche', () => {
  const candidates = Array.from({ length: 40 }, (_, index) => candidate(index));
  const result = selectHistoricalDeepHouseJournalHoldoutCases(candidates);

  assert.equal(result.cases.length, HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_TOTAL);
  assert.equal(
    result.cases.filter((item) => item.tranche === 'deterministic-uniform').length,
    HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE,
  );
  assert.equal(
    result.cases.filter((item) => item.tranche === 'selector-disagreement').length,
    HISTORICAL_DEEP_HOUSE_JOURNAL_HOLDOUT_PER_TRANCHE,
  );
  assert.ok(result.cases.every((item) => item.session === '2025-2026' && item.chamber === 'house'));
  assert.equal(new Set(result.cases.map((item) => item.stableKey)).size, result.cases.length);
});

test('ignores development sessions and other chambers before deterministic selection', () => {
  const eligible = Array.from({ length: 40 }, (_, index) => candidate(index));
  const noise = [
    candidate(100, { session: '2023-2024', stableKey: '2023-2024|house|noise' }),
    candidate(101, { chamber: 'senate', stableKey: '2025-2026|senate|noise' }),
  ];
  const result = selectHistoricalDeepHouseJournalHoldoutCases([...eligible, ...noise]);
  assert.ok(result.cases.every((item) => item.session === '2025-2026' && item.chamber === 'house'));
  assert.equal(result.cases.some((item) => item.stableKey.endsWith('|noise')), false);
});

test('selection result contains no outcome or Journal-mechanic fields', () => {
  const result = selectHistoricalDeepHouseJournalHoldoutCases(
    Array.from({ length: 40 }, (_, index) => candidate(index)),
  );
  const serialized = JSON.stringify(result.cases);
  assert.doesNotMatch(serialized, /actualOutcome|actualYes|actualNo|passed|finalPassageInference|mechanicallyActionable|journalDate|mechanic/i);
});

test('fails closed when fewer than the predeclared holdout case count are eligible', () => {
  assert.throws(
    () => selectHistoricalDeepHouseJournalHoldoutCases(Array.from({ length: 20 }, (_, index) => candidate(index))),
    /has \d+ cases; need 12|Expected 24 holdout cases/i,
  );
});
