import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateIntroductionTimingModelChronologically,
  initialDocumentLeadKey,
  introductionLegislativeYearKey,
  introductionYearMonthKey,
  predictIntroductionTimingModel,
  trainIntroductionTimingModel,
  type IntroductionTimingObservation,
} from '../src/evaluation/introduction-timing-model.js';

test('timing features are deterministic and derived only from introduction-time dates', () => {
  const row = {
    sessionStart: '2025-01-14',
    introducedOn: '2026-03-09',
    initialDocumentOn: '2026-03-06',
  };
  assert.equal(introductionLegislativeYearKey(row), 'year-2');
  assert.equal(introductionYearMonthKey(row), 'year-2:03');
  assert.equal(initialDocumentLeadKey(row), 'two-to-seven-days');
});

test('timing model rejects initial documents that postdate introduction', () => {
  const observations: IntroductionTimingObservation[] = [{
    billId: 'a',
    sessionSlug: '2025-2026',
    sessionStart: '2025-01-14',
    chamber: 'house',
    title: 'housing grants',
    billNumber: 10,
    introducedOn: '2025-01-20',
    initialDocumentOn: '2025-01-21',
    outcome: 0,
  }];
  assert.throws(() => trainIntroductionTimingModel(observations), /postdates introduction/);
});

test('timing model can add a strongly shrunk year-month signal on top of the title model', () => {
  const observations: IntroductionTimingObservation[] = [
    ...Array.from({ length: 100 }, (_, index) => ({
      billId: `jan-${index}`,
      sessionSlug: '2021-2022',
      sessionStart: '2021-01-05',
      chamber: 'house' as const,
      title: 'routine administration',
      billNumber: index + 1,
      introducedOn: `2021-01-${String((index % 20) + 5).padStart(2, '0')}`,
      initialDocumentOn: `2021-01-${String((index % 20) + 4).padStart(2, '0')}`,
      outcome: (index < 2 ? 1 : 0) as 0 | 1,
    })),
    ...Array.from({ length: 100 }, (_, index) => ({
      billId: `mar-${index}`,
      sessionSlug: '2021-2022',
      sessionStart: '2021-01-05',
      chamber: 'house' as const,
      title: 'routine administration',
      billNumber: index + 101,
      introducedOn: `2021-03-${String((index % 20) + 5).padStart(2, '0')}`,
      initialDocumentOn: `2021-03-${String((index % 20) + 4).padStart(2, '0')}`,
      outcome: (index < 20 ? 1 : 0) as 0 | 1,
    })),
  ];
  const model = trainIntroductionTimingModel(observations, {
    titleOptions: { minTokenSupport: 1 },
    timingPriorStrength: 20,
    legislativeYearScale: 0,
    yearMonthScale: 1,
    initialDocumentLeadScale: 0,
  });
  const january = predictIntroductionTimingModel(model, {
    sessionStart: '2021-01-05',
    title: 'routine administration',
    introducedOn: '2021-01-10',
    initialDocumentOn: '2021-01-09',
  });
  const march = predictIntroductionTimingModel(model, {
    sessionStart: '2021-01-05',
    title: 'routine administration',
    introducedOn: '2021-03-10',
    initialDocumentOn: '2021-03-09',
  });
  assert.ok(march > january);
});

test('chronological timing evaluation trains only on earlier biennia', () => {
  const observations: IntroductionTimingObservation[] = [
    {
      billId: 'a', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'housing grant', billNumber: 1,
      introducedOn: '2021-01-10', initialDocumentOn: '2021-01-09', outcome: 0,
    },
    {
      billId: 'b', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'housing grant', billNumber: 2,
      introducedOn: '2021-01-11', initialDocumentOn: '2021-01-10', outcome: 0,
    },
    {
      billId: 'c', sessionSlug: '2023-2024', sessionStart: '2023-01-03', chamber: 'house', title: 'housing grant', billNumber: 3,
      introducedOn: '2023-01-12', initialDocumentOn: '2023-01-11', outcome: 1,
    },
    {
      billId: 'd', sessionSlug: '2025-2026', sessionStart: '2025-01-14', chamber: 'house', title: 'housing grant', billNumber: 4,
      introducedOn: '2025-01-20', initialDocumentOn: '2025-01-19', outcome: 1,
    },
  ];
  const predictions = evaluateIntroductionTimingModelChronologically(observations, {
    titleOptions: { minTokenSupport: 1, priorStrength: 10 },
    timingPriorStrength: 10,
  });
  assert.deepEqual(predictions.map((row) => row.billId), ['c', 'd']);
  assert.ok(predictions.every((row) => row.model === 'intro-title-timing-eb-v3'));
  assert.ok(predictions[0].probability < predictions[1].probability);
});
