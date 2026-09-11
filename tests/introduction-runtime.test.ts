import assert from 'node:assert/strict';
import test from 'node:test';
import { INTRODUCTION_MODEL_VERSION } from '../src/forecasting/introduction-runtime.js';
import {
  predictIntroductionTextModel,
  trainIntroductionTextModel,
  type IntroductionTextObservation,
} from '../src/evaluation/introduction-text-model.js';

test('production introduction model version stays pinned to evaluated v4', () => {
  assert.equal(INTRODUCTION_MODEL_VERSION, 'intro-title-text-eb-v4');
});

test('v4 title-only fallback never consumes unavailable introduction text', () => {
  const training: IntroductionTextObservation[] = Array.from({ length: 50 }, (_, index) => ({
    billId: `train-${index}`,
    sessionSlug: '2021-2022',
    sessionStart: '2021-01-01',
    chamber: index % 2 ? 'house' : 'senate',
    title: index < 25 ? 'Education funding adjustment' : 'Transportation funding adjustment',
    billNumber: index + 1,
    outcome: index % 10 === 0 ? 1 : 0,
    initialText: 'A bill for an act relating to a historical training measure. BE IT ENACTED BY THE LEGISLATURE',
    initialTextAvailableAtIntroduction: true,
  }));
  const model = trainIntroductionTextModel(training);
  const first = predictIntroductionTextModel(model, {
    title: 'A new proposal',
    initialText: 'This later text contains arbitrary material that must not affect the prediction.',
    initialTextAvailableAtIntroduction: false,
  });
  const second = predictIntroductionTextModel(model, {
    title: 'A new proposal',
    initialText: null,
    initialTextAvailableAtIntroduction: false,
  });
  assert.equal(first, second);
});
