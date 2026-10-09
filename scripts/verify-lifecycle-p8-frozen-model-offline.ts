/**
 * Explicit operator-only OFFLINE verifier for the original frozen P8 model.json.
 * Never touches Vercel, Neon, the app database, or the network.
 *
 * Usage:
 * npm run verify:lifecycle:p8:offline -- --model-json /path/to/original/model.json
 */
import { loadPinnedP8FrozenModelJsonFile } from '../src/evaluation/lifecycle-p8-frozen-model-verify.js';

async function main(): Promise<void> {
  if (process.argv.length !== 4 || process.argv[2] !== '--model-json' ||
      !process.argv[3] || /^https?:/i.test(process.argv[3])) {
    throw new Error('Pass exactly --model-json /path/to/original/model.json; URLs and live sources forbidden');
  }
  const { verification, artifact } = await loadPinnedP8FrozenModelJsonFile(process.argv[3]);
  console.log(JSON.stringify({
    check: 'frozen-p8-original-byte-and-content-hash',
    verdict: 'passed',
    sourceRunId: verification.sourceRunId,
    sourceArtifactId: verification.sourceArtifactId,
    originalModelJsonSha256: verification.rawModelJsonSha256,
    frozenModelContentSha256: verification.modelContentSha256,
    planSha256: verification.planSha256,
    frozenBuildSha: artifact.codeSha,
    targetSession: artifact.modelContent.targetSession,
    preActivation: artifact.preActivation,
    servingChanged: verification.servingChanged,
    predictionsComputed: verification.predictionsComputed,
    productionCaptureActivated: verification.productionCaptureActivated,
  }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'P8 offline verifier failed');
  process.exitCode = 1;
});
