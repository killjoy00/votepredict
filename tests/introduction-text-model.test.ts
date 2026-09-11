import test from 'node:test';
import assert from 'node:assert/strict';
import { predictIntroductionTitleModel } from '../src/evaluation/introduction-model.js';
import {
  evaluateIntroductionTextModelChronologically,
  incrementalIntroductionTextTokens,
  introductionPreamble,
  predictIntroductionTextModel,
  trainIntroductionTextModel,
  type IntroductionTextObservation,
} from '../src/evaluation/introduction-text-model.js';

test('bill preamble stops before enacted body and caps text length', () => {
  const raw = 'A bill for an act relating to housing; establishing grants.\n\nBE IT ENACTED BY THE LEGISLATURE OF THE STATE OF MINNESOTA:\nSection 1. secret body token';
  const preamble = introductionPreamble(raw);
  assert.match(preamble, /housing/);
  assert.doesNotMatch(preamble, /secret body token/);
  assert.equal(introductionPreamble('abcdefghij', 5), 'abcde');
});

test('resolution preamble stops before the first whereas clause', () => {
  const raw = 'A joint resolution relating to Religious Freedom Day.\n\nWHEREAS, historical background should not enter the purpose-only feature; and\n\nBE IT RESOLVED by the Legislature.';
  const preamble = introductionPreamble(raw);
  assert.equal(preamble, 'A joint resolution relating to Religious Freedom Day.');
  assert.doesNotMatch(preamble, /historical background/i);
});

test('incremental text tokens exclude title tokens', () => {
  const tokens = incrementalIntroductionTextTokens(
    'Housing grants established.',
    'A bill for an act relating to housing; establishing grants; creating a revolving loan program. BE IT ENACTED BY THE LEGISLATURE',
  );
  assert.ok(!tokens.includes('housing'));
  assert.ok(!tokens.includes('grants'));
  assert.ok(tokens.includes('revolving'));
  assert.ok(tokens.includes('loan'));
  assert.ok(tokens.includes('program'));
});

test('unavailable initial text falls back exactly to title prediction', () => {
  const rows: IntroductionTextObservation[] = [
    { billId: 'a', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'housing grants', billNumber: 1, initialText: 'A bill for an act relating to housing; creating grants. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 0 },
    { billId: 'b', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'education funding', billNumber: 2, initialText: 'A bill for an act relating to education; funding schools. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 1 },
  ];
  const model = trainIntroductionTextModel(rows, { titleOptions: { minTokenSupport: 1 }, textMinSupport: 1 });
  const prediction = predictIntroductionTextModel(model, { title: 'housing grants', initialText: null, initialTextAvailableAtIntroduction: false });
  const titleOnly = predictIntroductionTitleModel(model.titleModel, 'housing grants');
  assert.equal(prediction, titleOnly);
});

test('available initial text cannot silently be missing', () => {
  const rows: IntroductionTextObservation[] = [{
    billId: 'a', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'housing grants', billNumber: 1,
    initialText: null, initialTextAvailableAtIntroduction: true, outcome: 0,
  }];
  assert.throws(() => trainIntroductionTextModel(rows), /initial text is missing/);
});

test('chronological text evaluation trains only on earlier biennia', () => {
  const rows: IntroductionTextObservation[] = [
    { billId: 'a', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'housing', billNumber: 1, initialText: 'A bill for an act relating to housing; revolving loan. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 0 },
    { billId: 'b', sessionSlug: '2021-2022', sessionStart: '2021-01-05', chamber: 'house', title: 'education', billNumber: 2, initialText: 'A bill for an act relating to education; school aid. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 1 },
    { billId: 'c', sessionSlug: '2023-2024', sessionStart: '2023-01-03', chamber: 'house', title: 'housing', billNumber: 3, initialText: 'A bill for an act relating to housing; revolving loan. BE IT ENACTED BY THE LEGISLATURE', initialTextAvailableAtIntroduction: true, outcome: 0 },
    { billId: 'd', sessionSlug: '2025-2026', sessionStart: '2025-01-14', chamber: 'house', title: 'education', billNumber: 4, initialText: null, initialTextAvailableAtIntroduction: false, outcome: 1 },
  ];
  const predictions = evaluateIntroductionTextModelChronologically(rows, { titleOptions: { minTokenSupport: 1 }, textMinSupport: 1 });
  assert.deepEqual(predictions.map((row) => row.billId), ['c', 'd']);
  assert.ok(predictions.every((row) => row.model === 'intro-title-text-eb-v4'));
});
