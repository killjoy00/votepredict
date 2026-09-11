import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FROZEN_INTRODUCTION_PRIOR_ARTIFACT,
  scoreIntroductionPriorRow,
  type IntroductionPriorBillRow,
} from '../src/forecasting/introduction-prior-runtime.js';

function row(overrides: Partial<IntroductionPriorBillRow> = {}): IntroductionPriorBillRow {
  return {
    session_slug: '2025-2026',
    session_start: '2025-01-01',
    originating_chamber: 'house',
    title: 'Housing assistance funding provided; money appropriated.',
    introduced_on: '2025-02-06',
    model_eligible: 'true',
    raw_text: 'A bill for an act relating to housing; providing housing assistance; appropriating money. BE IT ENACTED BY THE LEGISLATURE',
    text_hash: 'hash',
    in_authoritative_universe: true,
    ...overrides,
  };
}

test('frozen serving artifact has audited 2025-26 identity and support counts', () => {
  assert.equal(FROZEN_INTRODUCTION_PRIOR_ARTIFACT.targetSessionSlug, '2025-2026');
  assert.equal(FROZEN_INTRODUCTION_PRIOR_ARTIFACT.trainingRows, 20_538);
  assert.equal(FROZEN_INTRODUCTION_PRIOR_ARTIFACT.trainingPositives, 402);
  assert.equal(FROZEN_INTRODUCTION_PRIOR_ARTIFACT.titleStats.length, 1_175);
  assert.equal(FROZEN_INTRODUCTION_PRIOR_ARTIFACT.textStats.length, 306);
});

test('eligible introduction text is scored with title and purpose text', () => {
  const scored = scoreIntroductionPriorRow(row());
  assert.ok(scored);
  assert.equal(scored.modelVersion, 'intro-title-text-eb-v4');
  assert.equal(scored.targetKind, 'source_chamber_passage');
  assert.equal(scored.inputMode, 'title+purpose-text');
  assert.equal(scored.originatingChamber, 'house');
  assert.ok(scored.probability >= 0.0025 && scored.probability <= 0.35);
});

test('the known late-posted class receives exact title-only fallback behavior', () => {
  const scored = scoreIntroductionPriorRow(row({ model_eligible: 'false', raw_text: 'LATER TEXT MUST NOT ENTER MODEL', text_hash: 'later-hash' }));
  const noText = scoreIntroductionPriorRow(row({ model_eligible: 'false', raw_text: null, text_hash: null }));
  assert.ok(scored && noText);
  assert.equal(scored.inputMode, 'title-only-fallback');
  assert.equal(scored.probability, noText.probability);
});

test('unsupported sessions and incomplete eligible text fail closed', () => {
  assert.equal(scoreIntroductionPriorRow(row({ session_slug: '2027-2028', session_start: '2027-01-01' })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ raw_text: null })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ text_hash: null })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ in_authoritative_universe: false })), undefined);
});
