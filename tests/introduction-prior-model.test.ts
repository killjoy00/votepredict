import test from 'node:test';
import assert from 'node:assert/strict';
import {
  predictIntroductionTextModel,
  trainIntroductionTextModel,
  type IntroductionTextObservation,
} from '../src/evaluation/introduction-text-model.js';
import {
  canServeIntroductionPrior,
  deserializeIntroductionPriorModelV4,
  predictIntroductionPriorFromArtifact,
  serializeIntroductionPriorModelV4,
} from '../src/forecasting/introduction-prior-model.js';

const rows: IntroductionTextObservation[] = [
  { billId: 'a', sessionSlug: '2021-2022', sessionStart: '2021-01-01', chamber: 'house', title: 'housing grants', billNumber: 1, initialText: 'A bill for an act relating to housing; creating revolving grants. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 0 },
  { billId: 'b', sessionSlug: '2021-2022', sessionStart: '2021-01-01', chamber: 'house', title: 'education funding', billNumber: 2, initialText: 'A bill for an act relating to education; funding school aid. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 1 },
  { billId: 'c', sessionSlug: '2023-2024', sessionStart: '2023-01-01', chamber: 'senate', title: 'housing loans', billNumber: 3, initialText: 'A bill for an act relating to housing; creating revolving loans. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 1 },
];

test('serialized v4 artifact reproduces the in-memory predictor', () => {
  const model = trainIntroductionTextModel(rows, { titleOptions: { minTokenSupport: 1 }, textMinSupport: 1 });
  const artifact = serializeIntroductionPriorModelV4(model, {
    targetSessionSlug: '2025-2026',
    targetSessionStart: '2025-01-01',
    trainedThroughSessionSlug: '2023-2024',
    trainingSessions: ['2021-2022', '2023-2024'],
    trainingRows: rows.length,
    trainingPositives: 2,
    provenance: { authoritativeUniverse: 31_010, generatedAt: '2026-09-11T00:00:00Z', codeSha: 'test', evaluationCommit: 'test' },
  });
  const rehydrated = deserializeIntroductionPriorModelV4(artifact);
  const input = { title: 'housing revolving program', initialText: 'A bill for an act relating to housing; creating revolving loan assistance. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true };
  assert.equal(predictIntroductionTextModel(rehydrated, input), predictIntroductionTextModel(model, input));
});

test('serving artifact is pinned to one target session and fails closed elsewhere', () => {
  const model = trainIntroductionTextModel(rows, { titleOptions: { minTokenSupport: 1 }, textMinSupport: 1 });
  const artifact = serializeIntroductionPriorModelV4(model, {
    targetSessionSlug: '2025-2026', targetSessionStart: '2025-01-01', trainedThroughSessionSlug: '2023-2024',
    trainingSessions: ['2021-2022', '2023-2024'], trainingRows: rows.length, trainingPositives: 2,
    provenance: { authoritativeUniverse: 31_010, generatedAt: '2026-09-11T00:00:00Z', codeSha: 'test', evaluationCommit: 'test' },
  });
  assert.equal(canServeIntroductionPrior(artifact, '2025-2026', '2025-01-01'), true);
  assert.equal(canServeIntroductionPrior(artifact, '2027-2028', '2027-01-01'), false);
  assert.equal(predictIntroductionPriorFromArtifact(artifact, {
    sessionSlug: '2027-2028', sessionStart: '2027-01-01', title: 'housing', initialText: null, initialTextAvailableAtIntroduction: false,
  }), undefined);
});
