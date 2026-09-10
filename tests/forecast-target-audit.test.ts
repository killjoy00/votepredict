import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeForecastTargetSelection } from '../src/evaluation/forecast-target-audit.js';

test('measures selection bias against the complete official bill universe', () => {
  const official = [1, 2, 3, 4].map((fileNumber) => ({
    identifier: `HF${fileNumber}`,
    fileType: 'HF' as const,
    fileNumber,
    statusXmlUrl: `https://api.example/HF/${fileNumber}`,
  }));
  const corpus = [
    { identifier: 'HF1', hasPassageVote: true, hasKnownPassageOutcome: true, passed: true },
    { identifier: 'HF2', hasPassageVote: true, hasKnownPassageOutcome: true, passed: false },
    { identifier: 'HF3', hasPassageVote: false, hasKnownPassageOutcome: false },
    { identifier: 'SF1', hasPassageVote: true, hasKnownPassageOutcome: true, passed: true },
  ];

  const result = summarizeForecastTargetSelection({
    session: '2025-2026',
    body: 'House',
    official,
    corpus,
  });

  assert.equal(result.officialBills, 4);
  assert.equal(result.corpusBills, 3);
  assert.equal(result.corpusCoverage, 0.75);
  assert.equal(result.missingFromCorpus, 1);
  assert.equal(result.billsWithPassageVote, 2);
  assert.equal(result.billsWithoutPassageVote, 1);
  assert.equal(result.knownPassageOutcomes, 2);
  assert.equal(result.knownPasses, 1);
  assert.equal(result.knownFailures, 1);
  assert.equal(result.knownPassRate, 0.5);
  assert.equal(result.officialBillsWithObservedPassage, 2);
  assert.equal(result.officialBillsWithoutObservedPassage, 2);
  assert.equal(result.observedPassageRateAcrossOfficialUniverse, 0.5);
});

test('only compares the file type corresponding to the requested body', () => {
  const result = summarizeForecastTargetSelection({
    session: '2025-2026',
    body: 'Senate',
    official: [
      { identifier: 'SF1', fileType: 'SF', fileNumber: 1, statusXmlUrl: 'https://example/SF1' },
      { identifier: 'HF1', fileType: 'HF', fileNumber: 1, statusXmlUrl: 'https://example/HF1' },
    ],
    corpus: [
      { identifier: 'SF1', hasPassageVote: true, hasKnownPassageOutcome: true, passed: true },
      { identifier: 'HF1', hasPassageVote: true, hasKnownPassageOutcome: true, passed: false },
    ],
  });

  assert.equal(result.officialBills, 1);
  assert.equal(result.corpusBills, 1);
  assert.equal(result.knownPasses, 1);
  assert.equal(result.knownFailures, 0);
});
