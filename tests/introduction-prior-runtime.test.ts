import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FROZEN_INTRODUCTION_PRIOR_ARTIFACT,
  FROZEN_INTRODUCTION_2027_ARTIFACT,
  INTRODUCTION_2027_ROLLBACK_ENV,
  selectFrozenIntroductionArtifact,
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
  assert.equal(scoreIntroductionPriorRow(row({ session_slug: '2029-2030', session_start: '2029-01-01' })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ session_slug: '2027-2028', session_start: '2027-01-02' })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ raw_text: null })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ text_hash: null })), undefined);
  assert.equal(scoreIntroductionPriorRow(row({ in_authoritative_universe: false })), undefined);
});

import { predictIntroductionPriorFromArtifact } from '../src/forecasting/introduction-prior-model.js';
test('2027 introduction runtime uses exactly the recovered frozen artifact, not a changed historical model', () => {
  const future = row({session_slug:'2027-2028',session_start:'2027-01-01',introduced_on:'2027-01-12'});
  const score = scoreIntroductionPriorRow(future);
  assert.ok(score);
  assert.equal(score.artifact.trainingRows,31010);
  assert.equal(score.artifact.trainingPositives,654);
  assert.equal(score.artifact.targetSessionSlug,'2027-2028');
  assert.equal(score.artifact.runtimeAssembledSha256,'522e4f838b982145215e7cd759962bb57d26165857435c2c4690ced7b52dbe2d');
  assert.equal(score.artifact.sourceRunId,35910925882);
  assert.equal(score.artifact.predictionSha256,null);
  for (const input of [future,{...future,model_eligible:'false',raw_text:'LATER TEXT MUST NOT ENTER MODEL'}]) {
    assert.equal(scoreIntroductionPriorRow(input)?.probability,predictIntroductionPriorFromArtifact(FROZEN_INTRODUCTION_2027_ARTIFACT,{
      sessionSlug:input.session_slug,sessionStart:input.session_start,title:input.title,
      initialText:input.model_eligible==='true'?input.raw_text:null,initialTextAvailableAtIntroduction:input.model_eligible==='true',
    }));
  }
  const historical = row();
  assert.equal(scoreIntroductionPriorRow(historical)?.probability,predictIntroductionPriorFromArtifact(FROZEN_INTRODUCTION_PRIOR_ARTIFACT,{
    sessionSlug:historical.session_slug,sessionStart:historical.session_start,title:historical.title,
    initialText:historical.raw_text,initialTextAvailableAtIntroduction:true,
  }));
  assert.equal(scoreIntroductionPriorRow(historical)?.artifact.predictionSha256,'56ef5169cca75b8586a4e2571bcb7745c33770c8a55d1723db9cdab97e9f3ca4');
  assert.equal(selectFrozenIntroductionArtifact('2027-2028','2027-01-01',{[INTRODUCTION_2027_ROLLBACK_ENV]:'true'}),undefined);
  assert.equal(selectFrozenIntroductionArtifact('2025-2026','2025-01-01',{[INTRODUCTION_2027_ROLLBACK_ENV]:'true'}),FROZEN_INTRODUCTION_PRIOR_ARTIFACT);
  assert.equal(selectFrozenIntroductionArtifact('2029-2030','2029-01-01',{}),undefined);
  assert.equal(scoreIntroductionPriorRow({...future,model_eligible:'true',raw_text:null}),undefined);
  assert.equal(scoreIntroductionPriorRow({...future,in_authoritative_universe:false}),undefined);
});
