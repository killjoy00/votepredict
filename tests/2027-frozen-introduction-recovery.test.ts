import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256, LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256 } from '../src/evaluation/lifecycle-p8-prospective.js';
import { predictIntroductionPriorFromArtifact, type SerializedIntroductionPriorModelV4 } from '../src/forecasting/introduction-prior-model.js';

const candidatePath = 'data/evaluation/frozen-introduction-v4-2027-2028-candidate.json';
const receiptPath = 'data/evaluation/frozen-introduction-v4-2027-2028-recovery.json';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

test('permanently retained 2027 introduction candidate matches the original frozen model, without serving it', () => {
  const raw = readFileSync(candidatePath,'utf8');
  const candidate = JSON.parse(raw) as SerializedIntroductionPriorModelV4;
  const receipt = JSON.parse(readFileSync(receiptPath,'utf8'));
  const compact = JSON.stringify(candidate);
  assert.equal(raw, compact+'\n');
  assert.equal(sha(compact), '522e4f838b982145215e7cd759962bb57d26165857435c2c4690ced7b52dbe2d');
  assert.equal(sha(compact), receipt.candidateCompactSha256);
  const { provenance, ...original } = candidate;
  assert.equal(sha(JSON.stringify(original)), LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256);
  assert.equal(receipt.trainingCorpusSha256, LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256);
  assert.equal(receipt.sourceRunId,35910925882);
  assert.equal(receipt.sourceArtifactId,10772991611);
  assert.equal(receipt.recoveryRun,45894535519);
  assert.equal(receipt.newFit,false);
  assert.equal(receipt.targetSessionOutcomesUsedForFit,false);
  assert.equal(receipt.servingChanged,false);
  assert.equal(receipt.productionCaptureActivated,false);
  assert.equal(receipt.automaticPromotionAllowed,false);
  assert.equal(provenance.codeSha,'2733a6c8f96e88e1028dbcea7c5d9caac212ab08');
  assert.equal(candidate.targetSessionSlug,'2027-2028');
  assert.equal(candidate.targetSessionStart,'2027-01-01');
  assert.equal(candidate.trainedThroughSessionSlug,'2025-2026');
  assert.deepEqual(candidate.trainingSessions,['2021-2022','2023-2024','2025-2026']);
  assert.equal(candidate.trainingRows,31010);
  assert.equal(candidate.trainingPositives,654);
  assert.equal(candidate.baseRate,654/31010);
  assert.equal(candidate.titleStats.length,1606);
  assert.equal(candidate.textStats.length,422);
  for (const [stats, minimum] of [[candidate.titleStats,25],[candidate.textStats,40]] as const) {
    assert.equal(new Set(stats.map(row=>row[0])).size,stats.length);
    for (const [token, positives, total] of stats) {
      assert.ok(token.length>=3);
      assert.ok(Number.isInteger(positives)&&Number.isInteger(total)&&positives>=0&&positives<=total&&total>=minimum&&total<=31010);
    }
  }
  const row={title:'School district education grants',initialText:'Synthetic purpose text for teacher training grants.',initialTextAvailableAtIntroduction:true};
  const valid = predictIntroductionPriorFromArtifact(candidate,{...row,sessionSlug:'2027-2028',sessionStart:'2027-01-01'});
  assert.ok(valid!==undefined && Number.isFinite(valid) && valid>=0.0025 && valid<=0.35);
  assert.equal(predictIntroductionPriorFromArtifact(candidate,{...row,sessionSlug:'2025-2026',sessionStart:'2025-01-01'}),undefined);
  assert.equal(predictIntroductionPriorFromArtifact(candidate,{...row,sessionSlug:'2027-2028',sessionStart:'2027-01-02'}),undefined);
});
