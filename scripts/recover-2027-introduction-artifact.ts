import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyPinnedP8FrozenModelJson, P8_FROZEN_MODEL_BUILD_SHA } from '../src/evaluation/lifecycle-p8-frozen-model-verify.js';
import { LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256, LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256 } from '../src/evaluation/lifecycle-p8-prospective.js';
import { deserializeIntroductionPriorModelV4, predictIntroductionPriorFromArtifact, type SerializedIntroductionPriorModelV4 } from '../src/forecasting/introduction-prior-model.js';
import { predictIntroductionTextModel } from '../src/evaluation/introduction-text-model.js';

const sha = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex');

function main() {
  if (process.argv.length !== 3) throw new Error('Provide the original pinned P8 model.json file');
  const checked = verifyPinnedP8FrozenModelJson(readFileSync(process.argv[2]));
  const original = checked.artifact.modelContent.introduction.model;
  if (sha(JSON.stringify(original)) !== LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256 ||
    original.targetSessionSlug !== '2027-2028' || original.targetSessionStart !== '2027-01-01' ||
    original.trainedThroughSessionSlug !== '2025-2026' ||
    JSON.stringify(original.trainingSessions) !== JSON.stringify(['2021-2022','2023-2024','2025-2026']) ||
    original.trainingRows !== 31010 || original.trainingPositives !== 654 ||
    original.titleStats.length !== 1606 || original.textStats.length !== 422) {
    throw new Error('Unexpected frozen introduction model identity or content');
  }
  // The original P8 model intentionally omits the serving export's provenance.
  // Add truthful provenance without altering any original field or statistic.
  const candidate: SerializedIntroductionPriorModelV4 = {
    ...original,
    provenance: {
      authoritativeUniverse: original.trainingRows,
      generatedAt: checked.artifact.generatedAt,
      codeSha: P8_FROZEN_MODEL_BUILD_SHA,
      evaluationCommit: '7826d9696e0766abce3b58bf4ae2e4a155b7a000',
    },
  };
  const { provenance: _provenance, ...recovered } = candidate;
  if (sha(JSON.stringify(recovered)) !== LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256) throw new Error('Recovered model drift');
  const runtime = deserializeIntroductionPriorModelV4(candidate);
  const title = 'School district education grants';
  for (const example of [
    {title,initialText:null,initialTextAvailableAtIntroduction:false},
    {title,initialText:'A bill for an act relating to education; teacher training grant program authorized.',initialTextAvailableAtIntroduction:true},
  ]) {
    const predicted = predictIntroductionPriorFromArtifact(candidate,{...example,sessionSlug:'2027-2028',sessionStart:'2027-01-01'});
    if (predicted !== predictIntroductionTextModel(runtime,example) || predicted === undefined || !Number.isFinite(predicted)) throw new Error('Recovered candidate prediction sanity failure');
    if (predictIntroductionPriorFromArtifact(candidate,{...example,sessionSlug:'2025-2026',sessionStart:'2025-01-01'}) !== undefined) throw new Error('Recovered candidate crossed the session boundary');
  }
  const compact = JSON.stringify(candidate);
  const summary = {
    readiness:'candidate_recovered_not_serving',
    ...checked.verification,
    sourceBuildSha:P8_FROZEN_MODEL_BUILD_SHA,
    frozenIntroductionModelSha256:LIFECYCLE_P8_INTRO_MODEL_CONTENT_SHA256,
    trainingCorpusSha256:LIFECYCLE_P8_INTRO_TRAINING_CORPUS_SHA256,
    candidateCompactSha256:sha(compact),
    targetSession:candidate.targetSessionSlug,
    trainedThrough:candidate.trainedThroughSessionSlug,
    trainingRows:candidate.trainingRows,
    trainingPositives:candidate.trainingPositives,
    titleStats:candidate.titleStats.length,
    textStats:candidate.textStats.length,
    targetSessionOutcomesUsedForFit:false,
    newFit:false, servingChanged:false,
    syntheticSanityChecks:true,
    automaticPromotionAllowed:false,
  };
  const out = resolve('artifacts/recovered-2027-introduction');
  mkdirSync(out,{recursive:true});
  writeFileSync(resolve(out,'candidate.json'), compact+'\n');
  writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log('INTRO_RECOVERY_SUMMARY '+JSON.stringify(summary));
  // The candidate contains only previously frozen model statistics and provenance.
  // A bounded log transfer enables an independent reviewed repo commit without
  // write-capable Actions credentials, external storage, or a DB connection.
  const encoded = Buffer.from(compact+'\n').toString('base64');
  for (let offset=0;offset<encoded.length;offset+=3000) {
    console.log('INTRO_RECOVERY_CHUNK '+String(offset/3000)+' '+encoded.slice(offset,offset+3000));
  }
}
main();
